import { describe, expect, it } from "vitest";
import { Grid } from "./Grid";
import {
  enumerateHitAndRunRetreatTiles,
  isValidHitAndRunRetreat,
} from "./validate-hit-and-run-retreat";

function makeGrid(): Grid {
  return Grid.createFlat(10, 10);
}

describe("isValidHitAndRunRetreat", () => {
  it("returns true for in-range empty in-bounds tile", () => {
    const grid = makeGrid();
    expect(isValidHitAndRunRetreat({ x: 5, y: 5 }, { x: 5, y: 8 }, { min: 1, max: 4 }, grid)).toBe(
      true,
    );
  });

  it("returns false for tile out of retreatRange (too far)", () => {
    const grid = makeGrid();
    expect(isValidHitAndRunRetreat({ x: 0, y: 0 }, { x: 5, y: 5 }, { min: 1, max: 4 }, grid)).toBe(
      false,
    );
  });

  it("returns false for tile too close (below min)", () => {
    const grid = makeGrid();
    expect(isValidHitAndRunRetreat({ x: 5, y: 5 }, { x: 5, y: 6 }, { min: 2, max: 4 }, grid)).toBe(
      false,
    );
  });

  it("returns false for tile out of bounds", () => {
    const grid = makeGrid();
    expect(isValidHitAndRunRetreat({ x: 0, y: 0 }, { x: -1, y: 0 }, { min: 1, max: 4 }, grid)).toBe(
      false,
    );
  });

  it("returns false for tile occupied by Pokemon", () => {
    const grid = makeGrid();
    grid.setOccupant({ x: 5, y: 8 }, "blocker");
    expect(isValidHitAndRunRetreat({ x: 5, y: 5 }, { x: 5, y: 8 }, { min: 1, max: 4 }, grid)).toBe(
      false,
    );
  });

  it("returns false for caster current position (no-op retreat)", () => {
    const grid = makeGrid();
    expect(isValidHitAndRunRetreat({ x: 5, y: 5 }, { x: 5, y: 5 }, { min: 0, max: 4 }, grid)).toBe(
      false,
    );
  });
});

describe("enumerateHitAndRunRetreatTiles", () => {
  it("returns all empty in-range tiles in center of grid", () => {
    const grid = makeGrid();
    const tiles = enumerateHitAndRunRetreatTiles({ x: 5, y: 5 }, { min: 1, max: 1 }, grid);
    expect(tiles).toHaveLength(4);
    expect(tiles).toContainEqual({ x: 4, y: 5 });
    expect(tiles).toContainEqual({ x: 6, y: 5 });
    expect(tiles).toContainEqual({ x: 5, y: 4 });
    expect(tiles).toContainEqual({ x: 5, y: 6 });
  });

  it("excludes occupied tiles", () => {
    const grid = makeGrid();
    grid.setOccupant({ x: 4, y: 5 }, "blocker");
    const tiles = enumerateHitAndRunRetreatTiles({ x: 5, y: 5 }, { min: 1, max: 1 }, grid);
    expect(tiles).toHaveLength(3);
    expect(tiles).not.toContainEqual({ x: 4, y: 5 });
  });

  it("clips at grid edges", () => {
    const grid = makeGrid();
    const tiles = enumerateHitAndRunRetreatTiles({ x: 0, y: 0 }, { min: 1, max: 2 }, grid);
    expect(tiles.every((t) => t.x >= 0 && t.y >= 0)).toBe(true);
  });

  it("returns empty array when caster fully surrounded", () => {
    const grid = makeGrid();
    grid.setOccupant({ x: 4, y: 5 }, "n");
    grid.setOccupant({ x: 6, y: 5 }, "e");
    grid.setOccupant({ x: 5, y: 4 }, "s");
    grid.setOccupant({ x: 5, y: 6 }, "w");
    const tiles = enumerateHitAndRunRetreatTiles({ x: 5, y: 5 }, { min: 1, max: 1 }, grid);
    expect(tiles).toEqual([]);
  });
});
