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
  /**
   * L'état qu'on lui rapporte ne concorde plus avec celui qu'il tient — sans accuser personne.
   *
   * 🔴 Nommée `StateConflict` et non `Desynced` depuis le 2026-09-16 (plan 213, lot E) : « désync »
   * est un mot de RÉSEAU, et un moteur seul ne peut pas se désynchroniser avec lui-même. Le core ne
   * connaît pas le réseau, et une valeur qui suppose deux machines n'a rien à faire dedans. Les deux
   * noms que proposait l'entrée de backlog ont été écartés : « violation » accuse, « internal »
   * suppose une machine unique. « Conflit d'état » dit ce que le moteur constate, et rien de plus.
   */
  StateConflict: "state-conflict",
} as const;

export type ForfeitReason = (typeof ForfeitReason)[keyof typeof ForfeitReason];
