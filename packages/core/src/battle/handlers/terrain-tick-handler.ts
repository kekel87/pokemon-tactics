import { BattleEventType } from "../../enums/battle-event-type";
import { PokemonType } from "../../enums/pokemon-type";
import type { TerrainType } from "../../enums/terrain-type";
import type { BattleEvent } from "../../types/battle-event";
import type { BattleState } from "../../types/battle-state";
import type { PokemonInstance } from "../../types/pokemon-instance";
import { getEffectiveTypes, isEffectivelyFlying, resolveBaseTypes } from "../effective-flying";
import { effectiveHeldItem } from "../effective-held-item";
import { isEffectivelyGrounded } from "../field-global-system";
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
  state: BattleState,
  pokemon: PokemonInstance,
  terrain: TerrainType,
  types: PokemonType[],
  isFlying: boolean,
  events: BattleEvent[],
  itemRegistry?: HeldItemHandlerRegistry,
): void {
  const status = getTerrainStatusOnStop(terrain, types, isFlying);
  if (!status) {
    return;
  }

  if (pokemon.statusEffects.some((s) => isMajorStatus(s.type))) {
    return;
  }

  const item = effectiveHeldItem(state, pokemon, itemRegistry);
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
  state: BattleState,
  pokemon: PokemonInstance,
  terrain: TerrainType,
  types: PokemonType[],
  isFlying: boolean,
  events: BattleEvent[],
  itemRegistry?: HeldItemHandlerRegistry,
): boolean {
  if (isTerrainImmune(terrain, types, isFlying)) {
    return false;
  }

  const fraction = getTerrainDotFraction(terrain);
  if (!fraction) {
    return false;
  }

  const item = effectiveHeldItem(state, pokemon, itemRegistry);
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
    const baseTypes = resolveBaseTypes(pokemon, pokemonTypesMap);
    const types = getEffectiveTypes(pokemon, baseTypes);
    // Gravité (zone) / Anti-Air (smack-down): a grounded mon walks on the ground and suffers its
    // terrain (swamp poison, lava, ice…). Grounding negates BOTH the airborne float (Levitate/Balloon)
    // AND the Flying type's terrain immunity — so a grounded Flying-type burns on lava like any land
    // mon. Other type resistances (Fire vs Magma, Water vs Water…) are physical and stay.
    const grounded = isEffectivelyGrounded(state, pokemon);
    const isFlying = isEffectivelyFlying(pokemon, types) && !grounded;
    const terrainTypes = grounded ? types.filter((type) => type !== PokemonType.Flying) : types;
    const events: BattleEvent[] = [];

    applyTerrainStatus(state, pokemon, terrain, terrainTypes, isFlying, events, itemRegistry);
    if (pokemon.currentHp <= 0) {
      return { events, skipAction: false, restrictActions: false, pokemonFainted: true };
    }

    const fainted = applyTerrainDot(
      state,
      pokemon,
      terrain,
      terrainTypes,
      isFlying,
      events,
      itemRegistry,
    );
    return { events, skipAction: false, restrictActions: false, pokemonFainted: fainted };
  };
}
