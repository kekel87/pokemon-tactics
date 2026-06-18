import type { BattleState } from "../types/battle-state";
import type { DistortionZone } from "../types/distortion-zone";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import { enumerateZoneTiles } from "./field-terrain-system";

export const DISTORTION_DEFAULT_DURATION = 5;
export const DISTORTION_RADIUS = 3;
/**
 * Speed reflection pivot for the Charge-Time inversion. Inside a Distorsion zone the gain is computed
 * from an INVERTED base Speed — `max(1, PIVOT - baseSpeed)` — so a slow mon behaves like a fast one
 * and vice-versa, while the resulting gain stays in the SAME magnitude band as a normal gain (we feed
 * the inverted speed back through the usual `computeCtGain` curve). Sits just above the fastest Gen-1
 * base Speed (Electrode 150) so the fastest mon maps to the slowest effective tempo.
 */
export const DISTORTION_SPEED_PIVOT = 160;

/** The effective base Speed a mon uses for CT gain while standing in a Distorsion zone. */
export function invertedDistortionSpeed(baseSpeed: number): number {
  return Math.max(1, DISTORTION_SPEED_PIVOT - baseSpeed);
}

function zoneContains(zone: DistortionZone, position: Position): boolean {
  return zone.tiles.some((tile) => tile.x === position.x && tile.y === position.y);
}

/** True if any active Distorsion zone covers `position`. Overlapping zones do NOT double-invert. */
export function isInDistortionZone(state: BattleState, position: Position): boolean {
  return state.distortionZones.some((zone) => zoneContains(zone, position));
}

/**
 * Post a Distorsion zone centered on the caster's current tile (mirror of `postFieldTerrain`):
 * multiple zones coexist at different spots, but posting on the EXACT epicenter of an existing zone
 * REPLACES it (refreshes the timer) instead of stacking a second zone on the same center.
 */
export function postDistortion(state: BattleState, caster: PokemonInstance): DistortionZone {
  const anchor: Position = { x: caster.position.x, y: caster.position.y };
  for (let i = state.distortionZones.length - 1; i >= 0; i--) {
    const existing = state.distortionZones[i];
    if (existing && existing.anchor.x === anchor.x && existing.anchor.y === anchor.y) {
      state.distortionZones.splice(i, 1);
    }
  }
  const zone: DistortionZone = {
    casterId: caster.id,
    tiles: enumerateZoneTiles(state, anchor, DISTORTION_RADIUS),
    anchor,
    remainingTurns: DISTORTION_DEFAULT_DURATION,
  };
  state.distortionZones.push(zone);
  return zone;
}

export interface ExpiredDistortionZone {
  casterId: string;
}

/**
 * Decrement the timers of the Distorsion zones posted by `casterId` (CT "tours du lanceur" model:
 * counts down on the caster's own turns — or, after KO, on its ghost turns). Remove and report the
 * zones that reached zero.
 */
export function decrementDistortionTimer(
  state: BattleState,
  casterId: string,
): ExpiredDistortionZone[] {
  const expired: ExpiredDistortionZone[] = [];
  for (const zone of state.distortionZones) {
    if (zone.casterId === casterId) {
      zone.remainingTurns -= 1;
    }
  }
  for (let i = state.distortionZones.length - 1; i >= 0; i--) {
    const zone = state.distortionZones[i];
    if (zone && zone.casterId === casterId && zone.remainingTurns <= 0) {
      expired.unshift({ casterId: zone.casterId });
      state.distortionZones.splice(i, 1);
    }
  }
  return expired;
}
