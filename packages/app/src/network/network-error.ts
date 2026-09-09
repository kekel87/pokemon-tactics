import { NetworkErrorCode } from "@pokemon-tactic/network";

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
