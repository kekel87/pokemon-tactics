import { TerrainType } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import {
  JUMP_TWEEN_DURATION_MS,
  MOVE_TWEEN_DURATION_FLYING_MS,
  MOVE_TWEEN_DURATION_MS,
} from "./constants.js";
import {
  FLYING_GLIDE_ANIMATION_CANDIDATES,
  FLYING_OVERFLY_TERRAINS,
  getFlyingAnimationMode,
  isFlyoverTerrain,
  isJumpStep,
  type MovementStep,
  movementVerticalMode,
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

  it("is NOT a jump for a half-tile step off a cliff — it's a stair step (plan 166)", () => {
    expect(isJumpStep(step({ heightDiff: 0.5, isRamp: false }))).toBe(false);
  });

  it("is a jump for a full-tile descent", () => {
    expect(isJumpStep(step({ heightDiff: 1, isRamp: false }))).toBe(true);
  });

  it("is a jump for flying Pokemon climbing multiple tiles", () => {
    expect(isJumpStep(step({ heightDiff: 3, isRamp: false, isFlying: true }))).toBe(true);
  });
});

describe("movementVerticalMode", () => {
  it("is flat on level ground", () => {
    expect(movementVerticalMode(step({ heightDiff: 0 }))).toBe("flat");
  });

  it("is flat on a ramp regardless of height delta", () => {
    expect(movementVerticalMode(step({ heightDiff: 0.5, isRamp: true }))).toBe("flat");
  });

  it("is a stair step for a half-block non-ramp change", () => {
    expect(movementVerticalMode(step({ heightDiff: 0.5, isRamp: false }))).toBe("step");
  });

  it("is a jump for a bigger-than-half-block cliff", () => {
    expect(movementVerticalMode(step({ heightDiff: 1, isRamp: false }))).toBe("jump");
  });
});

describe("selectMovementAnimation", () => {
  it("walks on flat ground", () => {
    expect(selectMovementAnimation(step({ heightDiff: 0 }))).toBe("Walk");
  });

  it("walks on a ramp", () => {
    expect(selectMovementAnimation(step({ heightDiff: 0.5, isRamp: true }))).toBe("Walk");
  });

  it("walks (stair step, no hop) on a non-ramp half-tile step (plan 166)", () => {
    expect(selectMovementAnimation(step({ heightDiff: 0.5, isRamp: false }))).toBe("Walk");
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

describe("getFlyingAnimationMode", () => {
  it("returns null for a ground Pokemon regardless of terrain", () => {
    expect(getFlyingAnimationMode(step({ isFlying: false, heightDiff: 1 }))).toBe(null);
    expect(getFlyingAnimationMode(step({ isFlying: false, terrainType: TerrainType.Water }))).toBe(
      null,
    );
  });

  it("returns glide for a flying Pokemon on a cliff (same looping anim, no rotation)", () => {
    expect(getFlyingAnimationMode(step({ isFlying: true, heightDiff: 1, isRamp: false }))).toBe(
      "glide",
    );
  });

  it("returns null for a flying Pokemon on a ramp (still walking)", () => {
    expect(getFlyingAnimationMode(step({ isFlying: true, heightDiff: 0.5, isRamp: true }))).toBe(
      null,
    );
  });

  it("returns glide on any fly-over terrain tile (no take-off distinction)", () => {
    for (const terrain of [
      TerrainType.Water,
      TerrainType.DeepWater,
      TerrainType.Lava,
      TerrainType.Magma,
      TerrainType.Swamp,
      TerrainType.Sand,
      TerrainType.Snow,
      TerrainType.Ice,
    ]) {
      expect(getFlyingAnimationMode(step({ isFlying: true, terrainType: terrain }))).toBe("glide");
    }
  });

  it("returns null on walkable ground (normal, tall_grass)", () => {
    expect(getFlyingAnimationMode(step({ isFlying: true, terrainType: TerrainType.Normal }))).toBe(
      null,
    );
    expect(
      getFlyingAnimationMode(step({ isFlying: true, terrainType: TerrainType.TallGrass })),
    ).toBe(null);
    expect(getFlyingAnimationMode(step({ isFlying: true }))).toBe(null);
  });
});

describe("FLYING_OVERFLY_TERRAINS", () => {
  it("contains obstacle, water, lava, magma, swamp, sand, snow, deep_water, ice", () => {
    for (const terrain of [
      TerrainType.Obstacle,
      TerrainType.Water,
      TerrainType.DeepWater,
      TerrainType.Lava,
      TerrainType.Magma,
      TerrainType.Swamp,
      TerrainType.Sand,
      TerrainType.Snow,
      TerrainType.Ice,
    ]) {
      expect(FLYING_OVERFLY_TERRAINS.has(terrain)).toBe(true);
    }
  });

  it("does not contain the walkable-ground terrains (normal, tall_grass)", () => {
    for (const terrain of [TerrainType.Normal, TerrainType.TallGrass]) {
      expect(FLYING_OVERFLY_TERRAINS.has(terrain)).toBe(false);
    }
  });
});

describe("isFlyoverTerrain", () => {
  it("is true on fly-over terrains (glide at rest), including ice", () => {
    for (const terrain of [
      TerrainType.Water,
      TerrainType.DeepWater,
      TerrainType.Lava,
      TerrainType.Magma,
      TerrainType.Swamp,
      TerrainType.Sand,
      TerrainType.Snow,
      TerrainType.Ice,
      TerrainType.Obstacle,
    ]) {
      expect(isFlyoverTerrain(terrain)).toBe(true);
    }
  });

  it("is false on walkable ground (flyer touches down), and on an unknown tile", () => {
    expect(isFlyoverTerrain(TerrainType.Normal)).toBe(false);
    expect(isFlyoverTerrain(TerrainType.TallGrass)).toBe(false);
    expect(isFlyoverTerrain(undefined)).toBe(false);
  });
});

describe("FLYING_GLIDE_ANIMATION_CANDIDATES", () => {
  it("prefers FlyingIdle (synthetic 2-frame wing flap, no rotation)", () => {
    expect(FLYING_GLIDE_ANIMATION_CANDIDATES[0]).toBe("FlyingIdle");
    expect(FLYING_GLIDE_ANIMATION_CANDIDATES).toContain("Hover");
    expect(FLYING_GLIDE_ANIMATION_CANDIDATES).toContain("Special10");
  });

  it("does not contain FlapAround (rotates through 8 directions)", () => {
    expect(FLYING_GLIDE_ANIMATION_CANDIDATES).not.toContain("FlapAround");
  });

  it("does not contain Hop (one-shot, not a looping glide)", () => {
    expect(FLYING_GLIDE_ANIMATION_CANDIDATES).not.toContain("Hop");
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

  it("uses the ground duration for a half-block stair step (plan 166 — not a jump)", () => {
    expect(selectMovementDuration(step({ heightDiff: 0.5, isRamp: false }))).toBe(
      MOVE_TWEEN_DURATION_MS,
    );
  });

  it("uses the jump duration for a bigger cliff (ground or flying)", () => {
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
