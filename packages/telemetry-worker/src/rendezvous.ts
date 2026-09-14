import { isAllowedOrigin } from "./validate";

/**
 * Le rendez-vous des salons — un Durable Object par code de partie (plan 209, Lot C4).
 *
 * 🔴 **Pourquoi il existe.** Jusqu'ici le code de salon **était** l'adresse du pair hôte
 * (`pkmntac-<CODE>-1`, décision #904). Élégant, gratuit — et bloquant : changer d'hôte demandait de
 * changer l'adresse d'une partie en cours, sous les doigts de joueurs qui venaient peut-être de se
 * dicter ce code. Aucune migration d'hôte n'était possible, et un hôte parti brutalement ne pouvait
 * même pas revenir (il lui fallait 99 s pour reprendre son adresse, l'adversaire n'attendant que
 * 75 s). Ce registre découple les deux : le code devient une **clé** qu'on résout, l'adresse du pair
 * qui héberge n'est plus qu'une valeur qu'on remplace.
 *
 * 🔴 **Il n'arbitre pas le combat, et n'authentifie personne.** Comme le reste du réseau, ce n'est
 * pas un anti-triche (même position que #943 et #975) : n'importe quel pair peut prétendre héberger.
 * Il sérialise et il tranche les courses, il ne juge pas. Un pair malveillant qui détournerait un
 * salon peut déjà faire pire en divergeant.
 */

/** Combien de temps un salon sans nouvelles garde son code. Au-delà, le code est libre. */
export const ROOM_TTL_MS = 6 * 60 * 60 * 1000;

export const RENDEZVOUS_PATH = "/salon";

/** Ce que le registre garde d'un salon : qui héberge, et depuis quelle époque. */
interface HostRecord {
  peerId: string;
  /**
   * 🔴 **Le cœur du dispositif, pas un ornement.** Un `take-over` n'est appliqué que si l'époque
   * fournie est celle en cours, et l'incrémente en réussissant — un compare-and-swap.
   *
   * Un Durable Object s'exécute **mono-thread par objet** (garantie Cloudflare), donc deux reprises
   * concurrentes sont déjà sérialisées : la première passe et fait passer l'époque à `n+1`, la
   * seconde arrive avec `n` et **échoue**. Ce qui manquait sans ce compteur, ce n'est pas la
   * sérialisation — c'est que le perdant **apprenne** qu'il a perdu au lieu de se croire hôte.
   */
  epoch: number;
  updatedAt: number;
}

export type RendezvousRequest =
  | { op: "claim"; peerId: string }
  | { op: "get" }
  | { op: "takeOver"; peerId: string; epoch: number };

export type RendezvousResponse =
  | { ok: true; peerId: string; epoch: number }
  | { ok: false; peerId: string; epoch: number }
  | { absent: true };

/**
 * Valide le corps AVANT d'écrire quoi que ce soit.
 *
 * 🔴 Un simple `as` mentait, et le mensonge était durable : un corps `{"op":"claim"}` sans `peerId`
 * écrivait `{ peerId: undefined }`, que `read()` rendait ensuite **non-null** — donc le code restait
 * confisqué six heures, refusant tout salon légitime, pendant que le client rejetait la réponse.
 * Échouer tout de suite coûte un 400 ; laisser passer coûte un code mort pour la journée.
 */
function parseRequest(raw: unknown): RendezvousRequest {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("corps illisible");
  }
  const body = raw as Record<string, unknown>;
  if (body.op === "get") {
    return { op: "get" };
  }
  if (typeof body.peerId !== "string" || body.peerId.length === 0) {
    throw new Error("peerId manquant");
  }
  if (body.op === "claim") {
    return { op: "claim", peerId: body.peerId };
  }
  if (body.op === "takeOver" && Number.isInteger(body.epoch)) {
    return { op: "takeOver", peerId: body.peerId, epoch: body.epoch as number };
  }
  throw new Error("opération inconnue");
}

/**
 * Qui a le droit de parler au registre.
 *
 * 🔴 **Pas la même liste que la télémétrie, et c'est le point.** `ALLOWED_ORIGINS` exclut `localhost`
 * À DESSEIN : une partie jouée en développement ne doit pas entrer dans les statistiques. Ce registre
 * ne compte rien — il dit quelle place héberge un code — donc exclure le développement n'y protège
 * rien et empêche simplement de recetter la migration d'hôte. Constaté en recette le 2026-09-14 :
 * l'élection retombait sur le repli « pas de registre » et affichait « ce code ne correspond à aucune
 * partie », c'est-à-dire le comportement d'AVANT le plan 209.
 *
 * Le port n'est pas fixé : `vite` en change d'un worktree à l'autre, et une liste de ports serait
 * fausse la première fois qu'on en ouvre un de plus.
 */
