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
  [TerrainType.Swamp]: [PokemonType.Poison, PokemonType.Steel, PokemonType.Flying],
};

export function isTerrainImmune(
  terrain: TerrainType,
  types: PokemonTypeValue[],
  isFlying = false,
): boolean {
  if (isFlying) {
    return true;
  }
  const immuneTypes = TERRAIN_IMMUNE_TYPES[terrain];
  if (!immuneTypes) {
    return false;
  }
  return types.some((t) => immuneTypes.includes(t));
}

export function getImmuneTerrains(
  types: PokemonTypeValue[],
  isFlying = false,
): ReadonlySet<TerrainType> {
  const result = new Set<TerrainType>();
  for (const terrain of Object.values(TerrainType) as TerrainType[]) {
    if (isTerrainImmune(terrain, types, isFlying)) {
      result.add(terrain);
    }
  }
  return result;
}

const MOVEMENT_PENALTY: Partial<Record<TerrainType, number>> = {
  [TerrainType.Water]: 1,
  [TerrainType.Sand]: 1,
  [TerrainType.Snow]: 1,
  [TerrainType.Swamp]: 2,
};

export function getMovementPenalty(
  terrain: TerrainType,
  types: PokemonTypeValue[],
  isFlying = false,
): number {
  if (isTerrainImmune(terrain, types, isFlying)) {
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

/**
 * The ×1.15 the tile grants to a matching move type, for an attacker standing ON it.
 *
 * Only *airborne* attackers are excluded: they never touch the tile, so it cannot empower them.
 * Type immunity does NOT disqualify (decision 2026-07-25) — it only cancels the terrain's damage
 * and status. Gating the bonus on it inverted the intent: a Fire type is immune to magma, so it was
 * the one mon that could never draw power from standing in lava, while any non-Fire attacker could.
 */
export function getTerrainTypeBonusFactor(
  terrain: TerrainType,
  moveType: PokemonTypeValue,
  isFlying = false,
): number {
  if (isFlying) {
    return 1.0;
  }
  const bonusType = TERRAIN_TYPE_BONUS[terrain];
  if (!bonusType || bonusType !== moveType) {
    return 1.0;
  }
  return 1.15;
}

/** The move type a terrain grants a ×1.15 bonus to (for a non-immune attacker standing on it), or null. */
export function getTerrainBonusType(terrain: TerrainType): PokemonTypeValue | null {
  return TERRAIN_TYPE_BONUS[terrain] ?? null;
}

/** Types a terrain grants free passage to (no movement penalty / status / DoT). Used for tile-info readouts. */
export function getTerrainImmuneTypes(terrain: TerrainType): readonly PokemonTypeValue[] {
  return TERRAIN_IMMUNE_TYPES[terrain] ?? [];
}

const TERRAIN_STATUS_ON_STOP: Partial<Record<TerrainType, StatusType>> = {
  [TerrainType.Magma]: StatusType.Burned,
  [TerrainType.Swamp]: StatusType.Poisoned,
};

export function getTerrainStatusOnStop(
  terrain: TerrainType,
  types: PokemonTypeValue[],
  isFlying = false,
): StatusType | null {
  if (isTerrainImmune(terrain, types, isFlying)) {
    return null;
  }
  return TERRAIN_STATUS_ON_STOP[terrain] ?? null;
}

const TERRAIN_DOT_FRACTION: Partial<Record<TerrainType, number>> = {
  [TerrainType.Magma]: 16,
  [TerrainType.Lava]: 1,
  [TerrainType.DeepWater]: 1,
};

export function getTerrainDotFraction(terrain: TerrainType): number | null {
  return TERRAIN_DOT_FRACTION[terrain] ?? null;
}
