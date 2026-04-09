import { describe, expect, it } from "vitest";
import { CANVAS_HEIGHT, CANVAS_WIDTH, TILE_HEIGHT, TILE_WIDTH } from "../constants";
import {
  gridToScreen,
  type IsoProjectionContext,
  screenToGridFlat,
  screenToGridWithHeight,
} from "./iso-math";

function makeContext(gridWidth: number, gridHeight: number): IsoProjectionContext {
  const offsetX = CANVAS_WIDTH / 2;
  const isoTotalHeight = ((gridWidth + gridHeight) * TILE_HEIGHT) / 2;
  const offsetY = CANVAS_HEIGHT / 2 - isoTotalHeight / 2;
  return { gridWidth, gridHeight, offsetX, offsetY };
}

describe("gridToScreen + screenToGridFlat — roundtrip", () => {
  // Given a cell center in a flat grid
  // When converted to screen and back
  // Then we get the same cell
  it("round-trips flat grid cells to themselves", () => {
    const ctx = makeContext(5, 5);
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const screen = gridToScreen(x, y, 0, ctx);
        const back = screenToGridFlat(screen.x, screen.y, ctx);
        expect(back).toEqual({ x, y });
      }
    }
  });

  // Given a cell at height h
  // When screen is offset by `-h * TILE_ELEVATION_STEP`
  // Then the screen Y matches gridToScreen with that height
  it("heightens screen Y by TILE_ELEVATION_STEP per unit", () => {
    const ctx = makeContext(3, 3);
    const flat = gridToScreen(1, 1, 0, ctx);
    const raised = gridToScreen(1, 1, 1, ctx);
    expect(raised.x).toBe(flat.x);
    expect(raised.y).toBe(flat.y - 16);
  });

  // Given an out-of-bounds screen position
  // Then returns null
  it("returns null for screen positions outside the grid", () => {
    const ctx = makeContext(2, 2);
    // Far to the left/above the map
    const result = screenToGridFlat(-1000, -1000, ctx);
    expect(result).toBeNull();
  });
});

