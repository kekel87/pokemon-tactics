/**
 * Le relais de secours des salons — un Durable Object par code de partie (plan 216, bug 1).
 *
 * 🔴 **Pourquoi il existe.** Les serveurs TURN gratuits de `peerjs` ont disparu : leurs noms n'ont
 * plus d'enregistrement DNS `A` (mesuré le 2026-09-19 sur trois résolveurs), et un vrai Chromium ne
 * gather plus aucun candidat `relay`. Il ne restait que le STUN, qui ne franchit ni le NAT
 * symétrique ni le CGNAT — donc plus de partie en ligne depuis des données mobiles ou un wifi
 * public. Le jeu reste pair-à-pair ; ceci n'est qu'un chemin de secours quand la traversée échoue.
 *
 * 🔴 **Il n'arbitre pas le combat, et n'authentifie personne.** Il recopie aux autres ce qu'un joueur
 * lui envoie, sans jamais lire ce qu'il transporte. Même position que le registre des salons
 * (`rendezvous.ts`) : il sérialise et il achemine, il ne juge pas. Un pair malveillant qui
 * détournerait un salon peut déjà faire pire en divergeant — la détection de désync (Lot B4) est là
 * pour ça, pas ce fichier.
 *
 * 🔴 **API Hibernation, et ce n'est PAS une optimisation.** `state.acceptWebSocket()` au lieu de
 * `ws.accept()`. Documentation Cloudflare : *« Calling `accept()` on a WebSocket in an Object will
 * incur duration charges for the entire time the WebSocket is connected »* — un combat au tour par
 * tour paierait donc tout son temps de réflexion, et le palier gratuit (13 000 GB-s/jour) ne
 * suffirait pas. Avec l'hibernation, *« Billable Duration charges do not accrue during hibernation »*
 * et les clients restent connectés au réseau Cloudflare pendant ce temps.
 *
 * ⚠️ Corollaire : **l'état en mémoire est réinitialisé** à chaque réveil. Ce qui doit survivre vit
 * donc dans le stockage de l'objet ou dans les étiquettes de socket. La seule exception est
 * `pendingIncoming`, un compteur dont la perte est bornée et assumée — voir son commentaire.
 */

export const RELAY_PATH = "/relais";

/**
 * Au-delà de quelle consommation estimée du jour on cesse d'accepter de nouveaux salons.
 *
 * 🔴 **Ce seuil ne protège pas un budget, il protège le REGISTRE DES SALONS.** Le plafond de 100 000
 * requêtes/jour du plan gratuit est à l'échelle du compte : si le relais le brûle, `Error 1027` ne
 * tombe pas que sur lui, il tombe aussi sur la télémétrie et sur `/salon` — sans lequel plus
 * personne ne peut créer ni rejoindre une partie, **même en direct, même sans avoir besoin du
 * relais**. Un relais qui s'emballe casserait le multijoueur en entier, y compris pour ceux qu'il ne
 * servait pas. D'où une marge large, volontairement conservatrice.
 */
const DAILY_REQUEST_BUDGET = 100_000;
/**
 * ⚠️ **Une enveloppe ALLOUÉE, pas une mesure du reste.** `overBudget()` ne lit que `relay_usage` : la
 * télémétrie et `/salon` consomment le même plafond de compte sans être comptés ici. Ces 60 % sont
 * donc une hypothèse sur leur consommation, pas une observation — assumée, et large pour cette
 * raison. La rendre exacte demanderait de compter les trois chemins dans la même table journalière.
 */
const RELAY_BUDGET_SHARE = 0.6;
export const RELAY_DAILY_LIMIT = Math.floor(DAILY_REQUEST_BUDGET * RELAY_BUDGET_SHARE);

/**
 * Le ratio de facturation des messages WebSocket entrants chez Cloudflare : *« a 20:1 ratio is
 * applied to incoming WebSocket messages »*. Les messages SORTANTS ne sont pas facturés (*« There is
 * no charge for outgoing WebSocket messages »*), donc la diffusion aux autres places est gratuite —
 * c'est ce qui rend ce relais tenable à 12 joueurs.
 */
const INCOMING_MESSAGE_RATIO = 20;

interface UsageRecord {
  /** Jour UTC (`YYYY-MM-DD`) auquel ce compteur se rapporte. */
  day: string;
  /** Ouvertures de socket : une requête facturée chacune. */
  connections: number;
  /** Messages entrants bruts. Divisés par le ratio au moment d'agréger. */
  incoming: number;
}

