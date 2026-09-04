import Peer, { type DataConnection } from "peerjs";
import { isNetworkMessage, NetworkErrorCode, type NetworkMessage } from "./protocol.js";
import {
  CONNECT_TIMEOUT_MS,
  type NetworkChannel,
  type NetworkTransport,
  NetworkTransportError,
  networkErrorCodeFromPeerError,
} from "./transport.js";

/**
 * Transport réel, par-dessus `peerjs@1.5.5` (plan 199, étape 2). L'API et les causes d'erreur ont
 * été confirmées le 2026-09-04 ; la branche `2.0.0-beta` existe et n'est **pas** retenue.
 *
 * Deux traits de la bibliothèque commandent la forme de ce fichier :
 *
 * 1. **La plupart des erreurs détruisent le `Peer`.** `unavailable-id` en fait partie : un
 *    identifiant refusé ne laisse pas un objet réutilisable. Chaque tentative de prise construit
 *    donc son propre `Peer`, et un échec le détruit avant de rendre la main.
 * 2. **L'échec d'un appel sortant arrive sur le `Peer`, pas sur la connexion.** Joindre une adresse
 *    inexistante émet `peer-unavailable` sur le pair local — donc attendre l'ouverture d'un canal
 *    veut dire écouter les deux objets à la fois, plus un délai de garde.
 */

/**
 * La forme d'un serveur STUN/TURN, redéclarée plutôt qu'empruntée à `lib.dom`. Ce paquet ne tire pas
 * la bibliothèque DOM — il n'a rien à faire d'un `document` — et ces valeurs ne sont que transmises
 * à `peerjs` sans être lues.
 */
export interface IceServerConfig {
  urls: string | readonly string[];
  username?: string;
  credential?: string;
}

/**
 * Marge laissée aux derniers messages pour sortir avant que la `RTCPeerConnection` ne soit coupée.
 * Voir `destroy()` pour pourquoi elle est nécessaire, et pourquoi ce n'est qu'une marge.
 */
const TEARDOWN_DRAIN_MS = 500;

export interface PeerJsTransportOptions {
  /** Annuaire à joindre. Absent = le service public de PeerJS. Renseigné par l'e2e, qui lance le sien. */
  host?: string;
  port?: number;
  path?: string;
  secure?: boolean;
  /** Serveurs STUN/TURN. Absent = ceux de la bibliothèque. */
  iceServers?: readonly IceServerConfig[];
}

export class PeerJsTransport implements NetworkTransport {
  private peer: Peer | undefined;
  private destroyed = false;
  private readonly incomingListeners = new Set<(channel: NetworkChannel) => void>();
  private readonly channels = new Set<PeerJsChannel>();

  constructor(private readonly options: PeerJsTransportOptions = {}) {}

  async claim(peerId: string): Promise<void> {
    if (this.destroyed) {
      throw new NetworkTransportError(NetworkErrorCode.ConnexionImpossible, "transport détruit");
    }
    if (this.peer !== undefined) {
      throw new NetworkTransportError(
        NetworkErrorCode.ConnexionImpossible,
        "identifiant déjà pris par ce transport",
      );
    }

    const peer = new Peer(peerId, {
      host: this.options.host,
      port: this.options.port,
      path: this.options.path,
      secure: this.options.secure,
      ...(this.options.iceServers === undefined
        ? {}
        : { config: { iceServers: [...this.options.iceServers] } }),
    });

    try {
      await waitForPeerOpen(peer);
    } catch (error) {
      peer.destroy();
      throw error;
    }

    if (this.destroyed) {
      // `destroy()` a été appelé pendant l'attente — on ne garde pas un pair que personne n'écoute.
      peer.destroy();
      throw new NetworkTransportError(NetworkErrorCode.ConnexionImpossible, "transport détruit");
    }

    this.peer = peer;
    peer.on("connection", (connection) => this.acceptIncoming(connection));
  }

