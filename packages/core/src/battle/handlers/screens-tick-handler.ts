import { BattleEventType } from "../../enums/battle-event-type";
import type { BattleEvent } from "../../types/battle-event";
import { ScreenDissipatedReason } from "../../types/battle-event";
import type { BattleState } from "../../types/battle-state";
import { decrementScreensTimer } from "../screens-system";
import type { PhaseHandler, PhaseResult } from "../turn-pipeline";

const EMPTY_RESULT: PhaseResult = {
  events: [],
  skipAction: false,
  restrictActions: false,
  pokemonFainted: false,
};

export function screensTickHandler(_pokemonId: string, state: BattleState): PhaseResult {
  if (state.screens.length === 0) {
    return EMPTY_RESULT;
  }
  if (state.screensLastTickRound === state.roundNumber) {
    return EMPTY_RESULT;
  }

  state.screensLastTickRound = state.roundNumber;
  const expired = decrementScreensTimer(state);
  if (expired.length === 0) {
    return EMPTY_RESULT;
  }

  const events: BattleEvent[] = expired.map((entry) => ({
    type: BattleEventType.ScreenDissipated,
    casterId: entry.casterId,
    kind: entry.kind,
    reason: ScreenDissipatedReason.Expired,
  }));

  return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
}

export function createScreensTickHandler(): PhaseHandler {
  return (pokemonId, state) => screensTickHandler(pokemonId, state);
}
