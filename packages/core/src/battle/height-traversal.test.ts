import { describe, expect, it } from "vitest";
import { TerrainType } from "../enums/terrain-type";
import { canStopOn, canTraverse, type TraversalOptions } from "./height-traversal";

function traversal(overrides: Partial<TraversalOptions> = {}): TraversalOptions {
  return {
    fromHeight: 0,
    toHeight: 0,
    fromTerrain: TerrainType.Normal,
    toTerrain: TerrainType.Normal,
    isFlying: false,
    isGhost: false,
    ...overrides,
  };
}

describe("canTraverse — normal terrain heights", () => {
  it("allows flat movement (same height)", () => {
    expect(canTraverse(traversal({ fromHeight: 1, toHeight: 1 }))).toBe(true);
  });

  it("allows climbing a half-tile (0 → 0.5)", () => {
    expect(canTraverse(traversal({ fromHeight: 0, toHeight: 0.5 }))).toBe(true);
  });

  it("allows climbing a half-tile (0.5 → 1.0)", () => {
    expect(canTraverse(traversal({ fromHeight: 0.5, toHeight: 1 }))).toBe(true);
  });

  it("blocks climbing a full tile directly (0 → 1.0)", () => {
    expect(canTraverse(traversal({ fromHeight: 0, toHeight: 1 }))).toBe(false);
  });

  it("blocks climbing more than a half-tile (0 → 0.6)", () => {
    expect(canTraverse(traversal({ fromHeight: 0, toHeight: 0.6 }))).toBe(false);
  });

  it("allows descending a half-tile (1.0 → 0.5)", () => {
    expect(canTraverse(traversal({ fromHeight: 1, toHeight: 0.5 }))).toBe(true);
  });

  it("allows descending a full tile (1.0 → 0)", () => {
    expect(canTraverse(traversal({ fromHeight: 1, toHeight: 0 }))).toBe(true);
  });

  it("blocks descending more than a full tile (2.0 → 0)", () => {
    expect(canTraverse(traversal({ fromHeight: 2, toHeight: 0 }))).toBe(false);
  });
});

describe("canTraverse — flying", () => {
  it("allows climbing a full tile onto normal terrain", () => {
    expect(canTraverse(traversal({ fromHeight: 0, toHeight: 1, isFlying: true }))).toBe(true);
  });

  it("allows climbing 3 tiles onto normal terrain", () => {
    expect(canTraverse(traversal({ fromHeight: 0, toHeight: 3, isFlying: true }))).toBe(true);
  });

  it("allows descending any height onto normal terrain", () => {
    expect(canTraverse(traversal({ fromHeight: 3, toHeight: 0, isFlying: true }))).toBe(true);
  });

  it("allows flying onto an Obstacle (perch)", () => {
    expect(
      canTraverse(traversal({ toTerrain: TerrainType.Obstacle, toHeight: 1, isFlying: true })),
    ).toBe(true);
  });
});

describe("canTraverse — ghost", () => {
  it("allows traversing an Obstacle regardless of height (0 → 3)", () => {
    expect(
      canTraverse(
        traversal({ fromHeight: 0, toHeight: 3, toTerrain: TerrainType.Obstacle, isGhost: true }),
      ),
    ).toBe(true);
  });

  it("allows traversing an Obstacle with descent (3 → 0)", () => {
    expect(
      canTraverse(
        traversal({ fromHeight: 3, toHeight: 0, toTerrain: TerrainType.Obstacle, isGhost: true }),
      ),
    ).toBe(true);
  });

  it("allows stepping off an Obstacle to normal ground (phase exit, ignores descent limit)", () => {
    expect(
      canTraverse(
        traversal({
          fromHeight: 3,
          toHeight: 0,
          fromTerrain: TerrainType.Obstacle,
          toTerrain: TerrainType.Normal,
          isGhost: true,
        }),
      ),
    ).toBe(true);
  });

  it("allows stepping onto an Obstacle from normal ground (phase entry, ignores climb limit)", () => {
    expect(
      canTraverse(
        traversal({
          fromHeight: 0,
          toHeight: 3,
          fromTerrain: TerrainType.Normal,
          toTerrain: TerrainType.Obstacle,
          isGhost: true,
        }),
      ),
    ).toBe(true);
  });

  it("still respects normal height rules on non-Obstacle terrain", () => {
    expect(
      canTraverse(
        traversal({ fromHeight: 0, toHeight: 1, toTerrain: TerrainType.Normal, isGhost: true }),
      ),
    ).toBe(false);
  });

  it("prefers Flying rules when both flags are set (Ghost + Flying on any terrain)", () => {
    expect(
      canTraverse(traversal({ fromHeight: 0, toHeight: 5, isFlying: true, isGhost: true })),
    ).toBe(true);
  });

  it("blocks non-ghost non-flying on Obstacle", () => {
    expect(canTraverse(traversal({ toTerrain: TerrainType.Obstacle, toHeight: 1 }))).toBe(false);
  });
});

describe("canTraverse — impassable terrain", () => {
  it("blocks DeepWater for normal Pokemon", () => {
    expect(canTraverse(traversal({ toTerrain: TerrainType.DeepWater }))).toBe(false);
  });

  it("blocks Lava for normal Pokemon", () => {
    expect(canTraverse(traversal({ toTerrain: TerrainType.Lava }))).toBe(false);
  });

  it("blocks DeepWater for Ghost (Ghost only phases through Obstacle)", () => {
    expect(canTraverse(traversal({ toTerrain: TerrainType.DeepWater, isGhost: true }))).toBe(false);
  });
});

describe("canStopOn", () => {
  it("allows stopping on Normal terrain", () => {
    expect(canStopOn(TerrainType.Normal, false)).toBe(true);
  });

  it("blocks stopping on Obstacle for normal Pokemon", () => {
    expect(canStopOn(TerrainType.Obstacle, false)).toBe(false);
  });

  it("allows Flying to perch on Obstacle", () => {
    expect(canStopOn(TerrainType.Obstacle, true)).toBe(true);
  });

  it("blocks stopping on DeepWater even for Flying", () => {
    expect(canStopOn(TerrainType.DeepWater, true)).toBe(false);
  });

  it("blocks stopping on Lava even for Flying", () => {
    expect(canStopOn(TerrainType.Lava, true)).toBe(false);
  });

  it("blocks stopping on Obstacle for Ghost (Ghost traverses but never stops inside)", () => {
    expect(canStopOn(TerrainType.Obstacle, false)).toBe(false);
  });
});
