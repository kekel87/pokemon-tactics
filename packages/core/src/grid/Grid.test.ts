import { describe, expect, it } from "vitest";

import { TerrainType } from "../enums/terrain-type";
import { manhattanDistance } from "../utils/manhattan-distance";
import { Grid } from "./Grid";

describe("Grid", () => {
  describe("createFlat", () => {
    it("should create a flat grid with correct dimensions", () => {
      const grid = Grid.createFlat(12, 12);
      expect(grid.width).toBe(12);
      expect(grid.height).toBe(12);
    });

    it("should create tiles with normal passable terrain at height 0", () => {
      const grid = Grid.createFlat(4, 4);
      const tile = grid.getTile({ x: 2, y: 3 });
      expect(tile).not.toBeNull();
      expect(tile?.terrain).toBe(TerrainType.Normal);
      expect(tile?.isPassable).toBe(true);
      expect(tile?.height).toBe(0);
      expect(tile?.occupantId).toBeNull();
    });
  });

  describe("isInBounds", () => {
    const grid = Grid.createFlat(4, 4);

    it("should return true for valid positions", () => {
      expect(grid.isInBounds({ x: 0, y: 0 })).toBe(true);
      expect(grid.isInBounds({ x: 3, y: 3 })).toBe(true);
    });

    it("should return false for out-of-bounds positions", () => {
      expect(grid.isInBounds({ x: -1, y: 0 })).toBe(false);
      expect(grid.isInBounds({ x: 4, y: 0 })).toBe(false);
      expect(grid.isInBounds({ x: 0, y: -1 })).toBe(false);
      expect(grid.isInBounds({ x: 0, y: 4 })).toBe(false);
    });
  });

  describe("getTile", () => {
    it("should return null for out-of-bounds", () => {
      const grid = Grid.createFlat(4, 4);
      expect(grid.getTile({ x: 10, y: 10 })).toBeNull();
    });
  });

  describe("getNeighbors", () => {
    const grid = Grid.createFlat(4, 4);

    it("should return 4 neighbors for a center tile", () => {
      expect(grid.getNeighbors({ x: 2, y: 2 })).toHaveLength(4);
    });

    it("should return 2 neighbors for a corner tile", () => {
      expect(grid.getNeighbors({ x: 0, y: 0 })).toHaveLength(2);
    });

    it("should return 3 neighbors for an edge tile", () => {
      expect(grid.getNeighbors({ x: 0, y: 1 })).toHaveLength(3);
    });
  });

  describe("getOccupant / setOccupant", () => {
    it("should track tile occupants", () => {
      const grid = Grid.createFlat(4, 4);
      expect(grid.getOccupant({ x: 1, y: 1 })).toBeNull();

      grid.setOccupant({ x: 1, y: 1 }, "bulbasaur-1");
      expect(grid.getOccupant({ x: 1, y: 1 })).toBe("bulbasaur-1");

      grid.setOccupant({ x: 1, y: 1 }, null);
      expect(grid.getOccupant({ x: 1, y: 1 })).toBeNull();
    });

    it("should ignore setOccupant on out-of-bounds position", () => {
      const grid = Grid.createFlat(4, 4);
      grid.setOccupant({ x: 99, y: 99 }, "test");
      expect(grid.getOccupant({ x: 99, y: 99 })).toBeNull();
    });
  });

  describe("getTilesInRange", () => {
    const grid = Grid.createFlat(8, 8);

    it("should return tiles within manhattan distance", () => {
      const tiles = grid.getTilesInRange({ x: 4, y: 4 }, 1, 2);
      expect(tiles.length).toBe(12);
    });

    it("should return only the origin for range 0-0", () => {
      const tiles = grid.getTilesInRange({ x: 4, y: 4 }, 0, 0);
      expect(tiles).toHaveLength(1);
      expect(tiles[0]).toEqual({ x: 4, y: 4 });
    });

    it("should clip to grid bounds", () => {
      const tiles = grid.getTilesInRange({ x: 0, y: 0 }, 1, 1);
      expect(tiles).toHaveLength(2);
    });
  });

  describe("getHeightDifference", () => {
    it("should return 0 for flat grid", () => {
      const grid = Grid.createFlat(4, 4);
      expect(grid.getHeightDifference({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(0);
    });

    it("should return 0 when a position is out-of-bounds", () => {
      const grid = Grid.createFlat(4, 4);
      expect(grid.getHeightDifference({ x: 0, y: 0 }, { x: 99, y: 99 })).toBe(0);
      expect(grid.getHeightDifference({ x: 99, y: 99 }, { x: 0, y: 0 })).toBe(0);
    });
  });
});

describe("manhattanDistance", () => {
  it("should calculate distance correctly", () => {
    expect(manhattanDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7);
    expect(manhattanDistance({ x: 2, y: 2 }, { x: 2, y: 2 })).toBe(0);
    expect(manhattanDistance({ x: 1, y: 1 }, { x: 3, y: 1 })).toBe(2);
  });
});
