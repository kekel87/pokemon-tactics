import { Listeners } from "./listeners.js";
import { isNetworkMessage, NetworkErrorCode, type NetworkMessage } from "./protocol.js";
import { type PeerIdentity, parsePeerId, peerIdForSeat, seatFromPeerId } from "./room-code.js";
import {
  ChannelHealth,
  type NetworkChannel,
  type NetworkTransport,
  NetworkTransportError,
} from "./transport.js";

/**
 * Le transport de **repli**, par-dessus une WebSocket vers un Durable Object (plan 216, bug 1).
 *
 * 🔴 **Pourquoi il existe.** Les serveurs TURN gratuits de `peerjs` ont disparu — leurs noms n'ont
 * plus d'enregistrement DNS `A`, mesuré le 2026-09-19 sur trois résolveurs, et un vrai Chromium ne
 * gather plus aucun candidat `relay` (`701 TURN host lookup received error`). Il ne reste que le
 * STUN, qui suffit derrière un NAT ordinaire et **pas** en NAT symétrique ni en CGNAT — données
 * mobiles, wifi d'hôtel, réseau public.
 *
 * 🔴 **Ce n'est pas un serveur de jeu.** Il recopie aux autres ce qu'un joueur lui envoie, sans lire
 * le contenu ni arbitrer quoi que ce soit — exactement la position du registre des salons. Les
 * actions restent validées de pair à pair, le moteur reste dupliqué, la partie reste P2P.
 *
 * Trois traits le distinguent de `peer-connection.ts` :
 *
 * 1. **Une seule socket pour tous les pairs.** Là où `peerjs` ouvre une connexion par pair, tout
 *    passe ici par l'objet du code de partie. Les canaux sont donc multiplexés et adressés par
 *    place ; à 12 joueurs ça fait 12 sockets au lieu des 66 connexions du maillage.
 * 2. **La socket s'ouvre à `claim()`, pas au premier `connect()`.** Voir ci-dessous — c'est la
 *    correction d'un défaut qui rendait tout le dispositif inopérant.
 * 3. **La santé du canal n'est pas celle d'ICE.** Voir `onHealthChange`.
 */

/**
 * 🔴 **L'ADRESSE EST HORS DU JSON, et ce n'est pas une micro-optimisation.**
 *
 * Forme d'une trame : `<to>|<from>|<charge utile JSON>`.
 *
 * Deux raisons, dans cet ordre d'importance :
 *
 * 1. **Elle rend la doctrine du relais structurellement vraie** au lieu de simplement respectée. Le
 *    Durable Object lit l'adresse avec un `indexOf` et réexpédie la chaîne telle quelle : il lui est
 *    désormais *impossible* de regarder le contenu, plutôt que simplement déconseillé.
 * 2. **Le coût.** Avec l'adresse DANS le JSON, le relais devait désérialiser toute la charge pour en
 *    extraire un entier — un `start` à 12 places pèse ~15 Ko, diffusé à 11 pairs c'est ~165 Ko de
 *    JSON analysés pour 11 entiers. Côté joueur, c'était symétriquement 11 `JSON.stringify` de la
 *    même charge utile sur le fil qui rend le jeu. Ici la charge est sérialisée **une fois** et seul
 *    le préfixe change.
 */
const FRAME_SEPARATOR = "|";

function frame(to: number, from: number, payload: string): string {
  return `${to}${FRAME_SEPARATOR}${from}${FRAME_SEPARATOR}${payload}`;
}

interface ParsedFrame {
  from: number;
  payload: NetworkMessage;
}

function parseFrame(raw: string): ParsedFrame | undefined {
  const firstBar = raw.indexOf(FRAME_SEPARATOR);
  const secondBar = raw.indexOf(FRAME_SEPARATOR, firstBar + 1);
  if (firstBar < 0 || secondBar < 0) {
    return undefined;
  }
  const from = Number(raw.slice(firstBar + 1, secondBar));
  if (!Number.isInteger(from) || from < 1) {
    return undefined;
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw.slice(secondBar + 1));
  } catch {
    return undefined;
  }
  // Un pair qui envoie n'importe quoi est un pair à ignorer, pas une erreur à remonter à l'écran —
  // même position que `seatFromPeerId` sur une adresse d'un autre salon.
  return isNetworkMessage(payload) ? { from, payload } : undefined;
}

