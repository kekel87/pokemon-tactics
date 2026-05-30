import { BattleEventType } from "../../enums/battle-event-type";
import { StatusType } from "../../enums/status-type";
import type { BattleEvent } from "../../types/battle-event";
import type { BattleState } from "../../types/battle-state";
import type { PhaseHandler, PhaseResult } from "../turn-pipeline";

export const tauntTickHandler: PhaseHandler = (
  pokemonId: string,
  state: BattleState,
): PhaseResult => {
  const pokemon = state.pokemon.get(pokemonId);
  const events: BattleEvent[] = [];

  if (!pokemon) {
    return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
  }

  const tauntIndex = pokemon.volatileStatuses.findIndex((v) => v.type === StatusType.Taunted);
  if (tauntIndex === -1) {
    return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
  }

  const taunt = pokemon.volatileStatuses[tauntIndex];
  if (!taunt) {
    return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
  }

  taunt.remainingTurns--;

  if (taunt.remainingTurns <= 0) {
    pokemon.volatileStatuses.splice(tauntIndex, 1);
    events.push({
      type: BattleEventType.StatusRemoved,
      targetId: pokemonId,
      status: StatusType.Taunted,
    });
  }

  return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
};
