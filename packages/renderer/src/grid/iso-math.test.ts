import { describe, expect, it } from "vitest";
import {
  gridToScreen,
  type IsoProjectionContext,
  screenToGridWithHeight,
} from "./iso-math";

const context: IsoProjectionContext = {
  gridWidth: 10,
  gridHeight: 10,
  offsetX: 0,
  offsetY: 0,
};

function heightGrid(initializer: (x: number, y: number) => number): number[] {
  const data: number[] = [];
  for (let y = 0; y < context.gridHeight; y++) {
    for (let x = 0; x < context.gridWidth; x++) {
      data.push(initializer(x, y));
    }
  }
  return data;
}

describe("screenToGridWithHeight", () => {
  it("returns the cell under the pointer when no overlap", () => {
    const heights = heightGrid(() => 0);
    const center = gridToScreen(3, 4, 0, context);
    const result = screenToGridWithHeight(center.x, center.y, heights, context);
    expect(result).toEqual({ x: 3, y: 4 });
  });

  it("prefers the top candidate by default when two diamonds overlap at the same pixel", () => {
    const heights = heightGrid((x, y) => (x === 3 && y === 3 ? 2 : 0));
    const topCenter = gridToScreen(3, 3, 2, context);
    const result = screenToGridWithHeight(topCenter.x, topCenter.y, heights, context);
    expect(result).toEqual({ x: 3, y: 3 });
  });

  it("picks the lower-depth cell under the pillar top when preferLower is set", () => {
    const heights = heightGrid((x, y) => (x === 3 && y === 3 ? 2 : 0));
    const topCenter = gridToScreen(3, 3, 2, context);
    const result = screenToGridWithHeight(topCenter.x, topCenter.y, heights, context, {
      preferLower: true,
    });
    expect(result).not.toBeNull();
    expect(result).not.toEqual({ x: 3, y: 3 });
  });

  it("falls back to the only candidate when preferLower has no alternative", () => {
    const heights = heightGrid(() => 0);
    const center = gridToScreen(5, 5, 0, context);
    const result = screenToGridWithHeight(center.x, center.y, heights, context, {
      preferLower: true,
    });
    expect(result).toEqual({ x: 5, y: 5 });
  });

  it("returns null when the point falls outside every diamond", () => {
    const heights = heightGrid(() => 0);
    const result = screenToGridWithHeight(-9999, -9999, heights, context);
    expect(result).toBeNull();
  });
});