export interface RelayTransportOptions {
  /**
   * L'adresse du relais, **sans le code** : il est ajouté au chemin, comme pour le registre des
   * salons. Injectée par l'application — ce paquet ne connaît pas l'URL du Worker.
   */
  endpoint: string;
  /** Injectable pour les tests : de quoi construire une WebSocket sans navigateur. */
  openSocket?: (url: string) => WebSocket;
}

/**
 * Le budget d'ouverture de la socket de relais.
 *
 * 🔴 **Propre au relais, et court.** Il ne réutilise PAS le budget de l'appelant : joindre un Worker
 * Cloudflare est une opération sub-seconde, lui accorder les 15 s d'une négociation ICE serait ~50×
 * la latence attendue — et cette attente s'ajouterait à celle du chemin direct, déjà payée.
 */
const RELAY_OPEN_TIMEOUT_MS = 3_000;

export class RelayTransport implements NetworkTransport {
  private socket: WebSocket | undefined;
  private destroyed = false;
  private opening: Promise<void> | undefined;
  private identity: PeerIdentity | undefined;
  private readonly incomingListeners = new Listeners<[channel: NetworkChannel]>();
  private readonly channels = new Map<number, RelayChannel>();

  constructor(private readonly options: RelayTransportOptions) {}

  /**
   * 🔴 **C'est ICI que la socket s'ouvre, et le défaut que ça corrige valait tout le dispositif.**
   *
   * La socket naissait au premier `connect()` raté. Or dans `room.ts`, seul l'INVITÉ compose
   * (`handshakeWithHost`, `connectToMesh`, `scheduleHostRedial`) : l'hôte est purement passif, il
   * n'appelle jamais `connect`. Il n'ouvrait donc jamais de socket, le Durable Object n'avait aucune
   * socket pour la place 1, et l'enveloppe de l'invité était **jetée en silence** — sur le lien
   * hôte ↔ invité, c'est-à-dire le seul sans lequel rien ne se passe.
   *
   * La présence sur le relais n'est pas une propriété de « composer », c'est une propriété
   * d'**appartenir au salon**. Or `claim()` est appelé par les deux bouts. Un seul point de cycle de
   * vie, identique pour l'hôte et l'invité.
   *
   * Coût assumé : une WebSocket par joueur en ligne, même quand le direct suffira. Une requête
   * facturée chacune, soit 12 pour une partie à 12 — le garde-fou de quota est dimensionné dessus.
   */
  async claim(peerId: string): Promise<void> {
    this.assertAlive();
    const identity = parsePeerId(peerId);
    if (identity === undefined) {
      throw new NetworkTransportError(
        NetworkErrorCode.ConnexionImpossible,
        `adresse illisible: ${peerId}`,
      );
    }
    this.identity = identity;
    await this.ensureSocket();
  }

  async connect(peerId: string): Promise<NetworkChannel> {
    this.assertAlive();
    const identity = this.identity;
    if (identity === undefined) {
      throw new NetworkTransportError(
        NetworkErrorCode.ConnexionImpossible,
        "joindre un pair avant d'avoir pris son propre identifiant",
      );
    }
    const seat = seatFromPeerId(peerId, identity.roomCode);
    if (seat === undefined) {
      throw new NetworkTransportError(
        NetworkErrorCode.CodeIntrouvable,
        `adresse hors du salon: ${peerId}`,
      );
    }
    await this.ensureSocket();

    /*
     * 🔴 Aucun aller-retour pour « ouvrir » un canal relayé. Le relais ne suit pas le salon — il ne
     * lit pas le contenu, donc il ne sait pas qui joue. Le salon a déjà ce qu'il faut pour trancher :
     * son `welcome` et son chien de garde disent si quelqu'un répond à l'autre bout.
     *
     * ⚠️ Conséquence à connaître : ce `connect` ne peut pas rendre `CodeIntrouvable` pour un salon
     * vide, puisqu'un Durable Object existe pour n'importe quel code valide. C'est pourquoi
     * `FallbackTransport` ne l'emprunte PAS quand le registre a déjà dit que le code est inconnu.
     */
    return this.channelFor(seat, peerId);
  }

