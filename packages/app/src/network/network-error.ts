import { NetworkErrorCode } from "@pokemon-tactic/network";

/**
 * Les causes qu'un joueur peut corriger en réessayant sur place — code mal recopié, partie pleine,
 * partie déjà lancée, pair muet.
 *
 * Les deux autres (`VersionIncompatible`, `ConnexionImpossible`) ne se corrigent PAS ici : l'une
 * demande de recharger la page, l'autre tient à la traversée de pare-feu entre deux réseaux.
 * Proposer « Réessayer » y serait une invitation à refaire en vain ce qui vient d'échouer.
 */
const RETRYABLE_REFUSALS: ReadonlySet<NetworkErrorCode> = new Set([
  NetworkErrorCode.CodeIntrouvable,
  NetworkErrorCode.SalonPlein,
  NetworkErrorCode.PartieCommencee,
  NetworkErrorCode.DelaiDepasse,
]);

/**
 * Le refus se corrige-t-il en réessayant ? C'est ce qui décide du bouton de la modale de refus
 * (plan 207, étape 5) : « Réessayer » ou « Retour au menu ».
 *
 * 🔴 Vit **ici et non dans la modale**, et c'est le correctif d'un trou de couverture relevé par
 * `test-writer` : tant que la règle était enfermée dans `join-refusal-modal.ts`, elle n'avait
 * **aucun test**. Deux des six causes sont hors d'atteinte de l'e2e — `VersionIncompatible` exige un
 * pair dont le `NETWORK_VERSION` diffère, `ConnexionImpossible` est un repli non provocable depuis
 * un navigateur — et le dépôt n'a pas de jsdom pour tester du code qui touche le DOM. Sortie dans ce
 * module sans DOM, la table entière se couvre en unitaire pour rien.
 */
export function isRetryableRefusal(code: NetworkErrorCode): boolean {
  return RETRYABLE_REFUSALS.has(code);
}

/**
 * Ramène n'importe quelle erreur à l'énumération **fermée** des causes de refus.
 *
 * 🔴 Ce garde-fou manquait au plan 199 : la version d'avant faisait confiance à tout objet portant
 * un `code` et le transtypait de force. Or un `DOMException` en porte un **numérique** — et c'est
 * ainsi qu'un joueur a lu « room.error.12 » à l'écran, une clé de traduction qui n'existe pas.
 *
 * Partagé depuis le plan 202 (étape 5) : la reprise d'une partie en ligne échoue par les mêmes
 * causes que l'entrée dans un salon, et le même message doit lui répondre. Vivait jusqu'ici dans
 * `team-select-screen.ts`, où il était le seul appelant.
 */
export function networkErrorCodeOf(error: unknown): NetworkErrorCode {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code: unknown }).code
      : undefined;
  const known = Object.values(NetworkErrorCode).find((candidate) => candidate === code);
  if (known !== undefined) {
    return known;
  }
  // biome-ignore lint/suspicious/noConsole: diagnostic uniquement — le joueur voit un message générique quoi qu'il arrive, et c'est la seule trace d'une cause de refus que l'énumération fermée ne connaît pas. Son absence est exactement ce qui a caché le bug d'annuaire du plan 201, où la seule chose visible était « room.error.12 » à l'écran.
  console.warn("[réseau] cause de refus imprévue, ramenée à « connexion impossible »", error);
  return NetworkErrorCode.ConnexionImpossible;
}
