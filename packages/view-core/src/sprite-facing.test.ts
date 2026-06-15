import { Direction } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import {
  computeDisplayDirection,
  type PmdDirection,
  worldFacingFromDirection,
} from "./sprite-facing.js";

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
    expect(computeDisplayDirection(0, 0)).toBe("South");
    expect(computeDisplayDirection(QUARTER, QUARTER)).toBe("South");
    expect(computeDisplayDirection(Math.PI, Math.PI)).toBe("South");
  });

  it("Given a negative relative angle, normalizes into [0, 2π)", () => {
    expect(computeDisplayDirection(-QUARTER, 0)).toBe("SouthWest");
    expect(computeDisplayDirection(0, QUARTER)).toBe("SouthWest");
  });

  it("Given the camera rotates a quarter-turn, the same world facing shows a shifted sprite", () => {
    expect(computeDisplayDirection(2 * QUARTER, 0)).toBe("East");
    expect(computeDisplayDirection(2 * QUARTER, 2 * QUARTER)).toBe("South");
  });

  it("Given angles beyond 2π, wraps correctly", () => {
    expect(computeDisplayDirection(2 * Math.PI, 0)).toBe("South");
    expect(computeDisplayDirection(2 * Math.PI + QUARTER, 0)).toBe("SouthEast");
  });
});

describe("worldFacingFromDirection", () => {
  it("Given camera at azimuth 0, each core direction shows its matching PMD frame", () => {
    expect(computeDisplayDirection(worldFacingFromDirection(Direction.South), 0)).toBe("South");
    expect(computeDisplayDirection(worldFacingFromDirection(Direction.East), 0)).toBe("East");
    expect(computeDisplayDirection(worldFacingFromDirection(Direction.North), 0)).toBe("North");
    expect(computeDisplayDirection(worldFacingFromDirection(Direction.West), 0)).toBe("West");
  });

  it("Given the camera turns a quarter, the displayed sprite shifts accordingly", () => {
    const quarter = Math.PI / 2;
    expect(computeDisplayDirection(worldFacingFromDirection(Direction.South), quarter)).toBe(
      "West",
    );
    expect(computeDisplayDirection(worldFacingFromDirection(Direction.East), quarter)).toBe(
      "South",
    );
  });
});
