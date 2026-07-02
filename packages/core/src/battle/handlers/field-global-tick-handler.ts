import { BattleEventType } from "../../enums/battle-event-type";
import type { BattleEvent } from "../../types/battle-event";
import type { BattleState } from "../../types/battle-state";
import { decrementFieldGlobalTimer } from "../field-global-system";
import type { PhaseResult } from "../turn-pipeline";

const EMPTY_RESULT: PhaseResult = {
  events: [],
  skipAction: false,
  restrictActions: false,
  pokemonFainted: false,
};

/**
 * Decrement the field-global zones posted by the acting mon (duration model "tours du lanceur": a
 * zone counts down on its caster's own turn) and emit a FieldGlobalExpired event for each zone that
 * reached zero.
 */
export function fieldGlobalDecrementHandler(pokemonId: string, state: BattleState): PhaseResult {
  if (state.fieldGlobalZones.length === 0) {
    return EMPTY_RESULT;
  }
  const expired = decrementFieldGlobalTimer(state, pokemonId);
  if (expired.length === 0) {
    return EMPTY_RESULT;
  }
  const events: BattleEvent[] = expired.map((entry) => ({
    type: BattleEventType.FieldGlobalExpired,
    casterId: entry.casterId,
    kind: entry.kind,
  }));
  return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
}
