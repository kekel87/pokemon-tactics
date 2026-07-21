import { TerrainType } from "@pokemon-tactic/core";

import {
  JUMP_TWEEN_DURATION_MS,
  MOVE_TWEEN_DURATION_FLYING_MS,
  MOVE_TWEEN_DURATION_MS,
} from "./constants.js";

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
 * Terrains a flying Pokemon soars over rather than walking on: no walkable ground
 * (liquids, hazards, gaps), so the sprite glides while crossing AND keeps gliding at
 * rest. On the terrains NOT listed here (Normal, TallGrass) a flyer touches down and
 * walks/idles like a land mon — it has solid ground to stand on.
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
  TerrainType.Ice,
]);

/** True when the tile has no walkable ground, so a flyer glides over it (crossing and at rest). */
export function isFlyoverTerrain(terrain: string | undefined): boolean {
  return terrain !== undefined && FLYING_OVERFLY_TERRAINS.has(terrain);
}

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

export type MovementVerticalMode = "flat" | "step" | "jump";

/**
 * A height change of at most this many units (a half-block) crosses as a small stair
 * step — walk pose, no hop — rather than a jump (plan 166). Bigger drops/climbs jump.
 */
const MAX_STEP_HEIGHT_DIFF = 0.5;

/**
 * How a step changes the sprite's height:
 * - `"flat"` : no height delta, or a ramp (glides linearly along the slope).
 * - `"step"` : a half-block (≤ `MAX_STEP_HEIGHT_DIFF`) non-ramp change — a small stair
 *              step (walk pose, vertical eased late so it reads as a step, not a diagonal).
 * - `"jump"` : a bigger non-ramp cliff — a hop with a vertical lead over the arc.
 */
export function movementVerticalMode(step: MovementStep): MovementVerticalMode {
  if (step.heightDiff === 0 || step.isRamp) {
    return "flat";
  }
  return step.heightDiff <= MAX_STEP_HEIGHT_DIFF ? "step" : "jump";
}

/** True only for a genuine cliff hop (a bigger-than-half-block non-ramp change). */
export function isJumpStep(step: MovementStep): boolean {
  return movementVerticalMode(step) === "jump";
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
 * Picks the ground sprite animation to play for a movement step. Hops only on a genuine
 * cliff jump; walks on flat ground, ramps, and small stair steps (half-blocks). Used as
 * the fallback for flying Pokemon when none of the dedicated flying animations exist.
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
