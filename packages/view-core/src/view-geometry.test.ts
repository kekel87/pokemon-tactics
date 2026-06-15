import { describe, expect, it } from "vitest";
import { gridToWorldXZ, tileBodyHeight, tileTopCenter } from "./view-geometry.js";

describe("tileBodyHeight", () => {
  it("floors at minHeight then scales", () => {
    expect(tileBodyHeight(1, 0.5, 0.866)).toBeCloseTo(0.866);
    expect(tileBodyHeight(0.5, 0.5, 0.866)).toBeCloseTo(0.433);
    expect(tileBodyHeight(0, 0.5, 0.866)).toBeCloseTo(0.433);
  });
});

describe("gridToWorldXZ handedness", () => {
  const mapWidth = 4;
  const mapHeight = 6;

  it("left-handed (Babylon) transposes gridX to Z, gridY to X", () => {
    expect(gridToWorldXZ(0, 0, mapWidth, mapHeight, "left-handed")).toEqual({
      x: 0 - mapHeight / 2 + 0.5,
      z: 0 - mapWidth / 2 + 0.5,
    });
    expect(gridToWorldXZ(3, 1, mapWidth, mapHeight, "left-handed")).toEqual({
      x: 1 - mapHeight / 2 + 0.5,
      z: 3 - mapWidth / 2 + 0.5,
    });
  });

  it("right-handed (Three) maps gridX to X, gridY to Z to un-mirror", () => {
    expect(gridToWorldXZ(3, 1, mapWidth, mapHeight, "right-handed")).toEqual({
      x: 3 - mapWidth / 2 + 0.5,
      z: 1 - mapHeight / 2 + 0.5,
    });
  });

  it("the two handednesses are mirror images with x and z swapped", () => {
    const left = gridToWorldXZ(3, 1, mapWidth, mapHeight, "left-handed");
    const right = gridToWorldXZ(3, 1, mapWidth, mapHeight, "right-handed");
    expect(left.x).toEqual(right.z);
    expect(left.z).toEqual(right.x);
  });
});

describe("tileTopCenter", () => {
  it("combines XZ placement with the scaled body height as Y", () => {
    expect(tileTopCenter(2, 2, 1, 4, 4, "right-handed", 0.5, 0.866)).toEqual({
      x: 0.5,
      y: tileBodyHeight(1, 0.5, 0.866),
      z: 0.5,
    });
  });
});
