import { NetworkErrorCode, type NetworkMessage } from "./protocol.js";
import { type NetworkChannel, type NetworkTransport, NetworkTransportError } from "./transport.js";

/**
 * Transport en mémoire (plan 199, étape 2).
 *
 * Reproduit les deux propriétés du vrai transport dont tout le salon dépend : la prise
 * d'identifiant est **exclusive** (c'est ce qui alloue les places sans arbitre), et un canal est
 * bidirectionnel, ordonné, fiable. Il permet de faire tourner deux salons — ou douze — dans le même
 * processus, donc de tester l'allocation concurrente, les départs et le lancement accusé sans
 * réseau ni service tiers.
 *
 * La livraison est **asynchrone** (une micro-tâche), comme sur le réseau : livrer en synchrone
 * masquerait toute réentrance et laisserait passer des bogues qui n'apparaîtraient qu'en vrai.
 */
export class FakeNetworkDirectory {
  private readonly claimed = new Map<string, FakeTransport>();
  /** Adresses retenues après un départ, pour rejouer la rémanence de l'annuaire réel. */
  private readonly lingering = new Set<string>();
  private claimFailure: NetworkErrorCode | undefined;

  /**
   * Crée un transport non encore inscrit. Rien n'est réservé avant `claim`, comme chez l'annuaire
   * réel où l'identifiant se prend à l'ouverture de la connexion.
   */
  createTransport(): NetworkTransport {
    return new FakeTransport(this);
  }

  /**
   * Fait retenir une adresse comme occupée sans qu'aucun pair ne soit derrière — c'est ce que fait
   * l'annuaire réel pendant quelques secondes après une coupure. Sert à prouver que les réessais de
   * prise d'identifiant servent à quelque chose.
   */
  linger(peerId: string): void {
    this.lingering.add(peerId);
  }

  /** Libère une adresse retenue, comme l'annuaire finit par le faire. */
  release(peerId: string): void {
    this.lingering.delete(peerId);
  }

  /**
   * Fait échouer toute prise d'identifiant sur la cause donnée — l'annuaire injoignable, que la
   * rémanence ne sait pas jouer. `undefined` remet l'annuaire en état de marche.
   */
  failClaimsWith(code: NetworkErrorCode | undefined): void {
    this.claimFailure = code;
  }

  /** @internal Lève si l'annuaire a été mis en panne. */
  assertReachable(): void {
    if (this.claimFailure !== undefined) {
      throw new NetworkTransportError(this.claimFailure, "annuaire injoignable");
    }
  }

  /** @internal */
  tryClaim(peerId: string, transport: FakeTransport): boolean {
    if (this.claimed.has(peerId) || this.lingering.has(peerId)) {
      return false;
    }
    this.claimed.set(peerId, transport);
    return true;
  }

  /** @internal */
  unclaim(peerId: string): void {
    this.claimed.delete(peerId);
  }

  /** @internal */
  lookup(peerId: string): FakeTransport | undefined {
    return this.claimed.get(peerId);
  }
}

class FakeTransport implements NetworkTransport {
  private peerId: string | undefined;
  private destroyed = false;
  private readonly incomingListeners = new Set<(channel: NetworkChannel) => void>();
  private readonly channels = new Set<FakeChannel>();

  constructor(private readonly directory: FakeNetworkDirectory) {}

  async claim(peerId: string): Promise<void> {
    this.assertAlive();
    this.directory.assertReachable();
    if (!this.directory.tryClaim(peerId, this)) {
      throw new NetworkTransportError(NetworkErrorCode.SalonPlein, `id déjà pris : ${peerId}`);
    }
    this.peerId = peerId;
  }

  async connect(peerId: string): Promise<NetworkChannel> {
    this.assertAlive();
    if (this.peerId === undefined) {
      throw new NetworkTransportError(
        NetworkErrorCode.ConnexionImpossible,
        "joindre un pair avant d'avoir pris son propre identifiant",
      );
    }
    const remote = this.directory.lookup(peerId);
    if (remote === undefined) {
      throw new NetworkTransportError(NetworkErrorCode.CodeIntrouvable, `personne en ${peerId}`);
    }

    const [local, distant] = FakeChannel.pair(this.peerId, peerId);
    this.channels.add(local);
    remote.acceptIncoming(distant);
    return local;
  }

  onIncoming(listener: (channel: NetworkChannel) => void): () => void {
    this.incomingListeners.add(listener);
    return () => this.incomingListeners.delete(listener);
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    for (const channel of this.channels) {
      channel.close();
    }
    this.channels.clear();
    this.incomingListeners.clear();
    if (this.peerId !== undefined) {
      this.directory.unclaim(this.peerId);
    }
  }

  /** @internal */
  acceptIncoming(channel: FakeChannel): void {
    if (this.destroyed) {
      channel.close();
      return;
    }
    this.channels.add(channel);
    for (const listener of [...this.incomingListeners]) {
      listener(channel);
    }
  }

  private assertAlive(): void {
    if (this.destroyed) {
      throw new NetworkTransportError(NetworkErrorCode.ConnexionImpossible, "transport détruit");
    }
  }
}

class FakeChannel implements NetworkChannel {
  private peer: FakeChannel | undefined;
  private closed = false;
  private closing = false;
  private readonly messageListeners = new Set<(message: NetworkMessage) => void>();
  private readonly closeListeners = new Set<() => void>();

  private constructor(readonly remotePeerId: string) {}

  /** Les deux bouts d'un même canal. Chacun voit l'adresse de l'autre. */
  static pair(localPeerId: string, remotePeerId: string): readonly [FakeChannel, FakeChannel] {
    const local = new FakeChannel(remotePeerId);
    const distant = new FakeChannel(localPeerId);
    local.peer = distant;
    distant.peer = local;
    return [local, distant];
  }

  send(message: NetworkMessage): void {
    if (this.closed || this.closing || this.peer === undefined) {
      return;
    }
    const peer = this.peer;
    // Sérialisation aller-retour : sur le vrai transport le message traverse une structure de
    // données, donc rien de vivant (fonction, référence partagée, `Map`) ne passe. Le faire ici
    // aussi fait échouer en test ce qui échouerait en vrai.
    const delivered = JSON.parse(JSON.stringify(message)) as NetworkMessage;
    queueMicrotask(() => peer.deliver(delivered));
  }

  onMessage(listener: (message: NetworkMessage) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onClose(listener: () => void): () => void {
    this.closeListeners.add(listener);
    return () => this.closeListeners.delete(listener);
  }

  /**
   * Ferme, mais **après avoir vidé la file**. Le vrai transport ferme avec `flush` : ce qui a été
   * envoyé avant la fermeture part quand même. Fermer en synchrone ici jetterait ces messages, et le
   * premier à disparaître serait le `bye` qui précède tout départ propre — le salon prendrait alors
   * chaque départ annoncé pour un silence, et attendrait 45 s au lieu de 10.
   *
   * Les envois étant des micro-tâches déposées dans l'ordre, déposer la fermeture de la même façon
   * suffit à la faire passer derrière eux.
   */
  close(): void {
    if (this.closed || this.closing) {
      return;
    }
    this.closing = true;
    queueMicrotask(() => this.finishClose());
  }

  private finishClose(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    for (const listener of [...this.closeListeners]) {
      listener();
    }
    this.closeListeners.clear();
    this.messageListeners.clear();
    this.peer?.close();
  }

  private deliver(message: NetworkMessage): void {
    if (this.closed) {
      return;
    }
    for (const listener of [...this.messageListeners]) {
      listener(message);
    }
  }
}