  async connect(peerId: string): Promise<NetworkChannel> {
    const peer = this.peer;
    if (this.destroyed || peer === undefined) {
      throw new NetworkTransportError(
        NetworkErrorCode.ConnexionImpossible,
        "joindre un pair avant d'avoir pris son propre identifiant",
      );
    }

    // `reliable: true` demande un canal ordonné et retransmis : le protocole suppose qu'un
    // `room_state` arrive après le `welcome` qui le précède, et qu'un `start` n'est jamais perdu.
    const connection = peer.connect(peerId, { reliable: true });
    await waitForConnectionOpen(peer, connection);

    const channel = new PeerJsChannel(connection, () => this.channels.delete(channel));
    this.channels.add(channel);
    return channel;
  }

  onIncoming(listener: (channel: NetworkChannel) => void): () => void {
    this.incomingListeners.add(listener);
    return () => this.incomingListeners.delete(listener);
  }

  /**
   * 🔴 **Détruit le pair APRÈS avoir laissé partir ce qui est en file**, et non dans la même boucle
   * synchrone.
   *
   * Ce que fait vraiment `peerjs@1.5.5`, lu dans sa source :
   *
   * - `close({ flush: true })` **ne ferme rien** : il envoie une sentinelle `__peerData` puis rend
   *   la main. C'est au pair distant de refermer en la recevant.
   * - `close()` **jette** la file : `BufferedConnection.close()` fait `this._buffer = []`.
   * - `Peer.destroy()` passe par la seconde branche pour chaque canal, puis coupe la
   *   `RTCPeerConnection`.
   *
   * Enchaîner les deux en synchrone annulait donc le `flush` de la ligne précédente, et le dernier
   * message écrit — le `bye` d'un départ propre, jadis l'accusé de lancement — pouvait ne jamais
   * sortir. Un `bye` perdu fait appliquer aux autres 45 s d'attente au lieu de 10.
   *
   * Le délai n'est pas une garantie, c'est une marge : quelques dizaines d'octets déjà remis à SCTP
   * partent en bien moins que ça, y compris sur un réseau mobile. La vraie garantie serait un accusé
   * applicatif du départ, ce qui n'en vaut pas le prix pour un message dont la perte coûte 35 s
   * d'attente à un joueur qui est parti.
   */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    for (const channel of [...this.channels]) {
      channel.close();
    }
    this.channels.clear();
    this.incomingListeners.clear();

    const peer = this.peer;
    this.peer = undefined;
    setTimeout(() => peer?.destroy(), TEARDOWN_DRAIN_MS);
  }

  private acceptIncoming(connection: DataConnection): void {
    // Un canal entrant n'est exposé qu'**ouvert** : avant, `send` serait perdu en silence, et le
    // salon répondrait un `welcome` que personne ne recevrait.
    const expose = () => {
      if (this.destroyed) {
        connection.close();
        return;
      }
      const channel = new PeerJsChannel(connection, () => this.channels.delete(channel));
      this.channels.add(channel);
      for (const listener of [...this.incomingListeners]) {
        listener(channel);
      }
    };

    if (connection.open) {
      expose();
      return;
    }
    connection.once("open", expose);
  }
}

/**
 * Attend l'ouverture du pair local. Le délai de garde couvre le cas où l'annuaire accepte la
 * connexion TCP puis ne répond plus : sans lui, l'attente serait éternelle et l'interface resterait
 * sur « connexion… » sans jamais rien dire au joueur.
 */
function waitForPeerOpen(peer: Peer): Promise<void> {
  return new Promise((resolve, reject) => {
    const settle = withGuard(resolve, reject, () => {
      peer.off("open", onOpen);
      peer.off("error", onError);
    });

    const onOpen = () => settle.resolve(undefined);
    const onError = (error: { type: string; message?: string }) =>
      settle.reject(
        new NetworkTransportError(networkErrorCodeFromPeerError(error.type), error.message),
      );

    peer.on("open", onOpen);
    peer.on("error", onError);
  });
}

