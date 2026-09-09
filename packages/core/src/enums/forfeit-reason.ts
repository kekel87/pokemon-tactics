/**
 * Pourquoi un camp a quitté la partie (plan 202, retour de recette 2026-09-09).
 *
 * 🔴 **Le moteur la transporte, il ne l'interprète pas.** `forfeit()` se comporte exactement pareil
 * dans les trois cas — toute l'équipe tombe — mais l'événement doit dire *laquelle*, sinon le journal
 * de combat ne peut rien en faire : il affichait « les parties ne concordent plus » pour un joueur
 * qui venait simplement d'appuyer sur « Abandonner ».
 *
 * Trois valeurs et non les causes réseau de `NetworkForfeitReason` : celles-là sont un vocabulaire de
 * protocole (`diverged`, `absent`, `resigned`) et n'ont rien à faire dans le moteur. Ce sont deux
 * énumérations fermées que l'application traduit l'une vers l'autre, à un seul endroit.
 */
export const ForfeitReason = {
  /** Le joueur a choisi d'abandonner. */
  Resigned: "resigned",
  /** Sa connexion s'est perdue et il n'est pas revenu. */
  Disconnected: "disconnected",
  /** Les deux moteurs ne racontent plus la même partie — sans accuser personne. */
  Desynced: "desynced",
} as const;

export type ForfeitReason = (typeof ForfeitReason)[keyof typeof ForfeitReason];