describe("screenToGridWithHeight — diamond hit test", () => {
  // Given a flat 1x1 grid with height 0
  // When mouse is exactly at the cell center
  // Then picks (0, 0)
  it("picks a flat cell when mouse is at its diamond center", () => {
    const ctx = makeContext(1, 1);
    const center = gridToScreen(0, 0, 0, ctx);
    const result = screenToGridWithHeight(center.x, center.y, [0], ctx);
    expect(result).toEqual({ x: 0, y: 0 });
  });

  // Given a 1x1 grid with an elevated cell
  // When mouse is at the elevated center
  // Then picks (0, 0)
  it("picks an elevated cell at its elevated center", () => {
    const ctx = makeContext(1, 1);
    const center = gridToScreen(0, 0, 1, ctx);
    const result = screenToGridWithHeight(center.x, center.y, [1], ctx);
    expect(result).toEqual({ x: 0, y: 0 });
  });

  // Given a 1x1 grid with height 2
  // When mouse is at ground level (where a flat cell would be)
  // Then returns null (mouse not in the elevated diamond)
  it("does not pick elevated cell when mouse is at ground level", () => {
    const ctx = makeContext(1, 1);
    const ground = gridToScreen(0, 0, 0, ctx);
    const result = screenToGridWithHeight(ground.x, ground.y, [2], ctx);
    expect(result).toBeNull();
  });

  // Given a 1x1 grid with height 0.5 (half-tile)
  // When mouse is at the half-tile's diamond center
  // Then picks (0, 0)
  it("picks a half-tile at height 0.5", () => {
    const ctx = makeContext(1, 1);
    const center = gridToScreen(0, 0, 0.5, ctx);
    const result = screenToGridWithHeight(center.x, center.y, [0.5], ctx);
    expect(result).toEqual({ x: 0, y: 0 });
  });

  // Given a 2x1 grid with different heights per cell
  // When mouse is on the elevated cell
  // Then picks the elevated cell (not the flat one)
  it("picks the correct cell by its own height", () => {
    const ctx = makeContext(2, 1);
    const heights = [0, 1]; // cell (1, 0) is elevated
    const center = gridToScreen(1, 0, 1, ctx);
    const result = screenToGridWithHeight(center.x, center.y, heights, ctx);
    expect(result).toEqual({ x: 1, y: 0 });
  });

  // Given a 2x1 grid
  // When mouse is on the flat cell
  // Then picks the flat cell
  it("picks the flat cell when hovering its diamond", () => {
    const ctx = makeContext(2, 1);
    const heights = [0, 1];
    const center = gridToScreen(0, 0, 0, ctx);
    const result = screenToGridWithHeight(center.x, center.y, heights, ctx);
    expect(result).toEqual({ x: 0, y: 0 });
  });

  // Given a mouse position far from any diamond
  // Then returns null
  it("returns null when mouse is outside all diamonds", () => {
    const ctx = makeContext(1, 1);
    const result = screenToGridWithHeight(10000, 10000, [0], ctx);
    expect(result).toBeNull();
  });

  // Given a click exactly on the top vertex of a diamond
  // Then it counts as inside (edge of diamond)
  it("includes the edge of the diamond (boundary inclusive)", () => {
    const ctx = makeContext(1, 1);
    const center = gridToScreen(0, 0, 0, ctx);
    // Top vertex of diamond: center.y - halfH (= center.y - 8)
    const topVertex = { x: center.x, y: center.y - TILE_HEIGHT / 2 };
    const result = screenToGridWithHeight(topVertex.x, topVertex.y, [0], ctx);
    expect(result).toEqual({ x: 0, y: 0 });
  });

  // Given a click just outside the diamond
  // Then returns null
  it("rejects clicks just outside the diamond", () => {
    const ctx = makeContext(1, 1);
    const center = gridToScreen(0, 0, 0, ctx);
    // 1 pixel above the top vertex
    const outside = { x: center.x, y: center.y - TILE_HEIGHT / 2 - 1 };
    const result = screenToGridWithHeight(outside.x, outside.y, [0], ctx);
    expect(result).toBeNull();
  });

  // Given a 3x3 flat grid (all height 0)
  // When clicking on each cell's center
  // Then each cell is picked correctly
  it("picks each cell individually in a flat 3x3 grid", () => {
    const ctx = makeContext(3, 3);
    const heights = [0, 0, 0, 0, 0, 0, 0, 0, 0];

    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        const center = gridToScreen(x, y, 0, ctx);
        const result = screenToGridWithHeight(center.x, center.y, heights, ctx);
        expect(result).toEqual({ x, y });
      }
    }
  });

  // Given a 3x3 grid with a uniform height > 0
  // When clicking on each cell's elevated center
  // Then each cell is picked correctly
  it("picks each cell individually in a uniformly elevated 3x3 grid", () => {
    const ctx = makeContext(3, 3);
    const heights = new Array(9).fill(1.5);

    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        const center = gridToScreen(x, y, 1.5, ctx);
        const result = screenToGridWithHeight(center.x, center.y, heights, ctx);
        expect(result).toEqual({ x, y });
      }
    }
  });

  // Given two cells whose top diamonds land on the same screen position
  // (iso collision: cell (x, y, h) and cell (x+2, y+2, h+2))
  // Then the cell with higher visual depth (closer to camera) wins
  it("resolves iso overlap by choosing the visually front cell", () => {
    const ctx = makeContext(3, 3);
    const heights = [
      0, 0, 0, //
      0, 0, 0, //
      0, 0, 2, //
    ];
    // (0, 0) h=0 center and (2, 2) h=2 center are the same screen position
    const center = gridToScreen(0, 0, 0, ctx);
    const centerFront = gridToScreen(2, 2, 2, ctx);
    expect(center).toEqual(centerFront);

    const result = screenToGridWithHeight(center.x, center.y, heights, ctx);
    // (2, 2) has depth (2+2)*5 + 2 = 22, (0, 0) has depth 0 → (2, 2) wins
    expect(result).toEqual({ x: 2, y: 2 });
  });

  // Given a 1x1 grid with a tall tower (height 4)
  // When mouse is at the top diamond
  // Then picks (0, 0)
  it("picks a tall stack at height 4", () => {
    const ctx = makeContext(1, 1);
    const center = gridToScreen(0, 0, 4, ctx);
    const result = screenToGridWithHeight(center.x, center.y, [4], ctx);
    expect(result).toEqual({ x: 0, y: 0 });
  });

  // Given a 2x2 grid where a tall column is at (0, 0) and flat tiles around
  // When mouse is at the column top
  // Then picks (0, 0) even though other cells exist
  it("picks the tall column over neighboring flat cells", () => {
    const ctx = makeContext(2, 2);
    const heights = [
      3, 0, //
      0, 0, //
    ];
    const center = gridToScreen(0, 0, 3, ctx);
    const result = screenToGridWithHeight(center.x, center.y, heights, ctx);
    expect(result).toEqual({ x: 0, y: 0 });
  });

  // Given two cells whose top diamonds happen to overlap at a point
  // Then the cell with the higher visual depth wins
  it("prioritizes higher visual depth on overlap", () => {
    const ctx = makeContext(2, 2);
    // cell (1, 1) flat, cell (0, 0) at height 2: their screen positions differ but
    // we craft a click point where depth sorting matters
    const heights = [
      0, 0, //
      0, 2, //
    ];
    const centerFarCorner = gridToScreen(1, 1, 2, ctx);
    const result = screenToGridWithHeight(
      centerFarCorner.x,
      centerFarCorner.y,
      heights,
      ctx,
    );
    expect(result).toEqual({ x: 1, y: 1 });
  });
});
