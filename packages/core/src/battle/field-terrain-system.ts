import { FieldTerrain } from "../enums/field-terrain";
import { HeldItemId } from "../enums/held-item-id";
import { PokemonType } from "../enums/pokemon-type";
import type { BattleState } from "../types/battle-state";
import type { FieldZone } from "../types/field-zone";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import { isEffectivelyFlying } from "./effective-flying";

export const FIELD_TERRAIN_DEFAULT_DURATION = 5;
export const FIELD_TERRAIN_EXTENDED_DURATION = 8;
export const FIELD_TERRAIN_RADIUS = 3;
export const GRASSY_HEAL_FRACTION = 16;
/** End-turn tick: after the heal-over-time tick (250, Ingrain/Aqua Ring), before traps (300). */
export const FIELD_TERRAIN_TICK_PRIORITY = 260;

/** ×1.3 boost for a move matching the active terrain, used by an attacker standing on the zone. */
export const FIELD_TERRAIN_BOOST = 1.3;
/** ×0.5 reduction (Dragon vs Misty, Earthquake/Bulldoze vs Grassy) for a target on the zone. */
export const FIELD_TERRAIN_REDUCTION = 0.5;
/**
 * Impact damage dealt to a dasher repelled by the Psychic barrier — fed to the wall-impact resolver
 * (calculateFallDamage) as a synthetic height. Tier 2 → 33% max HP, "slams into the wall". Tunable.
 */
export const PSYCHIC_BARRIER_IMPACT_HEIGHT = 2;

export function fieldTerrainDurationForCaster(caster: PokemonInstance): number {
  return caster.heldItemId === HeldItemId.TerrainExtender
    ? FIELD_TERRAIN_EXTENDED_DURATION
    : FIELD_TERRAIN_DEFAULT_DURATION;
}

/** Enumerate the in-bounds Manhattan-diamond (radius r) tiles centered on `anchor`. */
export function enumerateZoneTiles(
  state: BattleState,
  anchor: Position,
  radius: number,
): Position[] {
  const height = state.grid.length;
  const width = state.grid[0]?.length ?? 0;
  const tiles: Position[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    const spread = radius - Math.abs(dy);
    for (let dx = -spread; dx <= spread; dx++) {
      const x = anchor.x + dx;
      const y = anchor.y + dy;
      if (x >= 0 && x < width && y >= 0 && y < height) {
        tiles.push({ x, y });
      }
    }
  }
  return tiles;
}

/**
 * Post a field-terrain zone centered on the caster's current tile. Multiple zones coexist at
 * different spots — but posting on the EXACT epicenter (anchor) of an existing zone REPLACES it
 * (ally or enemy alike), rather than stacking a second zone on the same center.
 */
export function postFieldTerrain(
  state: BattleState,
  caster: PokemonInstance,
  kind: FieldTerrain,
): FieldZone {
  const anchor: Position = { x: caster.position.x, y: caster.position.y };
  for (let i = state.fieldTerrains.length - 1; i >= 0; i--) {
    const existing = state.fieldTerrains[i];
    if (existing && existing.anchor.x === anchor.x && existing.anchor.y === anchor.y) {
      state.fieldTerrains.splice(i, 1);
    }
  }
  const zone: FieldZone = {
    kind,
    casterId: caster.id,
    tiles: enumerateZoneTiles(state, anchor, FIELD_TERRAIN_RADIUS),
    anchor,
    remainingTurns: fieldTerrainDurationForCaster(caster),
  };
  state.fieldTerrains.push(zone);
  return zone;
}

function zoneContains(zone: FieldZone, position: Position): boolean {
  return zone.tiles.some((tile) => tile.x === position.x && tile.y === position.y);
}

/**
 * The field terrain on a tile, or null. On overlap the most recently posted zone wins, so we scan
 * from the end of the list (latest insertion) backwards.
 */
export function getFieldTerrainAt(state: BattleState, position: Position): FieldTerrain | null {
  for (let i = state.fieldTerrains.length - 1; i >= 0; i--) {
    const zone = state.fieldTerrains[i];
    if (zone && zoneContains(zone, position)) {
      return zone.kind;
    }
  }
  return null;
}

/**
 * Double gate (decision #427): a mon is subject to a field terrain only if it stands on a tile of
 * that terrain AND is grounded. Flying / Levitate (and semi-invulnerable airborne) mons escape.
 */
