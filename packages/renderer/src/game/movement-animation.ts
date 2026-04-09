import {
  JUMP_TWEEN_DURATION_MS,
  MOVE_TWEEN_DURATION_FLYING_MS,
  MOVE_TWEEN_DURATION_MS,
} from "../constants";

export type MovementAnimationKey = "Walk" | "Hop";

/**
 * Flying-only animation candidates, in priority order. When a flying Pokemon
 * jumps (any height delta that is not a ramp traversal), the sprite tries
 * these animations one by one and falls back to "Hop" if none exist in the
 * atlas — flying sprites without a dedicated flying animation still need to
 * read as airborne rather than as walking.
 */
export const FLYING_JUMP_ANIMATION_CANDIDATES: readonly string[] = [
  "FlapAround",
  "Hover",
  "Special10",
  "Hop",
];

export interface MovementStep {
  /** Absolute height delta between source and target tiles. */
  readonly heightDiff: number;
  /** `true` when the source or the target tile carries a slope (ramp). */
  readonly isRamp: boolean;
  /** `true` when the Pokemon's type includes Flying. */
  readonly isFlying: boolean;
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
