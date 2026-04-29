import { BattleEventType } from "../enums/battle-event-type";
import { StatName } from "../enums/stat-name";
import { StatusType } from "../enums/status-type";
import type { BattleEvent } from "../types/battle-event";
import type { BattleState } from "../types/battle-state";
import type { PokemonInstance } from "../types/pokemon-instance";

function chebyshevDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function isSourceGone(sourceId: string, state: BattleState): boolean {
  const source = state.pokemon.get(sourceId);
  return !source || source.currentHp <= 0;
}

function isSourceNoLongerAdjacent(
  pokemon: PokemonInstance,
  sourceId: string,
  state: BattleState,
): boolean {
  const source = state.pokemon.get(sourceId);
  if (!source || source.currentHp <= 0) {
    return true;
  }
  return chebyshevDistance(pokemon.position, source.position) > 1;
}

function processIntimidated(pokemon: PokemonInstance, state: BattleState): BattleEvent[] {
  const events: BattleEvent[] = [];

  for (let i = pokemon.volatileStatuses.length - 1; i >= 0; i--) {
    const status = pokemon.volatileStatuses[i];
    if (!status || status.type !== StatusType.Intimidated || !status.sourceId) {
      continue;
    }

    if (!isSourceNoLongerAdjacent(pokemon, status.sourceId, state)) {
      continue;
    }

    pokemon.volatileStatuses.splice(i, 1);

    if (status.statChangeApplied) {
      const currentStage = pokemon.statStages[StatName.Attack];
      if (currentStage < 6) {
        pokemon.statStages[StatName.Attack] = Math.min(6, currentStage + 1);
        events.push({
          type: BattleEventType.StatChanged,
          targetId: pokemon.id,
          stat: StatName.Attack,
          stages: 1,
        });
      }
    }
  }

  return events;
}

function processInfatuated(pokemon: PokemonInstance, state: BattleState): BattleEvent[] {
  const events: BattleEvent[] = [];

  for (let i = pokemon.volatileStatuses.length - 1; i >= 0; i--) {
    const status = pokemon.volatileStatuses[i];
    if (!status || status.type !== StatusType.Infatuated || !status.sourceId) {
      continue;
    }

    if (!isSourceNoLongerAdjacent(pokemon, status.sourceId, state)) {
      continue;
    }

    pokemon.volatileStatuses.splice(i, 1);
    events.push({
      type: BattleEventType.StatusRemoved,
      targetId: pokemon.id,
      status: StatusType.Infatuated,
    });
  }

  return events;
}

function processPositionLinkedTrapped(pokemon: PokemonInstance, state: BattleState): BattleEvent[] {
  const events: BattleEvent[] = [];

  for (let i = pokemon.volatileStatuses.length - 1; i >= 0; i--) {
    const status = pokemon.volatileStatuses[i];
    // Position-linked traps use remainingTurns === -1 and always have a sourceId (magnet-pull source)
    if (
      !status ||
      status.type !== StatusType.Trapped ||
      status.remainingTurns !== -1 ||
      !status.sourceId
    ) {
      continue;
    }

    if (
      !isSourceGone(status.sourceId, state) &&
      !isSourceNoLongerAdjacent(pokemon, status.sourceId, state)
    ) {
      continue;
    }

    pokemon.volatileStatuses.splice(i, 1);
    events.push({
      type: BattleEventType.StatusRemoved,
      targetId: pokemon.id,
      status: StatusType.Trapped,
    });
  }

  return events;
}

export function checkPositionLinkedStatuses(state: BattleState): BattleEvent[] {
  const events: BattleEvent[] = [];

  for (const pokemon of state.pokemon.values()) {
    if (pokemon.currentHp <= 0) {
      continue;
    }
    events.push(...processIntimidated(pokemon, state));
    events.push(...processInfatuated(pokemon, state));
    events.push(...processPositionLinkedTrapped(pokemon, state));
  }

  return events;
}
