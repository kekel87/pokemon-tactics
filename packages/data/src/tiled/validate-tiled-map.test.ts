import type { MapDefinition, TileState } from "@pokemon-tactic/core";
import { TerrainType } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { validateTiledMap } from "./validate-tiled-map";

function buildTiles(width: number, height: number, terrain = TerrainType.Normal): TileState[][] {
  const tiles: TileState[][] = [];
  for (let y = 0; y < height; y++) {
    const row: TileState[] = [];
    for (let x = 0; x < width; x++) {
      row.push({ position: { x, y }, height: 0, terrain, occupantId: null });
    }
    tiles.push(row);
  }
  return tiles;
}

function buildValidMap(): MapDefinition {
  return {
    id: "test",
    name: "Test",
    width: 4,
    height: 4,
    tiles: buildTiles(4, 4),
    formats: [
      {
        teamCount: 2,
        maxPokemonPerTeam: 1,
        spawnZones: [{ positions: [{ x: 0, y: 0 }] }, { positions: [{ x: 3, y: 3 }] }],
      },
    ],
  };
}

describe("validateTiledMap", () => {
  it("accepts a valid map", () => {
    const result = validateTiledMap(buildValidMap());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects spawn on obstacle terrain", () => {
    const map = buildValidMap();
    map.tiles[0]![0]!.terrain = TerrainType.Obstacle;
    const result = validateTiledMap(map);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("impassable terrain");
  });

  it("rejects spawn on deep_water terrain", () => {
    const map = buildValidMap();
    map.tiles[3]![3]!.terrain = TerrainType.DeepWater;
    const result = validateTiledMap(map);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("deep_water");
  });

  it("rejects insufficient spawn positions", () => {
    const map = buildValidMap();
    map.formats[0]!.maxPokemonPerTeam = 3;
    const result = validateTiledMap(map);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("needs at least 3");
  });

  it("rejects disconnected spawn zones", () => {
    const map = buildValidMap();
    map.tiles[0]![1]!.terrain = TerrainType.Obstacle;
    map.tiles[0]![2]!.terrain = TerrainType.Obstacle;
    map.tiles[1]![0]!.terrain = TerrainType.Obstacle;
    map.tiles[2]![0]!.terrain = TerrainType.Obstacle;
    map.tiles[1]![1]!.terrain = TerrainType.Obstacle;
    const result = validateTiledMap(map);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("no passable path"))).toBe(true);
  });

  it("accepts connected spawn zones through passable path", () => {
    const map = buildValidMap();
    const result = validateTiledMap(map);
    expect(result.valid).toBe(true);
  });

  it("warns about large height jumps", () => {
    const map = buildValidMap();
    map.tiles[0]![0]!.height = 0;
    map.tiles[0]![1]!.height = 5;
    const result = validateTiledMap(map);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes("Height jump of 5"))).toBe(true);
  });

  it("does not warn about small height differences", () => {
    const map = buildValidMap();
    map.tiles[0]![0]!.height = 0;
    map.tiles[0]![1]!.height = 2;
    const result = validateTiledMap(map);
    expect(result.warnings).toHaveLength(0);
  });
});
