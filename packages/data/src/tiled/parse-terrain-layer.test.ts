import { TerrainType } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { parseTerrainLayer } from "./parse-terrain-layer";
import type { TiledLayer, TiledTileset } from "./tiled-types";

const tileset: TiledTileset = {
  firstgid: 1,
  name: "test",
  tilewidth: 32,
  tileheight: 32,
  tilecount: 5,
  columns: 5,
  tiles: [
    { id: 0, properties: [{ name: "terrain", type: "string", value: "normal" }] },
    {
      id: 1,
      properties: [
        { name: "terrain", type: "string", value: "water" },
        { name: "height", type: "int", value: 1 },
      ],
    },
    { id: 2, properties: [{ name: "terrain", type: "string", value: "obstacle" }] },
  ],
};

describe("parseTerrainLayer", () => {
  it("parses a 3x3 layer with mixed terrain", () => {
    const layer: TiledLayer = {
      name: "terrain",
      type: "tilelayer",
      width: 3,
      height: 3,
      visible: true,
      data: [1, 2, 1, 3, 1, 2, 1, 1, 3],
    };

    const tiles = parseTerrainLayer(layer, tileset, 3, 3);

    expect(tiles).toHaveLength(3);
    expect(tiles[0]).toHaveLength(3);

    expect(tiles[0]![0]!.terrain).toBe(TerrainType.Normal);
    expect(tiles[0]![0]!.position).toEqual({ x: 0, y: 0 });
    expect(tiles[0]![0]!.height).toBe(0);
    expect(tiles[0]![0]!.occupantId).toBeNull();

    expect(tiles[0]![1]!.terrain).toBe(TerrainType.Water);
    expect(tiles[0]![1]!.height).toBe(1);

    expect(tiles[1]![0]!.terrain).toBe(TerrainType.Obstacle);
    expect(tiles[1]![0]!.height).toBe(0);
  });

  it("treats GID 0 as obstacle", () => {
    const layer: TiledLayer = {
      name: "terrain",
      type: "tilelayer",
      width: 1,
      height: 1,
      visible: true,
      data: [0],
    };

    const tiles = parseTerrainLayer(layer, tileset, 1, 1);
    expect(tiles[0]![0]!.terrain).toBe(TerrainType.Obstacle);
  });

  it("throws on wrong layer type", () => {
    const layer: TiledLayer = {
      name: "spawns",
      type: "objectgroup",
      visible: true,
    };
    expect(() => parseTerrainLayer(layer, tileset, 3, 3)).toThrow("Expected tilelayer");
  });

  it("throws on data length mismatch", () => {
    const layer: TiledLayer = {
      name: "terrain",
      type: "tilelayer",
      width: 3,
      height: 3,
      visible: true,
      data: [1, 2, 3],
    };
    expect(() => parseTerrainLayer(layer, tileset, 3, 3)).toThrow("data length");
  });
});