/** 🔴 UTC et non l'heure locale : c'est à minuit UTC que Cloudflare remet ses compteurs à zéro. */
function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** La formule exacte de Cloudflare, appliquée à ce qu'on a compté. */
export function billableRequests(record: Pick<UsageRecord, "connections" | "incoming">): number {
  return record.connections + Math.ceil(record.incoming / INCOMING_MESSAGE_RATIO);
}

export class RoomRelay {
  private readonly state: DurableObjectState;
  private readonly database: D1Database;

  constructor(state: DurableObjectState, env: { database: D1Database }) {
    this.state = state;
    this.database = env.database;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("websocket attendu", { status: 426 });
    }
    const seat = Number(new URL(request.url).searchParams.get("seat"));
    if (!Number.isInteger(seat) || seat < 1) {
      return new Response("place illisible", { status: 400 });
    }

    /*
     * 🔴 **La condition exacte du garde-fou.** Un Durable Object n'a aucun rappel « je viens d'être
     * créé » : il naît à la première requête et rien ne le distingue d'un réveil. La question « ce
     * salon commence-t-il ? » se répond donc sur ce que l'objet peut observer de lui-même —
     * `getWebSockets()`, qui fonctionne APRÈS hibernation, c'est précisément la garantie de l'API.
     *
     * Aucune socket = un salon qui commence, qu'on peut refuser. Au moins une = une partie déjà
     * entamée, qu'on ne coupe jamais au milieu pour une raison de quota.
     */
    /*
     * 🔴 Un vrai refus HTTP, **pas** un 101 suivi d'une fermeture. Accepter puis fermer laissait
     * l'événement `open` partir le premier côté client : sa promesse d'ouverture se résolvait, le
     * transport se croyait prêt, et il re-composait le relais saturé à chaque échec direct — une
     * requête de plus à chaque fois, c'est-à-dire l'inverse de ce que ce garde-fou protège.
     */
    if (this.state.getWebSockets().length === 0 && (await this.overBudget())) {
      return new Response("relais saturé", { status: 429 });
    }

