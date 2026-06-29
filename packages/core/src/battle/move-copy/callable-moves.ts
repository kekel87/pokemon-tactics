import { TargetingKind } from "../../enums/targeting-kind";
import type { MoveDefinition } from "../../types/move-definition";

/**
 * A metamove — one that calls, copies or morphs into another move (Métronome, Blabla Dodo, Mimique,
 * Photocopie, Force Nature). Never callable by a random caller: anti-recursion.
 */
function isMetamove(move: MoveDefinition): boolean {
  return move.callMove !== undefined || move.naturePowerMorph === true;
}

/**
 * Whether Métronome (random-all) may roll this move. Excludes:
 *  - metamoves (anti-recursion);
 *  - two-turn charge moves (un-resolvable in the single placement of the called move);
 *  - Hit & Run (would need a retreat tile, outside the call-move flow);
 *  - sleep-gated (`requiresAsleep`, e.g. Ronflement) and Last-Resort-gated moves whose precondition
 *    the random caller cannot satisfy.
 * Moves with softer preconditions (eaten berry / flingable item / user type) stay callable: they
 * simply fizzle gracefully if their precondition is unmet.
 */
export function isMetronomeCallable(move: MoveDefinition): boolean {
  if (isMetamove(move)) {
    return false;
  }
  if (move.twoTurnCharge === true) {
    return false;
  }
  if (move.targeting.kind === TargetingKind.HitAndRun) {
    return false;
  }
  if (move.requiresAsleep === true) {
    return false;
  }
  if (move.requiresAllOtherMovesUsed === true) {
    return false;
  }
  return true;
}

/**
 * Whether Blabla Dodo (random-own-asleep) may roll this move from the user's own moveset. Same
 * structural exclusions as Métronome — notably Ronflement (`requiresAsleep`) and Blabla Dodo itself
 * (a metamove) are excluded, matching canon sleep-talk.
 */
export function isSleepTalkCallable(move: MoveDefinition): boolean {
  return isMetronomeCallable(move);
}
