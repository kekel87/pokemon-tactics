import { TerrainType } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import type { TiledTileset } from "./tiled-types";
import { resolveTileProperties } from "./tileset-resolver";

const baseTileset: TiledTileset = {
  firstgid: 1,
  name: "test",
  tilewidth: 32,
  tileheight: 32,
  tilecount: 10,
  columns: 5,
  tiles: [
    {
      id: 0,
      properties: [
        { name: "terrain", type: "string", value: "normal" },
        { name: "height", type: "int", value: 0 },
      ],
    },
    {
      id: 1,
      properties: [
        { name: "terrain", type: "string", value: "water" },
        { name: "height", type: "int", value: 0 },
      ],
    },
    {
      id: 2,
      properties: [
        { name: "terrain", type: "string", value: "lava" },
        { name: "height", type: "int", value: 2 },
      ],
    },
    {
      id: 3,
      properties: [{ name: "terrain", type: "string", value: "obstacle" }],
    },
  ],
};

describe("resolveTileProperties", () => {
  it("returns obstacle for GID 0 (empty tile)", () => {
    const result = resolveTileProperties(0, baseTileset);
    expect(result.terrain).toBe(TerrainType.Obstacle);
    expect(result.height).toBe(0);
  });

  it("resolves normal terrain from tileset properties", () => {
    const result = resolveTileProperties(1, baseTileset);
    expect(result.terrain).toBe(TerrainType.Normal);
    expect(result.height).toBe(0);
  });

  it("resolves water terrain", () => {
    const result = resolveTileProperties(2, baseTileset);
    expect(result.terrain).toBe(TerrainType.Water);
    expect(result.height).toBe(0);
  });

  it("resolves lava terrain with height", () => {
    const result = resolveTileProperties(3, baseTileset);
    expect(result.terrain).toBe(TerrainType.Lava);
    expect(result.height).toBe(2);
  });

  it("resolves obstacle terrain with default height", () => {
    const result = resolveTileProperties(4, baseTileset);
    expect(result.terrain).toBe(TerrainType.Obstacle);
    expect(result.height).toBe(0);
  });

  it("defaults to normal terrain when tile has no properties", () => {
    const result = resolveTileProperties(6, baseTileset);
    expect(result.terrain).toBe(TerrainType.Normal);
    expect(result.height).toBe(0);
  });

  it("throws on invalid terrain value", () => {
    const tileset: TiledTileset = {
      ...baseTileset,
      tiles: [
        {
          id: 0,
          properties: [{ name: "terrain", type: "string", value: "banana" }],
        },
      ],
    };
    expect(() => resolveTileProperties(1, tileset)).toThrow('Invalid terrain "banana"');
  });

  it("returns null slope by default", () => {
    const result = resolveTileProperties(1, baseTileset);
    expect(result.slope).toBeNull();
  });

  it("resolves the slope property when present", () => {
    const tileset: TiledTileset = {
      ...baseTileset,
      tiles: [
        {
          id: 0,
          properties: [
            { name: "terrain", type: "string", value: "normal" },
            { name: "height", type: "float", value: 0.5 },
            { name: "slope", type: "string", value: "east" },
          ],
        },
      ],
    };
    const result = resolveTileProperties(1, tileset);
    expect(result.slope).toBe("east");
    expect(result.height).toBe(0.5);
  });

  it("resolves correct tile when horizontal flip bit is set", () => {
    const rawGid = 0x80000001;
    const result = resolveTileProperties(rawGid, baseTileset);
    expect(result.terrain).toBe(TerrainType.Normal);
    expect(result.height).toBe(0);
  });

  it("mirrors slope direction across horizontal flip (east ↔ west, N/S unchanged)", () => {
    const tileset: TiledTileset = {
      ...baseTileset,
      tiles: [
        { id: 0, properties: [{ name: "slope", type: "string", value: "east" }] },
        { id: 1, properties: [{ name: "slope", type: "string", value: "south" }] },
      ],
    };
    const flipH = 0x80000000;
    expect(resolveTileProperties(1 | flipH, tileset).slope).toBe("west");
    expect(resolveTileProperties(2 | flipH, tileset).slope).toBe("south");
  });

  it("mirrors slope direction across vertical flip (north ↔ south, E/W unchanged)", () => {
    const tileset: TiledTileset = {
      ...baseTileset,
      tiles: [
        { id: 0, properties: [{ name: "slope", type: "string", value: "south" }] },
        { id: 1, properties: [{ name: "slope", type: "string", value: "east" }] },
      ],
    };
    const flipV = 0x40000000;
    expect(resolveTileProperties(1 | flipV, tileset).slope).toBe("north");
    expect(resolveTileProperties(2 | flipV, tileset).slope).toBe("east");
  });

  it("rotates slope direction across Tiled 90° rotation (flipD + flipH)", () => {
    const tileset: TiledTileset = {
      ...baseTileset,
      tiles: [{ id: 0, properties: [{ name: "slope", type: "string", value: "south" }] }],
    };
    // Tiled "rotate 90° clockwise" = flipD + flipH
    const rotate90 = 0x80000000 | 0x20000000;
    expect(resolveTileProperties(1 | rotate90, tileset).slope).toBe("west");
  });

  it("resolves all 11 terrain types", () => {
    for (const terrainValue of Object.values(TerrainType)) {
      const tileset: TiledTileset = {
        ...baseTileset,
        tiles: [
          {
            id: 0,
            properties: [{ name: "terrain", type: "string", value: terrainValue }],
          },
        ],
      };
      const result = resolveTileProperties(1, tileset);
      expect(result.terrain).toBe(terrainValue);
    }
  });
});
