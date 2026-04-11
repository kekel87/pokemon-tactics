import { describe, expect, it } from "vitest";
import { MockMap } from "../testing";
import { hasLineOfSight } from "./line-of-sight";

describe("hasLineOfSight", () => {
  it("returns true on a flat line with no obstacles", () => {
    const grid = MockMap.buildGridWithHeights([[0, 0, 0, 0, 0]]);
    expect(hasLineOfSight(grid, { x: 0, y: 0 }, { x: 4, y: 0 }, 0)).toBe(true);
  });

  it("returns true for adjacent tiles even with a wall (no intermediate tile)", () => {
    const grid = MockMap.buildGridWithHeights([[0, 5]]);
    expect(hasLineOfSight(grid, { x: 0, y: 0 }, { x: 1, y: 0 }, 0)).toBe(true);
  });

  it("blocks when a pillar height 2 sits between two ground shooters (ref 0)", () => {
    const grid = MockMap.buildGridWithHeights([[0, 0, 2, 0, 0]]);
    expect(hasLineOfSight(grid, { x: 0, y: 0 }, { x: 4, y: 0 }, 0)).toBe(false);
  });

  it("does not block when the pillar equals referenceHeight + 1 (threshold)", () => {
    const grid = MockMap.buildGridWithHeights([[1, 1, 2, 1, 1]]);
    expect(hasLineOfSight(grid, { x: 0, y: 0 }, { x: 4, y: 0 }, 1)).toBe(true);
  });

  it("blocks when obstacle height strictly exceeds reference + 1", () => {
    const grid = MockMap.buildGridWithHeights([[1, 1, 3, 1, 1]]);
    expect(hasLineOfSight(grid, { x: 0, y: 0 }, { x: 4, y: 0 }, 1)).toBe(false);
  });

  it("uses the max of shooter and target as reference", () => {
    const grid = MockMap.buildGridWithHeights([[0, 0, 1, 0, 2]]);
    const ref = Math.max(0, 2);
    expect(hasLineOfSight(grid, { x: 0, y: 0 }, { x: 4, y: 0 }, ref)).toBe(true);
  });

  it("ignores out-of-bounds cells along the ray", () => {
    const grid = MockMap.buildGridWithHeights([
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
    expect(hasLineOfSight(grid, { x: 0, y: 0 }, { x: 2, y: 2 }, 0)).toBe(true);
  });

  it("blocks a diagonal ray when a pillar is on the bresenham path", () => {
    const grid = MockMap.buildGridWithHeights([
      [0, 0, 0, 0],
      [0, 5, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(hasLineOfSight(grid, { x: 0, y: 0 }, { x: 3, y: 3 }, 0)).toBe(false);
  });
});
