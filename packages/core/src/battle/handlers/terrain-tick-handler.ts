import { BattleEventType } from "../../enums/battle-event-type";
import type { PokemonType } from "../../enums/pokemon-type";
import type { TerrainType } from "../../enums/terrain-type";
import type { BattleEvent } from "../../types/battle-event";
import type { BattleState } from "../../types/battle-state";
import type { PokemonInstance } from "../../types/pokemon-instance";
import { isEffectivelyFlying } from "../effective-flying";
import type { HeldItemHandlerRegistry } from "../held-item-handler-registry";
import { isMajorStatus } from "../stat-modifier";
import { getTerrainDotFraction, getTerrainStatusOnStop, isTerrainImmune } from "../terrain-effects";
import type { PhaseHandler, PhaseResult } from "../turn-pipeline";

const EMPTY_RESULT: PhaseResult = {
  events: [],
  skipAction: false,
  restrictActions: false,
  pokemonFainted: false,
};

function applyTerrainStatus(
  pokemon: PokemonInstance,
  terrain: TerrainType,
  types: PokemonType[],
  events: BattleEvent[],
  itemRegistry?: HeldItemHandlerRegistry,
): void {
  const status = getTerrainStatusOnStop(terrain, types, isEffectivelyFlying(pokemon, types));
  if (!status) {
    return;
  }

  if (pokemon.statusEffects.some((s) => isMajorStatus(s.type))) {
    return;
  }

  const item = itemRegistry?.getForPokemon(pokemon);
  const itemBlock = item?.onTerrainTick?.({ pokemon, terrain });
  if (itemBlock?.blocked) {
    events.push(...itemBlock.events);
    return;
  }

  pokemon.statusEffects.push({ type: status, remainingTurns: null });
  events.push({
    type: BattleEventType.TerrainStatusApplied,
    pokemonId: pokemon.id,
    terrain,
    status,
  });
}

function applyTerrainDot(
  pokemon: PokemonInstance,
  terrain: TerrainType,
  types: PokemonType[],
  events: BattleEvent[],
  itemRegistry?: HeldItemHandlerRegistry,
): boolean {
  if (isTerrainImmune(terrain, types, isEffectivelyFlying(pokemon, types))) {
    return false;
  }

  const fraction = getTerrainDotFraction(terrain);
  if (!fraction) {
    return false;
  }

  const item = itemRegistry?.getForPokemon(pokemon);
  const itemBlock = item?.onTerrainTick?.({ pokemon, terrain });
  if (itemBlock?.blocked) {
    events.push(...itemBlock.events);
    return false;
  }

  const damage = Math.max(1, Math.floor(pokemon.maxHp / fraction));
  pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
  events.push({
    type: BattleEventType.TerrainDamageDealt,
    pokemonId: pokemon.id,
    terrain,
    amount: damage,
  });

  if (pokemon.currentHp <= 0) {
    events.push({ type: BattleEventType.PokemonKo, pokemonId: pokemon.id, countdownStart: 0 });
    return true;
  }
  return false;
}

export function createTerrainTickHandler(
  pokemonTypesMap: Map<string, PokemonType[]>,
  itemRegistry?: HeldItemHandlerRegistry,
): PhaseHandler {
  return (pokemonId: string, state: BattleState): PhaseResult => {
    const pokemon = state.pokemon.get(pokemonId);
    if (!pokemon || pokemon.currentHp <= 0) {
      return EMPTY_RESULT;
    }

    const tile = state.grid[pokemon.position.y]?.[pokemon.position.x];
    if (!tile) {
      return EMPTY_RESULT;
    }

    const terrain = tile.terrain;
    const types = pokemonTypesMap.get(pokemon.definitionId) ?? [];
    const events: BattleEvent[] = [];

    applyTerrainStatus(pokemon, terrain, types, events, itemRegistry);
    if (pokemon.currentHp <= 0) {
      return { events, skipAction: false, restrictActions: false, pokemonFainted: true };
    }

    const fainted = applyTerrainDot(pokemon, terrain, types, events, itemRegistry);
    return { events, skipAction: false, restrictActions: false, pokemonFainted: fainted };
  };
}
