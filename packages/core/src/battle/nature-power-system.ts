import { FieldTerrain } from "../enums/field-terrain";
import { TerrainType } from "../enums/terrain-type";
import type { Grid } from "../grid/Grid";
import type { BattleState } from "../types/battle-state";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import { getFieldTerrainAt } from "./field-terrain-system";

/** Default morph when no field terrain / mapped tile applies (Nature Power → Tri Attack). */
export const NATURE_POWER_DEFAULT_MOVE_ID = "tri-attack";

/**
 * §6-A — field terrain under the caster wins (priority 1). Canon Gen 7/8 morph targets.
 */
const NATURE_POWER_FIELD_TERRAIN_MOVE: Record<FieldTerrain, string> = {
  [FieldTerrain.Grassy]: "energy-ball",
  [FieldTerrain.Electric]: "thunderbolt",
  [FieldTerrain.Misty]: "moonblast",
  [FieldTerrain.Psychic]: "psychic",
};

/**
 * §6-B — map TerrainType under the caster (priority 2, canon Gen 7/8 — decision #441).
 */
const NATURE_POWER_TERRAIN_TYPE_MOVE: Record<TerrainType, string> = {
  [TerrainType.Normal]: "tri-attack",
  [TerrainType.TallGrass]: "energy-ball",
  [TerrainType.Water]: "hydro-pump",
  [TerrainType.DeepWater]: "hydro-pump",
  [TerrainType.Magma]: "lava-plume",
  [TerrainType.Lava]: "lava-plume",
  [TerrainType.Ice]: "ice-beam",
  [TerrainType.Snow]: "ice-beam",
  [TerrainType.Sand]: "earth-power",
  [TerrainType.Swamp]: "mud-bomb",
  [TerrainType.Obstacle]: "power-gem",
};

/** The move id Nature Power resolves to, given the caster's current tile. */
export function resolveNaturePowerMoveId(
  state: BattleState,
  grid: Grid,
  caster: PokemonInstance,
): string {
  const fieldTerrain = getFieldTerrainAt(state, caster.position);
  if (fieldTerrain !== null) {
    return NATURE_POWER_FIELD_TERRAIN_MOVE[fieldTerrain];
  }
  const tileTerrain = grid.getTile(caster.position)?.terrain;
  if (tileTerrain !== undefined) {
    return NATURE_POWER_TERRAIN_TYPE_MOVE[tileTerrain] ?? NATURE_POWER_DEFAULT_MOVE_ID;
  }
  return NATURE_POWER_DEFAULT_MOVE_ID;
}

/**
 * Force Nature full move swap (B4, decision E). Resolves the move the caster's current tile maps to:
 * (1) field terrain under the caster (au sol) → §6-A; (2) the map TerrainType under the caster →
 * §6-B; (3) otherwise Tri Attack. Returns the resolved MoveDefinition (full swap: type, category,
 * power, targeting, effects), or the original move when the target id is not registered.
 *
 * PP is spent on `nature-power`, not the morphed move — the caller keeps using the original id for
 * PP/bookkeeping. The grounding gate is NOT applied to the field-terrain branch: Nature Power reads
 * the zone directly via `getFieldTerrainAt` (a flyer above a tile uses the §6-B map branch instead).
 */
export function resolveNaturePowerMove(
  getMove: (id: string) => MoveDefinition | undefined,
  state: BattleState,
  grid: Grid,
  caster: PokemonInstance,
  move: MoveDefinition,
): MoveDefinition {
  if (move.naturePowerMorph !== true) {
    return move;
  }
  const resolvedId = resolveNaturePowerMoveId(state, grid, caster);
  return getMove(resolvedId) ?? move;
}
