import { Listeners } from "./listeners.js";
import { NetworkErrorCode } from "./protocol.js";
import {
  type ConnectOptions,
  type NetworkChannel,
  type NetworkTransport,
  NetworkTransportError,
} from "./transport.js";

/**
 * La cascade **direct → relais** (plan 216, bug 1).
 *
 * 🔴 **Pourquoi c'est une enveloppe et pas une branche dans le salon.** `RoomDeps.transport`
 * (`room-types.ts`) est **un seul** `NetworkTransport`, injecté par l'application : le salon ne
 * construit pas son transport, il le reçoit. Poser le repli ici a une conséquence qui vaut tout le
 * reste — **le salon ne voit pas la différence**. Il reçoit des `NetworkChannel` et ignore d'où ils
 * sortent, donc aucune de ses règles n'a à connaître l'existence d'un relais.
 *
 * 🔴 **Le direct reste la règle.** Le pair-à-pair est gratuit, plus rapide, et ne fait transiter les
 * actions par personne. Le relais ne sert qu'aux liens que la traversée n'a pas su établir — ce qui,
 * avant ce plan, était simplement la fin de la partie.
 */

/**
 * Les causes qui justifient d'essayer le relais. **Liste fermée, et c'est important.**
 *
 * `SalonPlein` ou `VersionIncompatible` sont des refus *délibérés* de l'autre bout : réessayer par
 * un autre chemin ne changerait rien et ferait perdre au joueur le message qui explique son refus.
 * Seul l'échec de *mise en relation* mérite un second chemin.
 */
const FALLBACK_CAUSES: ReadonlySet<NetworkErrorCode> = new Set([
  NetworkErrorCode.ConnexionImpossible,
  NetworkErrorCode.DelaiDepasse,
]);

export interface FallbackTransportOptions {
  /** Le transport direct. C'est lui qui prend l'identifiant, et lui qui est tenté en premier. */
  direct: NetworkTransport;
  /**
   * Le transport de repli. `undefined` quand aucun relais n'est configuré — le comportement retombe
   * alors exactement sur celui d'avant ce plan.
   */
  relay?: NetworkTransport;
  /** Prévenu quand un canal a dû passer par le relais. Branché sur la télémétrie par l'application. */
  onRelayUsed?: () => void;
}

export class FallbackTransport implements NetworkTransport {
  private destroyed = false;
  private relayReady = false;
  /**
   * 🔴 **Un seul point de diffusion pour les canaux entrants des deux chemins.**
   *
   * La première version gardait un `Set` d'auditeurs à rebrancher sur le relais quand il naissait,
   * et **jetait les fonctions de désabonnement** obtenues à ce moment-là : l'auditeur du salon —
   * une fermeture qui retient le `Room` entier — restait alors joignable et **continuait d'être
   * appelé** après que le salon eut été quitté. Ici les deux transports alimentent le même
   * `Listeners`, et l'appelant reçoit une seule fonction qui coupe vraiment.
   */
  private readonly incoming = new Listeners<[channel: NetworkChannel]>();

  constructor(private readonly options: FallbackTransportOptions) {
    options.direct.onIncoming((channel) => this.incoming.emit(channel));
    options.relay?.onIncoming((channel) => this.incoming.emit(channel));
  }

  /**
   * 🔴 **Le direct SEUL attribue la place ; le relais, lui, s'y ANNONCE.**
   *
   * La prise d'identifiant chez l'annuaire **est** le mécanisme d'allocation de place : son refus
   * est ce qui empêche deux arrivants d'obtenir la même (`transport.ts`, doc de `claim`). Le relais
   * n'arbitre rien — mais il doit savoir qui nous sommes, et ouvrir sa socket **maintenant**.
   *
   * Pourquoi maintenant et pas au premier repli : dans `room.ts`, seul l'invité compose. L'hôte est
   * passif et n'appelle jamais `connect`. Un relais qui naîtrait d'un `connect` raté n'existerait
   * donc **jamais côté hôte**, et les enveloppes de l'invité tomberaient dans le vide. `claim()` est
   * le seul point que les deux bouts traversent.
   *
   * ⚠️ Un relais injoignable **ne doit pas empêcher de jouer** : son échec est avalé, et on repart
   * sur le direct seul, c'est-à-dire l'état d'avant ce plan. Même règle que le registre des salons.
   *
   * 🔴 **Et il ne doit pas non plus FAIRE ATTENDRE.** On n'attend pas sa socket : elle s'ouvre en
   * fond, `relayReady` bascule quand elle est prête. Sinon un Worker injoignable — pare-feu
   * d'entreprise qui bloque `wss:`, portail captif, panne Cloudflare — imposait son délai d'ouverture
   * à **chaque** création et chaque arrivée, y compris quand le direct marchait parfaitement. Un
   * chemin de secours qui ralentit le chemin nominal est un mauvais marché, et l'humain a déjà
   * arbitré contre ce genre d'attente le 2026-09-15.
   */
  async claim(peerId: string): Promise<void> {
    await this.options.direct.claim(peerId);
    const relay = this.options.relay;
    if (relay === undefined) {
      return;
    }
    void relay
      .claim(peerId)
      .then(() => {
        this.relayReady = !this.destroyed;
      })
      .catch(() => {
        this.relayReady = false;
      });
  }

  async connect(peerId: string, options?: ConnectOptions): Promise<NetworkChannel> {
    try {
      return await this.options.direct.connect(peerId, options);
    } catch (error) {
      if (!this.shouldFallBack(error, options)) {
        throw error;
      }
      const channel = await this.options.relay?.connect(peerId, options);
      if (channel === undefined) {
        // Pas de relais utilisable : on rend la cause d'origine, pas une cause inventée.
        throw error;
      }
      this.options.onRelayUsed?.();
      return channel;
    }
  }

  onIncoming(listener: (channel: NetworkChannel) => void): () => void {
    return this.incoming.subscribe(listener);
  }

  destroy(options?: { abandon?: boolean }): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    // Les DEUX, toujours : un relais laissé ouvert garderait une WebSocket vivante vers le Worker,
    // donc une place occupée du point de vue des autres joueurs.
    this.options.direct.destroy(options);
    this.options.relay?.destroy(options);
    this.incoming.clear();
  }

  private shouldFallBack(error: unknown, options?: ConnectOptions): boolean {
    if (this.destroyed || !this.relayReady) {
      return false;
    }
    /*
     * 🔴 **Le registre a déjà dit que personne ne tient ce code : on n'insiste pas.**
     *
     * Sans ce refus, une faute de frappe coûtait DEUX attentes. Un Durable Object existe pour
     * n'importe quel code syntaxiquement valide, donc le relais ouvre sa socket avec succès et rend
     * un canal — puis c'est `HANDSHAKE_TIMEOUT_MS` (10 s) de silence qui tranche, APRÈS les 8 s du
     * direct. Soit ~18 s là où l'humain avait explicitement arbitré 8 s le 2026-09-15, en jugeant 15 s
     * « beaucoup trop ». Aucun transport ne peut faire apparaître un pair qui n'existe pas.
     */
    if (options?.relay === false) {
      return false;
    }
    return error instanceof NetworkTransportError && FALLBACK_CAUSES.has(error.code);
  }
}
