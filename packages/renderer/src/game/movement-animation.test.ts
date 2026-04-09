import { describe, expect, it } from "vitest";
import {
  JUMP_TWEEN_DURATION_MS,
  MOVE_TWEEN_DURATION_FLYING_MS,
  MOVE_TWEEN_DURATION_MS,
} from "../constants";
import {
  FLYING_JUMP_ANIMATION_CANDIDATES,
  isJumpStep,
  type MovementStep,
  selectMovementAnimation,
  selectMovementDuration,
} from "./movement-animation";

function step(partial: Partial<MovementStep> = {}): MovementStep {
  return { heightDiff: 0, isRamp: false, isFlying: false, ...partial };
}

describe("isJumpStep", () => {
  it("is not a jump on flat ground", () => {
    expect(isJumpStep(step({ heightDiff: 0 }))).toBe(false);
  });

  it("is not a jump when traversing a ramp, even with a height delta", () => {
    expect(isJumpStep(step({ heightDiff: 0.5, isRamp: true }))).toBe(false);
  });

  it("is a jump for a half-tile step off a cliff (no ramp)", () => {
    expect(isJumpStep(step({ heightDiff: 0.5, isRamp: false }))).toBe(true);
  });

  it("is a jump for a full-tile descent", () => {
    expect(isJumpStep(step({ heightDiff: 1, isRamp: false }))).toBe(true);
  });

  it("is a jump for flying Pokemon climbing multiple tiles", () => {
    expect(isJumpStep(step({ heightDiff: 3, isRamp: false, isFlying: true }))).toBe(true);
  });
});

describe("selectMovementAnimation", () => {
  it("walks on flat ground", () => {
    expect(selectMovementAnimation(step({ heightDiff: 0 }))).toBe("Walk");
  });

  it("walks on a ramp", () => {
    expect(selectMovementAnimation(step({ heightDiff: 0.5, isRamp: true }))).toBe("Walk");
  });

  it("hops on a non-ramp half-tile step (ground Pokemon)", () => {
    expect(selectMovementAnimation(step({ heightDiff: 0.5, isRamp: false }))).toBe("Hop");
  });

  it("hops on a full-tile descent (ground Pokemon)", () => {
    expect(selectMovementAnimation(step({ heightDiff: 1, isRamp: false }))).toBe("Hop");
  });

  it("hops on a jump for flying Pokemon (fallback when no flying anim exists)", () => {
    expect(selectMovementAnimation(step({ heightDiff: 2, isFlying: true }))).toBe("Hop");
  });

  it("walks when a flying Pokemon crosses a ramp", () => {
    expect(selectMovementAnimation(step({ heightDiff: 0.5, isRamp: true, isFlying: true }))).toBe(
      "Walk",
    );
  });
});

describe("FLYING_JUMP_ANIMATION_CANDIDATES", () => {
  it("prefers dedicated flying animations and ends with Hop", () => {
    expect(FLYING_JUMP_ANIMATION_CANDIDATES[0]).toBe("FlapAround");
    expect(FLYING_JUMP_ANIMATION_CANDIDATES).toContain("Hover");
    expect(FLYING_JUMP_ANIMATION_CANDIDATES).toContain("Special10");
    expect(FLYING_JUMP_ANIMATION_CANDIDATES.at(-1)).toBe("Hop");
  });

  it("never falls back to Walk (Walk comes from selectMovementAnimation)", () => {
    expect(FLYING_JUMP_ANIMATION_CANDIDATES).not.toContain("Walk");
  });
});

describe("selectMovementDuration", () => {
  it("uses the ground duration for a flat walk", () => {
    expect(selectMovementDuration(step({ heightDiff: 0 }))).toBe(MOVE_TWEEN_DURATION_MS);
  });

  it("uses the ground duration for a ramp traversal", () => {
    expect(selectMovementDuration(step({ heightDiff: 0.5, isRamp: true }))).toBe(
      MOVE_TWEEN_DURATION_MS,
    );
  });

  it("uses the flying (glide) duration for a flat move by a flying Pokemon", () => {
    expect(selectMovementDuration(step({ heightDiff: 0, isFlying: true }))).toBe(
      MOVE_TWEEN_DURATION_FLYING_MS,
    );
  });

  it("uses the jump duration for any jump (ground or flying)", () => {
    expect(selectMovementDuration(step({ heightDiff: 0.5, isRamp: false }))).toBe(
      JUMP_TWEEN_DURATION_MS,
    );
    expect(selectMovementDuration(step({ heightDiff: 1, isRamp: false }))).toBe(
      JUMP_TWEEN_DURATION_MS,
    );
    expect(selectMovementDuration(step({ heightDiff: 2, isFlying: true }))).toBe(
      JUMP_TWEEN_DURATION_MS,
    );
  });

  it("jumps are slower than walks", () => {
    expect(JUMP_TWEEN_DURATION_MS).toBeGreaterThan(MOVE_TWEEN_DURATION_MS);
  });
});
