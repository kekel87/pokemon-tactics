import type { PokemonType as PokemonTypeValue } from "../enums/pokemon-type";
import { PokemonType } from "../enums/pokemon-type";
import { StatusType } from "../enums/status-type";
import { TerrainType } from "../enums/terrain-type";

const TERRAIN_IMMUNE_TYPES: Partial<Record<TerrainType, readonly PokemonTypeValue[]>> = {
  [TerrainType.TallGrass]: [PokemonType.Flying],
  [TerrainType.Water]: [PokemonType.Water, PokemonType.Flying],
  [TerrainType.DeepWater]: [PokemonType.Water, PokemonType.Flying],
  [TerrainType.Magma]: [PokemonType.Fire, PokemonType.Flying],
  [TerrainType.Lava]: [PokemonType.Fire, PokemonType.Flying],
  [TerrainType.Ice]: [PokemonType.Ice, PokemonType.Flying],
  [TerrainType.Sand]: [PokemonType.Ground, PokemonType.Flying],
  [TerrainType.Snow]: [PokemonType.Ice, PokemonType.Flying],
  [TerrainType.Swamp]: [PokemonType.Poison, PokemonType.Flying],
};

export function isTerrainImmune(terrain: TerrainType, types: PokemonTypeValue[]): boolean {
  const immuneTypes = TERRAIN_IMMUNE_TYPES[terrain];
  if (!immuneTypes) {
    return false;
  }
  return types.some((t) => immuneTypes.includes(t));
}

const MOVEMENT_PENALTY: Partial<Record<TerrainType, number>> = {
  [TerrainType.Water]: 1,
  [TerrainType.Sand]: 1,
  [TerrainType.Snow]: 1,
  [TerrainType.Swamp]: 2,
};

export function getMovementPenalty(terrain: TerrainType, types: PokemonTypeValue[]): number {
  if (isTerrainImmune(terrain, types)) {
    return 0;
  }
  return MOVEMENT_PENALTY[terrain] ?? 0;
}

const TERRAIN_TYPE_BONUS: Partial<Record<TerrainType, PokemonTypeValue>> = {
  [TerrainType.Water]: PokemonType.Water,
  [TerrainType.DeepWater]: PokemonType.Water,
  [TerrainType.Magma]: PokemonType.Fire,
  [TerrainType.Lava]: PokemonType.Fire,
  [TerrainType.Ice]: PokemonType.Ice,
  [TerrainType.Sand]: PokemonType.Ground,
  [TerrainType.Snow]: PokemonType.Ice,
  [TerrainType.Swamp]: PokemonType.Poison,
};

export function getTerrainTypeBonusFactor(
  terrain: TerrainType,
  moveType: PokemonTypeValue,
  attackerTypes: PokemonTypeValue[],
): number {
  if (isTerrainImmune(terrain, attackerTypes)) {
    return 1.0;
  }
  const bonusType = TERRAIN_TYPE_BONUS[terrain];
  if (!bonusType || bonusType !== moveType) {
    return 1.0;
  }
  return 1.15;
}

const TERRAIN_STATUS_ON_STOP: Partial<Record<TerrainType, StatusType>> = {
  [TerrainType.Magma]: StatusType.Burned,
  [TerrainType.Swamp]: StatusType.Poisoned,
};

export function getTerrainStatusOnStop(
  terrain: TerrainType,
  types: PokemonTypeValue[],
): StatusType | null {
  if (isTerrainImmune(terrain, types)) {
    return null;
  }
  return TERRAIN_STATUS_ON_STOP[terrain] ?? null;
}

const TERRAIN_DOT_FRACTION: Partial<Record<TerrainType, number>> = {
  [TerrainType.Magma]: 16,
};

export function getTerrainDotFraction(terrain: TerrainType): number | null {
  return TERRAIN_DOT_FRACTION[terrain] ?? null;
}