  onIncoming(listener: (channel: NetworkChannel) => void): () => void {
    return this.incomingListeners.subscribe(listener);
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    /*
     * Pas de temporisation de vidange, contrairement à `PeerJsTransport` : une WebSocket fermée
     * proprement laisse partir ce qui est déjà dans sa file d'émission, c'est la pile TCP qui s'en
     * charge. `TEARDOWN_DRAIN_MS` existait pour une `RTCPeerConnection`, qui coupe net.
     */
    this.socket?.close(1000, "bye");
    this.forgetSocket();
  }

  private assertAlive(): void {
    if (this.destroyed) {
      throw new NetworkTransportError(NetworkErrorCode.ConnexionImpossible, "transport détruit");
    }
  }

  /** Le canal d'une place, créé à la demande. Un seul par place, dans les deux sens. */
  private channelFor(seat: number, peerId: string): RelayChannel {
    const existing = this.channels.get(seat);
    if (existing !== undefined) {
      return existing;
    }
    const channel = new RelayChannel(
      peerId,
      (payload) => this.sendFrame(seat, payload),
      () => this.channels.delete(seat),
    );
    this.channels.set(seat, channel);
    return channel;
  }

  private sendFrame(to: number, payload: string): void {
    const socket = this.socket;
    if (socket === undefined || socket.readyState !== WebSocket.OPEN) {
      // Le salon apprend la coupure par `onClose` ; jeter ici ferait remonter une exception dans un
      // chemin qui n'en attend pas (`send` est synchrone et sans retour, comme chez `peerjs`).
      return;
    }
    socket.send(frame(to, this.identity?.seat ?? 0, payload));
  }

  /** Ouvre la socket une seule fois, même si plusieurs appels la réclament en parallèle. */
  private ensureSocket(): Promise<void> {
    const pending = this.opening;
    if (pending !== undefined) {
      return pending;
    }
    const identity = this.identity;
    if (identity === undefined) {
      return Promise.reject(
        new NetworkTransportError(NetworkErrorCode.ConnexionImpossible, "relais sans identité"),
      );
    }
    const url = `${this.options.endpoint}/${identity.roomCode}?seat=${identity.seat}`;
    const opening = new Promise<void>((resolve, reject) => {
      const fail = (message: string): void =>
        reject(new NetworkTransportError(NetworkErrorCode.ConnexionImpossible, message));

      let socket: WebSocket;
      try {
        socket = this.options.openSocket?.(url) ?? new WebSocket(url);
      } catch (error) {
        fail(`relais injoignable : ${String(error)}`);
        return;
      }
      const timer = setTimeout(() => {
        socket.close();
        reject(new NetworkTransportError(NetworkErrorCode.DelaiDepasse, "relais muet"));
      }, RELAY_OPEN_TIMEOUT_MS);

      socket.addEventListener("open", () => {
        clearTimeout(timer);
        /*
         * 🔴 `destroy()` a pu passer PENDANT l'ouverture — il ne pouvait alors rien fermer, puisque
         * `this.socket` n'était pas encore posée. Sans cette garde, la socket s'ouvrait ensuite sur
         * un transport détruit et **plus personne ne la fermait** : le Durable Object gardait une
         * place occupée par un client mort, et lui acheminait des trames. C'est exactement l'état
         * que `destroy()` existe pour empêcher.
         */
        if (this.destroyed) {
          socket.close(1000, "bye");
          reject(
            new NetworkTransportError(NetworkErrorCode.ConnexionImpossible, "transport détruit"),
          );
          return;
        }
        this.socket = socket;
        resolve();
      });
      socket.addEventListener("message", (event) => this.receive(event));
      /*
       * `close` seul, pas `error` : la spec WebSocket fait toujours suivre un `error` d'un `close`,
       * donc le second écouteur n'aurait apporté qu'un libellé — et une variation qui ressemble à un
       * oubli plus qu'à une décision.
       */
      socket.addEventListener("close", (event) => {
        clearTimeout(timer);
        this.forgetSocket();
        fail(`relais fermé (${event.code})`);
      });
    });
    this.opening = opening;
    // Une ouverture ratée ne reste pas en cache : l'appel suivant doit pouvoir réessayer.
    opening.catch(() => {
      this.opening = undefined;
    });
    return opening;
  }

