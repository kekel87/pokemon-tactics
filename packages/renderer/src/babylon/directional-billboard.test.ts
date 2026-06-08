import { describe, expect, it } from "vitest";
import { computeDisplayDirection, type PmdDirection } from "./directional-billboard.js";

const QUARTER = Math.PI / 4;

describe("computeDisplayDirection", () => {
  it("Given camera at azimuth 0, maps each facing sector to the matching PMD direction", () => {
    const expected: PmdDirection[] = [
      "South",
      "SouthEast",
      "East",
      "NorthEast",
      "North",
      "NorthWest",
      "West",
      "SouthWest",
    ];
    for (let sector = 0; sector < 8; sector++) {
      expect(computeDisplayDirection(sector * QUARTER, 0)).toBe(expected[sector]);
    }
  });

  it("Given facing and camera rotate together, the displayed direction is stable", () => {
    // Sprite always shows South when its facing equals the camera azimuth.
    expect(computeDisplayDirection(0, 0)).toBe("South");
    expect(computeDisplayDirection(QUARTER, QUARTER)).toBe("South");
    expect(computeDisplayDirection(Math.PI, Math.PI)).toBe("South");
  });

  it("Given a negative relative angle, normalizes into [0, 2π)", () => {
    expect(computeDisplayDirection(-QUARTER, 0)).toBe("SouthWest");
    expect(computeDisplayDirection(0, QUARTER)).toBe("SouthWest");
  });

  it("Given the camera rotates a quarter-turn, the same world facing shows a shifted sprite", () => {
    // World facing East (sector 2). Camera turned +90° (2 sectors) → sprite reads South.
    expect(computeDisplayDirection(2 * QUARTER, 0)).toBe("East");
    expect(computeDisplayDirection(2 * QUARTER, 2 * QUARTER)).toBe("South");
  });

  it("Given angles beyond 2π, wraps correctly", () => {
    expect(computeDisplayDirection(2 * Math.PI, 0)).toBe("South");
    expect(computeDisplayDirection(2 * Math.PI + QUARTER, 0)).toBe("SouthEast");
  });
});
