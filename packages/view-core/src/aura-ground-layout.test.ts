import { describe, expect, it } from "vitest";
import { auraGroundIconLayout } from "./aura-ground-layout.js";

describe("auraGroundIconLayout", () => {
  it("Given one symbol, centres it", () => {
    expect(auraGroundIconLayout(1, 10)).toEqual([{ x: 0, y: 0 }]);
  });

  it("Given two symbols, places them side by side at ±spacing", () => {
    expect(auraGroundIconLayout(2, 10)).toEqual([
      { x: -10, y: 0 },
      { x: 10, y: 0 },
    ]);
  });

  it("Returns one offset per symbol for counts 1–6", () => {
    for (let count = 1; count <= 6; count++) {
      expect(auraGroundIconLayout(count, 8)).toHaveLength(count);
    }
  });

  it("Given more than six, reuses the six-slot grid", () => {
    expect(auraGroundIconLayout(9, 8)).toHaveLength(6);
  });
});
