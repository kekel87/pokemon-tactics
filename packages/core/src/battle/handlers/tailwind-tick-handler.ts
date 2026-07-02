import { BattleEventType } from "../../enums/battle-event-type";
import type { BattleEvent } from "../../types/battle-event";
import type { BattleState } from "../../types/battle-state";
import { decrementTailwindTimer } from "../tailwind-system";
import type { PhaseResult } from "../turn-pipeline";

const EMPTY_RESULT: PhaseResult = {
  events: [],
  skipAction: false,
  restrictActions: false,
  pokemonFainted: false,
};

/**
 * Decrement the active wind on its setter's own turn (mirror of the weather duration model: the CT
 * engine has no discrete rounds). Emits TailwindEnded when the wind expires.
 */
export function tailwindDecrementHandler(pokemonId: string, state: BattleState): PhaseResult {
  if (!state.tailwind) {
    return EMPTY_RESULT;
  }
  const setterId = state.tailwind.setterPokemonId;
  const expired = decrementTailwindTimer(state, pokemonId);
  if (!expired) {
    return EMPTY_RESULT;
  }
  const events: BattleEvent[] = [{ type: BattleEventType.TailwindEnded, casterId: setterId }];
  return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
}
