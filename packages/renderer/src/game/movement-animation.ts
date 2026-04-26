import { TerrainType } from "@pokemon-tactic/core";

import {
  JUMP_TWEEN_DURATION_MS,
  MOVE_TWEEN_DURATION_FLYING_MS,
  MOVE_TWEEN_DURATION_MS,
} from "../constants";

export type MovementAnimationKey = "Walk" | "Hop";

/**
 * Candidates for the continuous glide animation of a flying Pokemon crossing
 * special-terrain tiles, in priority order. All are looping animations.
 * Falls back to "Walk" if none exist in the atlas.
 *
 * FlyingIdle is a synthetic 2-frame animation built from FlapAround frames 0–1
 * (wings neutral → wings up) — see SpriteLoader.createPokemonAnimations.
 * FlapAround itself is absent: its 18-frame sequence rotates through all 8
 * directions, which looks wrong as a looping hover.
 */
export const FLYING_GLIDE_ANIMATION_CANDIDATES: readonly string[] = [
  "FlyingIdle",
  "Hover",
  "Special10",
];

/**
 * Destination terrains that trigger flying animation for flat movement.
 * Flying Pokemon soar over these tiles instead of walking on them.
 */
export const FLYING_OVERFLY_TERRAINS: ReadonlySet<string> = new Set([
  TerrainType.Obstacle,
  TerrainType.Water,
  TerrainType.DeepWater,
  TerrainType.Lava,
  TerrainType.Magma,
  TerrainType.Swamp,
  TerrainType.Sand,
  TerrainType.Snow,
]);

export interface MovementStep {
  /** Absolute height delta between source and target tiles. */
  readonly heightDiff: number;
  /** `true` when the source or the target tile carries a slope (ramp). */
  readonly isRamp: boolean;
  /** `true` when the Pokemon's type includes Flying. */
  readonly isFlying: boolean;
  /** Destination tile terrain. */
  readonly terrainType?: string;
}

/**
 * Returns `true` when the step is a jump — that is, any movement with a
 * non-zero height delta that does not traverse a ramp. Flat movement and
 * ramp traversal are walks; everything else (half-tile cliff, full-tile
 * drop, flying over a gap) is a jump.
 */
export function isJumpStep(step: MovementStep): boolean {
  if (step.heightDiff === 0) {
    return false;
  }
  return !step.isRamp;
}

/**
 * Returns the flying animation mode for a step:
 * - `"glide"` : any flying Pokemon step (cliff jump or flat movement over special terrain)
 *               — play `FLYING_GLIDE_ANIMATION_CANDIDATES` (looping). Cliff jumps use the
 *               same looping FlyingIdle so the sprite never interrupts its wing flap.
 * - `null`    : ground movement or flat flight over normal terrain — use `selectMovementAnimation`.
 */
export function getFlyingAnimationMode(step: MovementStep): "glide" | null {
  if (!step.isFlying) {
    return null;
  }
  if (isJumpStep(step)) {
    return "glide";
  }
  const destIsSpecial =
    step.terrainType !== undefined && FLYING_OVERFLY_TERRAINS.has(step.terrainType);
  return destIsSpecial ? "glide" : null;
}

/**
 * Picks the ground sprite animation to play for a movement step. Walks on
 * flat ground and ramps; hops on jumps. Used as the fallback for flying
 * Pokemon when none of the dedicated flying animations exist on the sprite.
 */
export function selectMovementAnimation(step: MovementStep): MovementAnimationKey {
  return isJumpStep(step) ? "Hop" : "Walk";
}

/**
 * Returns the per-step tween duration in milliseconds for the given step.
 *
 * - Walks on flat ground use the ground duration.
 * - Ramp traversal uses the ground duration (it's a walk, not a jump).
 * - Jumps (any kind) use the longer jump duration so each half-tile hop has
 *   time to play its sprite animation in full.
 * - Flying Pokemon glide slower on non-jump movement to read as flight.
 */
export function selectMovementDuration(step: MovementStep): number {
  if (isJumpStep(step)) {
    return JUMP_TWEEN_DURATION_MS;
  }
  return step.isFlying ? MOVE_TWEEN_DURATION_FLYING_MS : MOVE_TWEEN_DURATION_MS;
}