/**
 * Attend l'ouverture d'un canal sortant. Écoute les **deux** objets : la connexion pour son
 * ouverture, le pair pour l'échec, que la bibliothèque y émet et non sur la connexion.
 */
function waitForConnectionOpen(peer: Peer, connection: DataConnection): Promise<void> {
  return new Promise((resolve, reject) => {
    const settle = withGuard(resolve, reject, () => {
      connection.off("open", onOpen);
      connection.off("close", onClose);
      peer.off("error", onPeerError);
    });

    const onOpen = () => settle.resolve(undefined);
    const onClose = () =>
      settle.reject(
        new NetworkTransportError(NetworkErrorCode.ConnexionImpossible, "canal refermé"),
      );
    const onPeerError = (error: { type: string; message?: string }) =>
      settle.reject(
        new NetworkTransportError(networkErrorCodeFromPeerError(error.type), error.message),
      );

    connection.on("open", onOpen);
    connection.on("close", onClose);
    peer.on("error", onPeerError);
  });
}

/**
 * Une promesse qui ne se règle qu'une fois, se désabonne toujours, et abandonne au bout du délai.
 * Facteur commun des deux attentes ci-dessus, où oublier l'un des trois laisse fuir un écouteur ou
 * bloque l'interface.
 */
function withGuard(
  resolve: (value: undefined) => void,
  reject: (reason: unknown) => void,
  cleanup: () => void,
): { resolve: (value: undefined) => void; reject: (reason: unknown) => void } {
  let settled = false;

  const finish = (action: () => void) => {
    if (settled) {
      return;
    }
    settled = true;
    clearTimeout(timer);
    cleanup();
    action();
  };

  const timer = setTimeout(() => {
    finish(() => reject(new NetworkTransportError(NetworkErrorCode.DelaiDepasse)));
  }, CONNECT_TIMEOUT_MS);

  return {
    resolve: (value) => finish(() => resolve(value)),
    reject: (reason) => finish(() => reject(reason)),
  };
}

class PeerJsChannel implements NetworkChannel {
  private closed = false;
  private readonly messageListeners = new Set<(message: NetworkMessage) => void>();
  private readonly closeListeners = new Set<() => void>();

  constructor(
    private readonly connection: DataConnection,
    private readonly onDetached: () => void,
  ) {
    connection.on("data", (data) => this.deliver(data));
    connection.on("close", () => this.handleClose());
    // Une erreur sur un canal ouvert le rend inutilisable : la traiter comme une fermeture évite
    // qu'un pair reste « connecté » dans l'état du salon alors que rien ne passe plus.
    connection.on("error", () => this.handleClose());
  }

  get remotePeerId(): string {
    return this.connection.peer;
  }

  send(message: NetworkMessage): void {
    if (this.closed) {
      return;
    }
    this.connection.send(message);
  }

  onMessage(listener: (message: NetworkMessage) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onClose(listener: () => void): () => void {
    this.closeListeners.add(listener);
    return () => this.closeListeners.delete(listener);
  }

  close(): void {
    if (this.closed) {
      return;
    }
    // `flush` pour que le `bye` qui précède un départ propre parte avant la fermeture — c'est lui qui
    // fait la différence entre le délai court et le délai long chez les autres pairs.
    this.connection.close({ flush: true });
    this.handleClose();
  }

  private handleClose(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    for (const listener of [...this.closeListeners]) {
      listener();
    }
    this.closeListeners.clear();
    this.messageListeners.clear();
    this.onDetached();
  }

  private deliver(data: unknown): void {
    // Un pair peut envoyer n'importe quoi — client modifié, version future, autre application qui a
    // pris une adresse voisine. Ce qui n'est pas reconnaissable est **ignoré**, jamais remonté comme
    // une erreur : ce n'est pas au joueur d'entendre parler d'un paquet mal formé.
    if (!isNetworkMessage(data)) {
      return;
    }
    for (const listener of [...this.messageListeners]) {
      listener(data);
    }
  }
}
