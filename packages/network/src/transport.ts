import { NetworkErrorCode, type NetworkMessage } from "./protocol.js";

/**
 * Le contrat de transport (plan 199, étape 2). Deux mises en œuvre : `peer-connection.ts` par-dessus
 * `peerjs`, et `fake-transport.ts`, un canal en mémoire.
 *
 * Le canal factice n'est pas un artifice de test : c'est lui qui rend le salon et le lancement
 * testables **sans réseau**, donc sans dépendre d'un service tiers qui n'a aucun engagement de
 * service. Tout ce que le salon sait faire, il sait le faire sur les deux.
 */

/** Une erreur de transport porte toujours une cause de l'énumération fermée — jamais de texte libre. */
export class NetworkTransportError extends Error {
  constructor(
    readonly code: NetworkErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "NetworkTransportError";
  }
}

/**
 * Santé d'un canal, telle que **le navigateur** la juge (plan 202, Lot B3, décision #956).
 *
 * Énumération fermée, comme les causes de refus. Elle ne vient pas d'un battement de cœur qu'on
 * aurait écrit : WebRTC en fait déjà un, gratuitement. ICE Consent Freshness (RFC 7675) émet une
 * requête STUN toutes les 5 à 15 s sur le chemin établi, ce qui maintient au passage la
 * correspondance NAT que les box réclament après 30 à 60 s de silence — une fenêtre dans laquelle un
 * tour de 60 s sans un seul paquet applicatif tombe tout à fait.
 *
 * 🔴 **`Uncertain` ne prononce aucun forfait.** Une connexion `disconnected` se rétablit très
 * souvent d'elle-même, et éliminer quelqu'un sur un rétablissable serait pire que d'attendre. Ce
 * signal sert à *dire* au joueur que quelque chose se passe, cinq secondes après la coupure au lieu
 * de soixante-quinze ; le verdict reste au chien de garde du salon.
 */
export const ChannelHealth = {
  /** Le chemin répond. */
  Healthy: "healthy",
  /** Plus de réponse, mais ICE réessaie encore — souvent passager. */
  Uncertain: "uncertain",
  /** ICE a renoncé. Le canal ne reviendra pas de lui-même. */
  Failed: "failed",
} as const;

export type ChannelHealth = (typeof ChannelHealth)[keyof typeof ChannelHealth];

/** Un canal ouvert vers un pair. Bidirectionnel, ordonné, fiable. */
export interface NetworkChannel {
  readonly remotePeerId: string;
  send(message: NetworkMessage): void;
  /** @returns de quoi se désabonner. */
  onMessage(listener: (message: NetworkMessage) => void): () => void;
  /** Fermeture, propre ou non. Le salon distingue les deux par le message `bye` qui précède. */
  onClose(listener: () => void): () => void;
  /**
   * L'état du chemin ICE a changé (plan 202). Purement informatif — voir `ChannelHealth`.
   *
   * @returns de quoi se désabonner.
   */
  onHealthChange(listener: (health: ChannelHealth) => void): () => void;
  close(): void;
}

export interface NetworkTransport {
  /**
   * Prend l'identifiant chez l'annuaire. **C'est le mécanisme d'allocation de place** : le refus de
   * l'annuaire (`salon_plein` remonté comme identifiant déjà pris) est ce qui empêche deux arrivants
   * simultanés d'obtenir la même place, sans qu'aucun arbitre ne coordonne.
   *
   * @throws NetworkTransportError `salon_plein` si l'identifiant est déjà pris, `connexion_impossible`
   * si l'annuaire est injoignable.
   */
  claim(peerId: string): Promise<void>;
  /**
   * Joint un pair.
   *
   * @throws NetworkTransportError `code_introuvable` si personne n'est à cette adresse,
   * `connexion_impossible` si la traversée de pare-feu échoue, `delai_depasse` sinon.
   */
  connect(peerId: string): Promise<NetworkChannel>;
  /** Les canaux entrants. Le maillage veut que tout le monde accepte tout le monde. */
  onIncoming(listener: (channel: NetworkChannel) => void): () => void;
  destroy(): void;
}

/**
 * Les délais du transport, au même endroit pour qu'on ne les redécouvre pas éparpillés.
 *
 * Les réessais de prise d'identifiant existent parce que l'annuaire **retient l'ancienne adresse
 * quelques secondes** après une coupure : sans eux, un joueur qui recharge sa page se verrait
 * refuser sa propre place, et un salon qu'on recrée juste après en avoir quitté un se croirait
 * plein. C'est une réserve à traiter dans le code, pas à découvrir en recette.
 */
export const CLAIM_RETRY_DELAYS_MS = [400, 1_200, 3_000] as const;

