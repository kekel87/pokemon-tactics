import { Direction } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { computeDisplayDirection } from "./directional-billboard.js";
import { worldFacingFromDirection } from "./world-facing.js";

describe("worldFacingFromDirection", () => {
  it("Given camera at azimuth 0, each grid direction displays its matching PMD sprite", () => {
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
