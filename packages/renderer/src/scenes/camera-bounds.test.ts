import { describe, expect, it } from "vitest";
import { TILE_ELEVATION_STEP } from "../constants";
import { computeCameraBounds } from "./camera-bounds";

describe("computeCameraBounds", () => {
  it("returns a bounds rectangle that encloses a flat grid", () => {
    const flat = computeCameraBounds(12, 12, 0);

    expect(flat.width).toBeGreaterThan(0);
    expect(flat.height).toBeGreaterThan(0);
  });

  it("extends bounds vertically when tiles are elevated", () => {
    const flat = computeCameraBounds(12, 12, 0);
    const tall = computeCameraBounds(12, 12, 4);

    const elevationExtra = 4 * TILE_ELEVATION_STEP;

    expect(tall.height).toBeGreaterThan(flat.height);
    // boundsHeight grows by 3 * elevationExtra: one inside the grid, one in
    // the top margin, one in the bottom margin.
    expect(tall.height - flat.height).toBeCloseTo(elevationExtra * 3);
  });

  it("moves the top of the bounds upwards when tiles are elevated", () => {
    const flat = computeCameraBounds(12, 12, 0);
    const tall = computeCameraBounds(12, 12, 3);

    expect(tall.y).toBeLessThan(flat.y);
  });

  it("keeps horizontal bounds unchanged when elevation grows", () => {
    const flat = computeCameraBounds(12, 12, 0);
    const tall = computeCameraBounds(12, 12, 5);

    expect(tall.x).toBeCloseTo(flat.x);
    expect(tall.width).toBeCloseTo(flat.width);
  });

  it("scales with grid size", () => {
    const small = computeCameraBounds(6, 6, 0);
    const large = computeCameraBounds(18, 18, 0);

    expect(large.width).toBeGreaterThan(small.width);
    expect(large.height).toBeGreaterThan(small.height);
  });
});
