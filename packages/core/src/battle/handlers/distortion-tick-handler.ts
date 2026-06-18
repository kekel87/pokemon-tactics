import { BattleEventType } from "../../enums/battle-event-type";
import type { BattleEvent } from "../../types/battle-event";
import type { BattleState } from "../../types/battle-state";
import { decrementDistortionTimer } from "../distortion-system";
import type { PhaseResult } from "../turn-pipeline";

const EMPTY_RESULT: PhaseResult = {
  events: [],
  skipAction: false,
  restrictActions: false,
  pokemonFainted: false,
};

/**
 * Decrement the Distorsion zones posted by the acting mon (duration model "tours du lanceur": a
 * zone counts down on its caster's own turn) and emit a DistortionExpired event for each zone that
 * reached zero.
 */
export function distortionDecrementHandler(pokemonId: string, state: BattleState): PhaseResult {
  if (state.distortionZones.length === 0) {
    return EMPTY_RESULT;
  }
  const expired = decrementDistortionTimer(state, pokemonId);
  if (expired.length === 0) {
    return EMPTY_RESULT;
  }
  const events: BattleEvent[] = expired.map((entry) => ({
    type: BattleEventType.DistortionExpired,
    casterId: entry.casterId,
  }));
  return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
}
