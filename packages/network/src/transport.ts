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

/** Un canal ouvert vers un pair. Bidirectionnel, ordonné, fiable. */
export interface NetworkChannel {
  readonly remotePeerId: string;
  send(message: NetworkMessage): void;
  /** @returns de quoi se désabonner. */
  onMessage(listener: (message: NetworkMessage) => void): () => void;
  /** Fermeture, propre ou non. Le salon distingue les deux par le message `bye` qui précède. */
  onClose(listener: () => void): () => void;
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
      // Seule la place occupée vaut un réessai : elle peut être un fantôme. Un annuaire injoignable
      // ne guérira pas en 400 ms, et insister ne ferait que retarder le message au joueur.
      if (!(error instanceof NetworkTransportError && error.code === NetworkErrorCode.SalonPlein)) {
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
