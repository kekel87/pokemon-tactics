import type { ForfeitReason } from "../enums/forfeit-reason";

/**
 * Un camp qui a quitté la partie, à sa place dans le journal (plan 243).
 *
 * Un abandon n'est pas une `Action` : il n'attend pas son tour. On le range donc à part, avec le
 * nombre d'actions déjà appliquées quand il est survenu — c'est tout ce qu'il faut pour le rejouer au
 * même instant.
 */
export interface ReplayForfeit {
  /** Nombre d'actions appliquées au moment de l'abandon. */
  afterAction: number;
  playerId: string;
  reason?: ForfeitReason;
}