/**
 * Réessais de la RECONNEXION, plus patients que ceux de la création (plan 202).
 *
 * 🔴 **Chiffres MESURÉS le 2026-09-09 contre le service public de PeerJS**, pas supposés — la
 * mesure a fait tomber deux hypothèses fausses au passage (voir plus bas) :
 *
 * | Comment le pair est parti | Délai avant que son adresse soit libre |
 * |---|---|
 * | proprement (fermeture avec poignée de main) | **110 ms** |
 * | brutalement (socket tuée sans un mot) | **99 s** |
 *
 * D'où ce barème d'environ **15 s** : il couvre confortablement le départ propre, y compris avec un
 * réseau lent et un serveur qui traîne. Il ne couvre **pas** le départ brutal, et c'est un choix —
 * pas un manque de patience. À 99 s, le pair d'en face aura de toute façon prononcé le forfait
 * (75 s de silence au maximum) : insister plus longtemps ne ramènerait personne dans une partie qui
 * n'existe plus, et ferait seulement patienter le joueur devant un bouton mort.
 *
 * **Conséquence assumée, documentée dans `docs/multiplayer.md`** : un HÔTE dont l'onglet est tué net
 * — sans que son `bye` ne parte — ne peut pas revenir. Il doit récupérer une adresse **précise**, le
 * code de salon étant son adresse (#904), là où le reste du jeu s'en accommode. Le cas ne touche que
 * l'hôte, et seulement quand le navigateur ne laisse pas partir le message de départ.
 *
 * ⚠️ Deux hypothèses que la mesure a **infirmées**, à ne pas ressusciter : il n'y a **aucune
 * limitation par IP** (25 prises d'adresse d'affilée sans un refus), donc jouer à deux depuis la
 * même machine n'y est pour rien ; et un barème serré (13 essais en 53 s) rendait les choses
 * **pires** — les sockets se gênaient entre elles côté client et le refus devenait « connexion
 * impossible » au lieu de « place occupée ».
 *
 * Pourquoi ne pas simplement allonger `CLAIM_RETRY_DELAYS_MS` : la création d'un salon a besoin de
 * refuser **vite** — « salon plein » y est une réponse plausible, et faire patienter avant de
 * l'annoncer serait pire que le fantôme qu'on cherche à absorber. Sur une reconnexion au contraire,
 * « occupé » ne peut être QUE nous-même.
 */
export const REJOIN_RETRY_DELAYS_MS = [500, 1_500, 3_000, 5_000, 5_000] as const;

/** Au-delà, on considère que l'annuaire ou le pair ne répondra pas. */
export const CONNECT_TIMEOUT_MS = 15_000;

/**
 * Prend une adresse dont on **s'attend à être le titulaire** : l'hôte qui crée son salon, ou celui
 * qui revient réclamer la place qu'il occupait. Réessaie avec un délai croissant avant de conclure
 * qu'elle est occupée, parce que l'annuaire retient l'ancienne adresse quelques secondes après une
 * coupure — sans ces réessais, recharger sa page suffirait à se voir refuser sa propre place.
 *
 * 🔴 **À ne pas utiliser pour balayer les places d'un salon.** Un arrivant qui cherche une place
 * libre essaie `-2`, puis `-3`, etc. : là, « occupée » est la réponse **normale** et attendue, pas
 * un symptôme de rémanence. Réessayer chaque place occupée ajouterait plusieurs secondes par place
 * avant même de tenter la suivante — un salon à 12 dont les 6 premières places sont prises
 * mettrait une demi-minute à laisser entrer. Cette fonction est donc réservée à l'identité propre,
 * où le seul « occupé » plausible est un fantôme de soi-même.
 */
export async function claimOwnIdentity(
  transport: NetworkTransport,
  peerId: string,
  sleep: (delayMs: number) => Promise<void>,
  retryDelaysMs: readonly number[] = CLAIM_RETRY_DELAYS_MS,
  /**
   * Réessayer aussi les refus **transitoires** (annuaire injoignable, délai dépassé) et pas seulement
   * la place occupée. Réservé à la RECONNEXION : un hoquet du service ne doit pas y coûter la partie,
   * alors qu'à la création une seule tentative suffit — le joueur n'a rien à perdre, il recommence.
   */
  retryTransient = false,
): Promise<void> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    if (attempt > 0) {
      await sleep(retryDelaysMs[attempt - 1] ?? 0);
    }
    try {
      await transport.claim(peerId);
      return;
    } catch (error) {
      lastError = error;
      /*
       * Ce qui vaut un réessai.
       *
       * « Place occupée » d'abord : elle peut être un fantôme de nous-même, et c'est le cas d'usage
       * d'origine.
       *
       * Et, depuis la recette du 2026-09-09, les deux causes **transitoires** — mais seulement quand
       * l'appelant a demandé un barème patient, c'est-à-dire sur une RECONNEXION. Motif : un service
       * public sollicité plusieurs fois de suite répond parfois autre chose que « occupé » (socket
       * refusée, limitation de débit), et abandonner là-dessus fait perdre une partie en cours pour
       * un hoquet. À la création d'un salon, au contraire, une seule tentative suffit à dire au
       * joueur que ça ne marche pas : il n'a rien à perdre, il peut recommencer.
       */
      const retryable =
        error instanceof NetworkTransportError &&
        (error.code === NetworkErrorCode.SalonPlein ||
          (retryTransient &&
            (error.code === NetworkErrorCode.ConnexionImpossible ||
              error.code === NetworkErrorCode.DelaiDepasse)));
      if (!retryable) {
        throw error;
      }
    }
  }

  throw lastError;
}

/**
 * Traduit une cause de `peerjs` vers l'énumération fermée. Les libellés viennent de `PeerErrorType`
 * (confirmé sur `peerjs@1.5.5` le 2026-09-04).
 *
 * Seules deux causes veulent un message distinct : `peer-unavailable`, le code mal recopié (personne
 * à cette adresse), et `unavailable-id`, la place déjà prise. **Tout le reste** — annuaire
 * injoignable, socket fermée, traversée de pare-feu échouée, navigateur incompatible — se dit
 * « connexion impossible » au joueur, parce qu'il n'y a rien qu'il puisse faire de différent selon
 * le cas, et parce qu'une énumération qui suit celle de la bibliothèque nous obligerait à traduire
 * chaque cause qu'une version future ajoutera.
 */
export function networkErrorCodeFromPeerError(peerErrorType: string): NetworkErrorCode {
  switch (peerErrorType) {
    case "peer-unavailable":
      return NetworkErrorCode.CodeIntrouvable;
    case "unavailable-id":
      return NetworkErrorCode.SalonPlein;
    default:
      return NetworkErrorCode.ConnexionImpossible;
  }
}