    const pair = new WebSocketPair();
    /*
     * L'étiquette porte la place : c'est par elle qu'on retrouve un destinataire au réveil, quand
     * plus aucun champ d'instance n'a survécu. `getWebSockets(tag)` les relit.
     */
    this.state.acceptWebSocket(pair[1], [String(seat)]);
    await this.count({ connections: 1 });
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  /**
   * 🔴 **On ne lit que l'adresse, jamais le contenu.**
   *
   * Le message est réexpédié **tel quel**, dans sa chaîne d'origine : on n'en extrait que `to` pour
   * savoir à qui. Ne pas le re-sérialiser est ce qui garantit qu'aucune subtilité du protocole du
   * jeu (un champ ajouté, un ordre de clés) ne puisse être altérée en route par ce service, qui n'en
   * connaît aucune règle. C'est aussi pourquoi `NETWORK_VERSION` n'a pas à bouger pour ce lot.
   */
  async webSocketMessage(_socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") {
      return;
    }
    /*
     * 🔴 **On lit l'adresse SANS désérialiser la trame.** Forme : `<to>|<from>|<charge utile>`.
     *
     * Ce n'est pas une micro-optimisation, c'est ce qui rend la doctrine de ce fichier
     * structurellement vraie : il est désormais *impossible* à ce relais de regarder le contenu
     * qu'il achemine, plutôt que simplement déconseillé. Et le coût suivait la charge utile — un
     * `start` à 12 places pèse ~15 Ko, diffusé à 11 pairs c'était ~165 Ko de JSON analysés pour en
     * extraire 11 entiers.
     */
    const bar = message.indexOf("|");
    if (bar <= 0) {
      return;
    }
    const to = Number(message.slice(0, bar));
    if (!Number.isInteger(to) || to < 1) {
      return;
    }
    for (const target of this.state.getWebSockets(String(to))) {
      try {
        target.send(message);
      } catch {
        // Une socket morte entre-temps : `webSocketClose` fera le ménage, rien à traiter ici.
      }
    }
    await this.countIncoming();
  }

  async webSocketClose(socket: WebSocket): Promise<void> {
    try {
      socket.close();
    } catch {
      // Déjà fermée — le seul but est de ne pas laisser un pair à moitié raccroché.
    }
    // Dernier parti : le salon est fini, on remonte ce qu'il a consommé.
    if (this.state.getWebSockets().length === 0) {
      await this.flush();
    }
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    await this.webSocketClose(socket);
  }

  /**
   * 🔴 **Le compteur s'accumule en MÉMOIRE et ne se persiste qu'une fois par requête facturable.**
   *
   * La première version faisait un `storage.get` + un `storage.put` **par message**. Sur un backend
   * SQLite, chacun est une ligne lue / écrite facturée, avec le même palier gratuit que D1 —
   * **100 000 écritures/jour**. Or `Room.broadcast` émet un message PAR PAIR : un combat à 12 fait
   * de l'ordre de 2 600 messages entrants, donc 2 600 écritures, donc ~38 combats par jour. Et la
   * garde que ce compteur alimente ne se déclenche qu'à 1,2 million de messages entrants :
   * **le compteur brûlait son propre quota douze fois avant que la garde ne serve une seule fois.**
   *
   * C'est exactement le piège documenté plus bas pour D1, appliqué à D1 mais pas au stockage de
   * l'objet, qui est au même ordre de grandeur.
   *
   * On persiste donc tous les {@link INCOMING_MESSAGE_RATIO} messages : une écriture par requête
   * facturable, soit un gain de 20×. L'hibernation perd au plus 19 messages, c'est-à-dire **moins
   * d'une requête facturable** — sous le bruit du garde-fou.
   */
  private pendingIncoming = 0;

  private async countIncoming(): Promise<void> {
    this.pendingIncoming += 1;
    if (this.pendingIncoming < INCOMING_MESSAGE_RATIO) {
      return;
    }
    const batched = this.pendingIncoming;
    this.pendingIncoming = 0;
    await this.count({ incoming: batched });
  }

  /** Le compteur persistant vit dans le stockage de l'objet : il survit à l'hibernation, la mémoire non. */
  private async count(delta: { connections?: number; incoming?: number }): Promise<void> {
    const day = utcDay(Date.now());
    const stored = await this.state.storage.get<UsageRecord>("usage");
    /*
     * Un salon qui traverse minuit UTC : on solde la veille avant de repartir de zéro, sinon sa
     * consommation d'hier se compterait sur aujourd'hui et fausserait le garde-fou dans le mauvais
     * sens — celui qui refuse des salons légitimes.
     */
    if (stored !== undefined && stored.day !== day) {
      await this.writeUsage(stored);
    }
    const base = stored?.day === day ? stored : { connections: 0, incoming: 0 };
    await this.state.storage.put("usage", {
      day,
      connections: base.connections + (delta.connections ?? 0),
      incoming: base.incoming + (delta.incoming ?? 0),
    } satisfies UsageRecord);
  }

  /**
   * 🔴 **Une seule écriture D1 par salon, à sa fin — jamais une par message.**
   *
   * Le palier gratuit D1 donne **100 000 écritures de ligne par jour**, c'est-à-dire le même ordre
   * de grandeur que le budget de requêtes qu'on cherche à préserver. Un compteur qui écrirait à
   * chaque message consommerait autant que ce qu'il mesure : il ne protégerait rien, il doublerait
   * la consommation.
   */
  private async flush(): Promise<void> {
    if (this.pendingIncoming > 0) {
      const remaining = this.pendingIncoming;
      this.pendingIncoming = 0;
      await this.count({ incoming: remaining });
    }
    const stored = await this.state.storage.get<UsageRecord>("usage");
    if (stored === undefined) {
      return;
    }
    await this.writeUsage(stored);
    await this.state.storage.delete("usage");
  }

  private async writeUsage(record: UsageRecord): Promise<void> {
    const requests = billableRequests(record);
    if (requests === 0) {
      return;
    }
    try {
      await this.database
        .prepare(
          `INSERT INTO relay_usage (day, requests, rooms) VALUES (?, ?, 1)
           ON CONFLICT(day) DO UPDATE SET requests = requests + excluded.requests,
                                          rooms = rooms + 1`,
        )
        .bind(record.day, requests)
        .run();
    } catch (error) {
      // Le relevé est un confort, pas une condition de jeu : son échec ne coupe aucune partie.
      console.error("relais : relevé non écrit", error);
    }
  }

  /**
   * La consommation du jour est à l'échelle du COMPTE, donc elle se lit en D1 et pas dans cet objet,
   * qui ne connaît que la sienne.
   *
   * Une lecture par salon qui commence : les salons sont rares, la lecture est négligeable. En cas
   * d'échec on **accepte** — refuser sur une base de mesure indisponible casserait des parties
   * légitimes pour une panne de relevé.
   */
  private async overBudget(): Promise<boolean> {
    try {
      const row = await this.database
        .prepare("SELECT requests FROM relay_usage WHERE day = ?")
        .bind(utcDay(Date.now()))
        .first<{ requests: number }>();
      return (row?.requests ?? 0) >= RELAY_DAILY_LIMIT;
    } catch {
      return false;
    }
  }
}