export function isOnFieldTerrain(
  state: BattleState,
  pokemon: PokemonInstance,
  types: readonly PokemonType[],
  kind: FieldTerrain,
): boolean {
  if (isEffectivelyFlying(pokemon, types)) {
    return false;
  }
  return getFieldTerrainAt(state, pokemon.position) === kind;
}

export function getActiveZonesOfKind(state: BattleState, kind: FieldTerrain): FieldZone[] {
  return state.fieldTerrains.filter((zone) => zone.kind === kind);
}

const TERRAIN_BOOST_TYPE: Record<string, PokemonType> = {
  [FieldTerrain.Grassy]: PokemonType.Grass,
  [FieldTerrain.Electric]: PokemonType.Electric,
  [FieldTerrain.Psychic]: PokemonType.Psychic,
};

/** Ground-shaking moves halved by Grassy Terrain on grounded targets standing in the zone. */
const GRASSY_HALVED_MOVES: ReadonlySet<string> = new Set(["earthquake", "bulldoze", "magnitude"]);

/** ×1.3 if the attacker stands on a zone matching the move's type (B4). */
export function getFieldTerrainBpMultiplier(
  state: BattleState,
  attacker: PokemonInstance,
  attackerTypes: readonly PokemonType[],
  move: MoveDefinition,
): number {
  const terrain = getFieldTerrainAt(state, attacker.position);
  if (terrain === null || isEffectivelyFlying(attacker, attackerTypes)) {
    return 1.0;
  }
  return TERRAIN_BOOST_TYPE[terrain] === move.type ? FIELD_TERRAIN_BOOST : 1.0;
}

/** ×0.5 for Dragon vs Misty / ground-shaking vs Grassy, when the target stands on the zone (B4). */
export function getFieldTerrainDamageMultiplier(
  state: BattleState,
  target: PokemonInstance,
  targetTypes: readonly PokemonType[],
  move: MoveDefinition,
): number {
  if (
    move.type === PokemonType.Dragon &&
    isOnFieldTerrain(state, target, targetTypes, FieldTerrain.Misty)
  ) {
    return FIELD_TERRAIN_REDUCTION;
  }
  if (
    GRASSY_HALVED_MOVES.has(move.id) &&
    isOnFieldTerrain(state, target, targetTypes, FieldTerrain.Grassy)
  ) {
    return FIELD_TERRAIN_REDUCTION;
  }
  return 1.0;
}

/**
 * Psychic-terrain barrier (decision #428): a dash by an enemy of the zone's caster is blocked when
 * its path enters a Psychic zone tile. The dasher must be grounded (flyers pass). Used as the
 * `isDashBarrierTile` predicate fed into resolveDash through the traversal context.
 */
export function isEnemyPsychicBarrierAt(
  state: BattleState,
  dasher: PokemonInstance,
  dasherTypes: readonly PokemonType[],
  position: Position,
): boolean {
  if (isEffectivelyFlying(dasher, dasherTypes)) {
    return false;
  }
  for (let i = state.fieldTerrains.length - 1; i >= 0; i--) {
    const zone = state.fieldTerrains[i];
    if (!zone || zone.kind !== FieldTerrain.Psychic) {
      continue;
    }
    if (!zoneContains(zone, position)) {
      continue;
    }
    const caster = state.pokemon.get(zone.casterId);
    // Enemy-of-caster only; a zone whose caster is gone still belongs to a player team.
    if (caster && caster.playerId === dasher.playerId) {
      continue;
    }
    return true;
  }
  return false;
}

export interface ExpiredFieldZone {
  casterId: string;
  kind: FieldTerrain;
}

/** Decrement every zone's timer once; remove (and report) the zones that reached zero. */
export function decrementFieldTerrainsTimer(state: BattleState): ExpiredFieldZone[] {
  const expired: ExpiredFieldZone[] = [];
  for (const zone of state.fieldTerrains) {
    zone.remainingTurns -= 1;
  }
  for (let i = state.fieldTerrains.length - 1; i >= 0; i--) {
    const zone = state.fieldTerrains[i];
    if (zone && zone.remainingTurns <= 0) {
      expired.unshift({ casterId: zone.casterId, kind: zone.kind });
      state.fieldTerrains.splice(i, 1);
    }
  }
  return expired;
}
