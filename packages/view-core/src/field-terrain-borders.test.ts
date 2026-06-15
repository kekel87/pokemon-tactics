import { describe, expect, it } from "vitest";
import { fieldTerrainBorderEdges } from "./field-terrain-borders.js";

describe("fieldTerrainBorderEdges", () => {
  it("Given a single tile, all four sides are border edges", () => {
    const edges = fieldTerrainBorderEdges([{ x: 2, y: 3 }]);
    expect(edges).toHaveLength(4);
    expect(new Set(edges.map((e) => e.side))).toEqual(
      new Set(["xPlus", "xMinus", "yPlus", "yMinus"]),
    );
  });

  it("Given two tiles adjacent on x, the shared edge is not a border", () => {
    const edges = fieldTerrainBorderEdges([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
    expect(edges).not.toContainEqual({ x: 0, y: 0, side: "xPlus" });
    expect(edges).not.toContainEqual({ x: 1, y: 0, side: "xMinus" });
    expect(edges).toContainEqual({ x: 0, y: 0, side: "xMinus" });
    expect(edges).toContainEqual({ x: 1, y: 0, side: "xPlus" });
    expect(edges).toHaveLength(6);
  });

  it("Given an interior tile fully surrounded, it contributes no border edge", () => {
    const cross = [
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 0 },
      { x: 1, y: 2 },
    ];
    const edges = fieldTerrainBorderEdges(cross);
    expect(edges.filter((e) => e.x === 1 && e.y === 1)).toHaveLength(0);
  });
});