  private receive(event: MessageEvent): void {
    if (typeof event.data !== "string") {
      return;
    }
    const parsed = parseFrame(event.data);
    if (parsed === undefined) {
      return;
    }
    const known = this.channels.get(parsed.from);
    if (known !== undefined) {
      known.deliver(parsed.payload);
      return;
    }
    /*
     * Un pair qu'on n'avait pas encore joint nous parle : c'est un canal ENTRANT. Le maillage veut
     * que tout le monde accepte tout le monde, donc on le crée et on l'annonce avant de livrer.
     */
    const roomCode = this.identity?.roomCode ?? "";
    const channel = this.channelFor(parsed.from, peerIdForSeat(roomCode, parsed.from));
    this.incomingListeners.emit(channel);
    channel.deliver(parsed.payload);
  }

  /** Socket perdue ou rendue : on referme tous les canaux et on repart de zéro. */
  private forgetSocket(): void {
    this.socket = undefined;
    this.opening = undefined;
    for (const channel of [...this.channels.values()]) {
      channel.markClosed();
    }
    this.channels.clear();
  }
}

/**
 * Un canal relayé vers une place. Multiplexé sur la socket du transport, il n'en possède aucune.
 */
class RelayChannel implements NetworkChannel {
  private closed = false;
  private readonly messageListeners = new Listeners<[message: NetworkMessage]>();
  private readonly closeListeners = new Listeners<[]>();
  private readonly healthListeners = new Listeners<[health: ChannelHealth]>();

  constructor(
    readonly remotePeerId: string,
    private readonly emit: (payload: string) => void,
    private readonly forget: () => void,
  ) {}

  send(message: NetworkMessage): void {
    if (this.closed) {
      return;
    }
    this.emit(JSON.stringify(message));
  }

  onMessage(listener: (message: NetworkMessage) => void): () => void {
    return this.messageListeners.subscribe(listener);
  }

  onClose(listener: () => void): () => void {
    return this.closeListeners.subscribe(listener);
  }

  /**
   * 🔴 **La santé d'un canal relayé n'est pas celle d'un canal ICE, et ne doit pas faire semblant.**
   *
   * `ChannelHealth` vient du contrôle de fraîcheur d'ICE (RFC 7675), qui sonde le chemin toutes les
   * 5 à 15 s gratuitement. Une WebSocket n'a pas cet équivalent côté navigateur.
   *
   * Répondre `Healthy` en permanence serait un **mensonge** : le chien de garde d'abandon du salon
   * (plan 202) prendrait ses décisions sur une information fausse. On n'émet donc que `Failed`, à la
   * fermeture, et jamais `Uncertain` — le salon retombe alors sur son propre délai, exactement ce
   * qu'il faisait avant que ce signal n'existe.
   *
   * ⚠️ Limite connue, à ne pas oublier si on y revient : le relais, LUI, voit partir un pair
   * instantanément (`getWebSockets`), mais il ne le dit pas encore. L'information existe, elle n'est
   * pas demandée.
   */
  onHealthChange(listener: (health: ChannelHealth) => void): () => void {
    return this.healthListeners.subscribe(listener);
  }

  close(): void {
    this.markClosed();
  }

  /** @internal Livraison depuis le transport. */
  deliver(message: NetworkMessage): void {
    if (!this.closed) {
      this.messageListeners.emit(message);
    }
  }

  /**
   * @internal Fermeture, d'où qu'elle vienne. Idempotente.
   *
   * 🔴 L'ordre — `Failed` puis `close` puis vidange — est celui de `PeerJsChannel.handleClose`, et
   * c'est une règle trouvée au plan 202, pas un gabarit : émettre après avoir vidé laisserait
   * l'interface sans le signal du chemin perdu.
   */
  markClosed(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.healthListeners.emit(ChannelHealth.Failed);
    this.closeListeners.emit();
    this.messageListeners.clear();
    this.closeListeners.clear();
    this.healthListeners.clear();
    this.forget();
  }
}
