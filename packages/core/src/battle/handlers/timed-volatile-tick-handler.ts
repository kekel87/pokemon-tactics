import { BattleEventType } from "../../enums/battle-event-type";
import { StatusType } from "../../enums/status-type";
import type { BattleEvent } from "../../types/battle-event";
import type { BattleState } from "../../types/battle-state";
import type { PhaseHandler, PhaseResult } from "../turn-pipeline";

const TIMED_VOLATILES = [StatusType.Taunted, StatusType.Disabled, StatusType.Encored] as const;

export const timedVolatileTickHandler: PhaseHandler = (
  pokemonId: string,
  state: BattleState,
): PhaseResult => {
  const pokemon = state.pokemon.get(pokemonId);
  const events: BattleEvent[] = [];

  if (!pokemon) {
    return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
  }

  for (const type of TIMED_VOLATILES) {
    const index = pokemon.volatileStatuses.findIndex((v) => v.type === type);
    if (index === -1) {
      continue;
    }
    const volatileStatus = pokemon.volatileStatuses[index];
    if (!volatileStatus) {
      continue;
    }

    if (
      type === StatusType.Encored &&
      volatileStatus.moveId !== undefined &&
      (pokemon.currentPp[volatileStatus.moveId] ?? 0) <= 0
    ) {
      pokemon.volatileStatuses.splice(index, 1);
      events.push({ type: BattleEventType.StatusRemoved, targetId: pokemonId, status: type });
      continue;
    }

    volatileStatus.remainingTurns--;
    if (volatileStatus.remainingTurns <= 0) {
      pokemon.volatileStatuses.splice(index, 1);
      events.push({ type: BattleEventType.StatusRemoved, targetId: pokemonId, status: type });
    }
  }

  return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
};
