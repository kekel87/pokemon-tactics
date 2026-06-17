import { BattleEventType } from "../../enums/battle-event-type";
import type { BattleEvent } from "../../types/battle-event";
import { AuraDissipatedReason } from "../../types/battle-event";
import type { BattleState } from "../../types/battle-state";
import { decrementAurasTimer } from "../aura-system";
import type { PhaseHandler, PhaseResult } from "../turn-pipeline";

const EMPTY_RESULT: PhaseResult = {
  events: [],
  skipAction: false,
  restrictActions: false,
  pokemonFainted: false,
};

export function aurasTickHandler(pokemonId: string, state: BattleState): PhaseResult {
  if (state.auras.length === 0) {
    return EMPTY_RESULT;
  }

  // Duration model "tours du lanceur": each aura counts down only on its caster's own turn.
  const expired = decrementAurasTimer(state, pokemonId);
  if (expired.length === 0) {
    return EMPTY_RESULT;
  }

  const events: BattleEvent[] = expired.map((entry) => ({
    type: BattleEventType.AuraDissipated,
    casterId: entry.casterId,
    kind: entry.kind,
    reason: AuraDissipatedReason.Expired,
  }));

  return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
}

export function createAurasTickHandler(): PhaseHandler {
  return (pokemonId, state) => aurasTickHandler(pokemonId, state);
}
