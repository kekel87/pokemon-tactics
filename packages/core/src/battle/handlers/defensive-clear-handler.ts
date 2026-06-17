import { BattleEventType } from "../../enums/battle-event-type";
import type { BattleEvent } from "../../types/battle-event";
import type { BattleState } from "../../types/battle-state";
import type { PhaseResult } from "../turn-pipeline";

export function defensiveClearHandler(pokemonId: string, state: BattleState): PhaseResult {
  const pokemon = state.pokemon.get(pokemonId);
  const emptyResult: PhaseResult = {
    events: [],
    skipAction: false,
    restrictActions: false,
    pokemonFainted: false,
  };

  if (!pokemon?.activeDefense) {
    return emptyResult;
  }

  const defense = pokemon.activeDefense;
  // Protection lasts until the owner's next turn: this handler runs at the start of that turn,
  // after the action clock ticked, so a defense applied on a previous action clears now.
  const wasAppliedInPreviousTurn = defense.appliedAtAction < (state.actionCounter ?? 0);

  if (!wasAppliedInPreviousTurn) {
    return emptyResult;
  }

  const clearedEvent: BattleEvent = {
    type: BattleEventType.DefenseCleared,
    pokemonId,
    defenseKind: defense.kind,
  };

  pokemon.activeDefense = null;

  return {
    events: [clearedEvent],
    skipAction: false,
    restrictActions: false,
    pokemonFainted: false,
  };
}
