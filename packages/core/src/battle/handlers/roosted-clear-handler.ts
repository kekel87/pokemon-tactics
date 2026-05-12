import { StatusType } from "../../enums/status-type";
import type { BattleState } from "../../types/battle-state";
import type { PhaseHandler, PhaseResult } from "../turn-pipeline";

const EMPTY_RESULT: PhaseResult = {
  events: [],
  skipAction: false,
  restrictActions: false,
  pokemonFainted: false,
};

export const roostedClearHandler: PhaseHandler = (
  pokemonId: string,
  state: BattleState,
): PhaseResult => {
  const pokemon = state.pokemon.get(pokemonId);
  if (!pokemon) {
    return EMPTY_RESULT;
  }
  const before = pokemon.volatileStatuses.length;
  pokemon.volatileStatuses = pokemon.volatileStatuses.filter((v) => v.type !== StatusType.Roosted);
  if (pokemon.volatileStatuses.length === before) {
    return EMPTY_RESULT;
  }
  return EMPTY_RESULT;
};
