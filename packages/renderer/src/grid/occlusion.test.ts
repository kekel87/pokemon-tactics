import { describe, expect, it } from "vitest";
import { isOccludedBy } from "./occlusion";

describe("isOccludedBy", () => {
  const pokemon = { x: 3, y: 3 };

  it("returns true for an adjacent tile in front that is tall enough", () => {
    expect(isOccludedBy(pokemon, { x: 4, y: 3, elevation: 1 })).toBe(true);
  });

  it("returns true at the exact maximum distance (2) on the same iso column", () => {
    expect(isOccludedBy(pokemon, { x: 4, y: 4, elevation: 2 })).toBe(true);
  });

  it("returns false when the tile is beyond the maximum distance (3)", () => {
    expect(isOccludedBy(pokemon, { x: 6, y: 3, elevation: 3 })).toBe(false);
  });

  it("returns false when the tile is in front but on a different iso column", () => {
    expect(isOccludedBy(pokemon, { x: 5, y: 3, elevation: 2 })).toBe(false);
  });

  it("returns false when the tile is flat (elevation 0)", () => {
    expect(isOccludedBy(pokemon, { x: 4, y: 3, elevation: 0 })).toBe(false);
  });

  it("returns false when the tile is behind the Pokemon", () => {
    expect(isOccludedBy(pokemon, { x: 2, y: 2, elevation: 3 })).toBe(false);
  });

  it("returns false when the tile sits on the same iso depth line", () => {
    expect(isOccludedBy(pokemon, { x: 5, y: 1, elevation: 3 })).toBe(false);
  });
});
