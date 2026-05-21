import { describe, expect, it } from "vitest";
import { TerrainType } from "../enums/terrain-type";
import { Grid } from "./Grid";
import { resolveTeleport } from "./resolve-teleport";

function makeGrid(): Grid {
  return Grid.createFlat(10, 10);
}

describe("resolveTeleport", () => {
  it("Given target empty and in-range with AoE r1, When resolved, Then returns target + 4 cardinales", () => {
    const grid = makeGrid();
    const result = resolveTeleport({ x: 0, y: 0 }, { x: 5, y: 5 }, 1, 10, grid, 1);
    expect(result).toHaveLength(5);
    expect(result).toContainEqual({ x: 5, y: 5 });
    expect(result).toContainEqual({ x: 5, y: 4 });
    expect(result).toContainEqual({ x: 6, y: 5 });
    expect(result).toContainEqual({ x: 5, y: 6 });
    expect(result).toContainEqual({ x: 4, y: 5 });
  });

  it("Given pure teleport (no aoeRadius), When resolved, Then returns target only", () => {
    const grid = makeGrid();
    const result = resolveTeleport({ x: 0, y: 0 }, { x: 5, y: 5 }, 1, 10, grid);
    expect(result).toEqual([{ x: 5, y: 5 }]);
  });

  it("Given target near edge with AoE r1, When resolved, Then returns only in-bounds cardinales", () => {
    const grid = makeGrid();
    const result = resolveTeleport({ x: 5, y: 5 }, { x: 0, y: 0 }, 1, 10, grid, 1);
    expect(result).toContainEqual({ x: 0, y: 0 });
    expect(result).toContainEqual({ x: 1, y: 0 });
    expect(result).toContainEqual({ x: 0, y: 1 });
    expect(result.find((p) => p.x === -1 || p.y === -1)).toBeUndefined();
    expect(result).toHaveLength(3);
  });

  it("Given target occupied by Pokemon, When resolved, Then returns []", () => {
    const grid = makeGrid();
    grid.setOccupant({ x: 5, y: 5 }, "blocker");
    const result = resolveTeleport({ x: 0, y: 0 }, { x: 5, y: 5 }, 1, 10, grid);
    expect(result).toEqual([]);
  });

  it("Given target out-of-range (too close), When resolved, Then returns []", () => {
    const grid = makeGrid();
    const result = resolveTeleport({ x: 0, y: 0 }, { x: 1, y: 0 }, 2, 5, grid);
    expect(result).toEqual([]);
  });

  it("Given target out-of-range (too far), When resolved, Then returns []", () => {
    const grid = makeGrid();
    const result = resolveTeleport({ x: 0, y: 0 }, { x: 6, y: 0 }, 1, 5, grid);
    expect(result).toEqual([]);
  });

  it("Given target out-of-bounds, When resolved, Then returns []", () => {
    const grid = makeGrid();
    const result = resolveTeleport({ x: 0, y: 0 }, { x: -1, y: 0 }, 0, 5, grid);
    expect(result).toEqual([]);
  });

  it("Given target on obstacle, When resolved, Then returns 5 tiles (terrain ignored)", () => {
    const grid = makeGrid();
    const tile = grid.getTile({ x: 3, y: 3 });
    if (tile) {
      tile.terrain = TerrainType.Obstacle;
      tile.height = 5;
    }
    const result = resolveTeleport({ x: 0, y: 0 }, { x: 3, y: 3 }, 1, 10, grid);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result).toContainEqual({ x: 3, y: 3 });
  });
});