const LOCAL_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;

export function isRendezvousOrigin(origin: string | null): origin is string {
  if (origin === null) {
    return false;
  }
  return isAllowedOrigin(origin) || LOCAL_ORIGIN.test(origin);
}

/**
 * Le code de salon, tel que le client le compose — insensible à la casse.
 *
 * 🔴 **Une FOURCHETTE, pas la longueur exacte, et c'est délibéré.** Ce registre ne connaît pas les
 * règles de code du jeu : `ROOM_CODE_LENGTH` et `ROOM_CODE_ALPHABET` vivent dans `packages/network`,
 * dont ce Worker ne dépend pas — et ne doit pas dépendre, c'est un service, pas un morceau du jeu.
 * Recopier la longueur ici créerait deux sources de vérité vouées à diverger en silence : le
 * registre refuserait un jour des codes parfaitement valides.
 *
 * ⚠️ C'est exactement ce qui est arrivé le 2026-09-14 : écrit `{4}` alors que les codes du jeu font
 * **cinq** caractères, ce registre rendait 400 sur tout code réel — donc plus aucune migration
 * d'hôte. Rien ne l'a vu parce que les vérifications manuelles ET les tests unitaires employaient
 * tous des codes à quatre caractères inventés pour l'occasion. Le garde-fou testait sa propre erreur.
 *
 * Ce qu'il faut ici, ce n'est pas la règle du jeu : c'est refuser ce qui ne peut pas être un nom
 * d'objet raisonnable.
 */
export function isValidRendezvousCode(code: string): boolean {
  return /^[A-Z0-9]{4,12}$/.test(code.toUpperCase());
}

/**
 * L'état d'un seul salon. Cloudflare garantit qu'une instance par code, mono-thread : c'est cette
 * garantie, et elle seule, qui rend le compare-and-swap ci-dessous suffisant.
 */
export class RoomRendezvous {
  private readonly storage: DurableObjectStorage;

  constructor(state: DurableObjectState) {
    this.storage = state.storage;
  }

  async fetch(request: Request): Promise<Response> {
    let body: RendezvousRequest;
    try {
      body = parseRequest(await request.json());
    } catch {
      return json({ absent: true }, 400);
    }
    const current = await this.read();
    switch (body.op) {
      case "get":
        return json(current === null ? { absent: true } : { ok: true, ...strip(current) });

      case "claim": {
        if (current !== null) {
          // Le code est pris et vivant : on ne le vole pas, on le dit.
          return json({ ok: false, ...strip(current) });
        }
        const claimed: HostRecord = { peerId: body.peerId, epoch: 1, updatedAt: Date.now() };
        await this.storage.put("host", claimed);
        return json({ ok: true, ...strip(claimed) });
      }

      case "takeOver": {
        if (current === null) {
          // Plus personne : reprendre un salon éteint revient à l'ouvrir.
          const revived: HostRecord = { peerId: body.peerId, epoch: 1, updatedAt: Date.now() };
          await this.storage.put("host", revived);
          return json({ ok: true, ...strip(revived) });
        }
        if (body.epoch !== current.epoch) {
          /*
           * 🔴 La course est perdue, et c'est ce refus qui ferme le piège du double hôte : le
           * perdant repart avec l'identité du VRAI hôte au lieu de se croire élu. Sans ce retour,
           * deux pairs ayant vu la même déconnexion se déclareraient tous deux successeurs.
           */
          return json({ ok: false, ...strip(current) });
        }
        const next: HostRecord = {
          peerId: body.peerId,
          epoch: current.epoch + 1,
          updatedAt: Date.now(),
        };
        await this.storage.put("host", next);
        return json({ ok: true, ...strip(next) });
      }
    }
  }

  /** L'enregistrement courant, ou `null` s'il n'existe pas — ou s'il a dépassé son temps. */
  private async read(): Promise<HostRecord | null> {
    const record = await this.storage.get<HostRecord>("host");
    if (record === undefined) {
      return null;
    }
    if (Date.now() - record.updatedAt > ROOM_TTL_MS) {
      /*
       * Un salon qu'on a oublié de refermer ne doit pas confisquer son code pour toujours : quatre
       * caractères font un espace petit, et le jeu n'a aucun moment où quelqu'un fait le ménage.
       */
      await this.storage.delete("host");
      return null;
    }
    return record;
  }
}

function strip(record: HostRecord): { peerId: string; epoch: number } {
  return { peerId: record.peerId, epoch: record.epoch };
}

function json(payload: RendezvousResponse, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}
