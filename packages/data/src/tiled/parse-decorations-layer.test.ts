import { TerrainType } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { parseTiledMap } from "./parse-tiled-map";
import type { TiledMap, TiledObject } from "./tiled-types";

function buildMap(decorationObjects: TiledObject[], overrides?: Partial<TiledMap>): TiledMap {
  return {
    width: 5,
    height: 5,
    tilewidth: 32,
    tileheight: 16,
    orientation: "isometric",
    properties: [
      { name: "id", type: "string", value: "deco-test" },
      { name: "name", type: "string", value: "Deco Test" },
    ],
    tilesets: [
      {
        firstgid: 1,
        name: "terrain",
        tilewidth: 32,
        tileheight: 32,
        tilecount: 3,
        columns: 3,
        tiles: [
          { id: 0, properties: [{ name: "terrain", type: "string", value: "normal" }] },
          { id: 1, properties: [{ name: "terrain", type: "string", value: "deep_water" }] },
        ],
      },
      {
        firstgid: 100,
        name: "decorations",
        tilewidth: 32,
        tileheight: 32,
        tilecount: 4,
        columns: 1,
        tiles: [
          {
            id: 0,
            properties: [
              { name: "kind", type: "string", value: "rock_1" },
              { name: "footprint_width", type: "int", value: 1 },
              { name: "footprint_height", type: "int", value: 1 },
              { name: "height_units", type: "int", value: 1 },
            ],
          },
          {
            id: 1,
            properties: [
              { name: "kind", type: "string", value: "rock_2x2" },
              { name: "footprint_width", type: "int", value: 2 },
              { name: "footprint_height", type: "int", value: 2 },
              { name: "height_units", type: "int", value: 2 },
            ],
          },
          {
            id: 2,
            properties: [
              { name: "kind", type: "string", value: "tree" },
              { name: "footprint_width", type: "int", value: 1 },
              { name: "footprint_height", type: "int", value: 1 },
              { name: "height_units", type: "int", value: 3 },
            ],
          },
          {
            id: 3,
            properties: [
              { name: "kind", type: "string", value: "tall_grass" },
              { name: "footprint_width", type: "int", value: 1 },
              { name: "footprint_height", type: "int", value: 1 },
              { name: "height_units", type: "int", value: 0 },
            ],
          },
        ],
      },
    ],
    layers: [
      {
        name: "terrain",
        type: "tilelayer",
        width: 5,
        height: 5,
        visible: true,
        data: new Array(25).fill(1),
      },
      {
        name: "decorations",
        type: "objectgroup",
        visible: true,
        objects: decorationObjects,
      },
      {
        name: "spawns",
        type: "objectgroup",
        visible: true,
        objects: [
          {
            id: 1,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            name: "s1",
            type: "",
            properties: [
              { name: "teamIndex", type: "int", value: 0 },
              { name: "formatTeamCount", type: "int", value: 2 },
            ],
          },
          {
            id: 2,
            x: 64,
            y: 64,
            width: 0,
            height: 0,
            name: "s2",
            type: "",
            properties: [
              { name: "teamIndex", type: "int", value: 1 },
              { name: "formatTeamCount", type: "int", value: 2 },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

/**
 * Build a Tiled decoration object anchored at grid (anchorX, anchorY).
 *
 * The parser derives the anchor cell from `object.x` / `object.y` using the iso
 * formula (`floor(x / halfTileWidth)`, `floor(y / tileHeight)`), so we convert
 * the grid coords back to a pixel position in the middle of the target cell.
 */
function makeDecoObject(
  id: number,
  gid: number,
  anchorX: number,
  anchorY: number,
  extraProps: TiledObject["properties"] = [],
): TiledObject {
  const halfTileWidth = 16;
  const tileHeight = 16;
  return {
    id,
    x: anchorX * halfTileWidth,
    y: anchorY * tileHeight,
    width: 32,
    height: 32,
    name: "",
    type: "",
    gid,
    properties: extraProps ?? [],
  };
}

describe("parseDecorationsLayer", () => {
  it("extracts a single 1x1 rock and patches the terrain", () => {
    const map = buildMap([makeDecoObject(1, 100, 2, 2)]);
    const result = parseTiledMap(map);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.decorationObjects).toHaveLength(1);
    expect(result.decorationObjects[0]).toMatchObject({
      kind: "rock_1",
      anchorX: 2,
      anchorY: 2,
      footprintWidth: 1,
      footprintHeight: 1,
      heightUnits: 1,
    });

    expect(result.map.tiles[2]![2]!.terrain).toBe(TerrainType.Obstacle);
    expect(result.map.tiles[2]![2]!.height).toBe(1);
  });

  it("patches 4 tiles for a 2x2 rock (anchor is south-east corner)", () => {
    const map = buildMap([makeDecoObject(1, 101, 2, 3)]);
    const result = parseTiledMap(map);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    for (const [x, y] of [
      [2, 3],
      [3, 3],
      [2, 2],
      [3, 2],
    ]) {
      expect(result.map.tiles[y]![x]!.terrain).toBe(TerrainType.Obstacle);
      expect(result.map.tiles[y]![x]!.height).toBe(2);
    }
  });

  it("patches a 1x1x3 tree", () => {
    const map = buildMap([makeDecoObject(1, 102, 1, 1)]);
    const result = parseTiledMap(map);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.map.tiles[1]![1]!.terrain).toBe(TerrainType.Obstacle);
    expect(result.map.tiles[1]![1]!.height).toBe(3);
  });

  it("does NOT patch terrain for tall_grass decorations", () => {
    const map = buildMap([makeDecoObject(1, 103, 2, 2)]);
    const result = parseTiledMap(map);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.decorationObjects).toHaveLength(1);
    expect(result.decorationObjects[0]!.kind).toBe("tall_grass");
    expect(result.map.tiles[2]![2]!.terrain).toBe(TerrainType.Normal);
    expect(result.map.tiles[2]![2]!.height).toBe(0);
  });

  it("returns empty decorationObjects when layer is absent", () => {
    const baseMap = buildMap([]);
    const layers = baseMap.layers.filter((l) => l.name !== "decorations");
    const result = parseTiledMap({ ...baseMap, layers });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.decorationObjects).toEqual([]);
  });

  it("rejects an obstacle whose footprint goes out of map bounds", () => {
    const map = buildMap([makeDecoObject(1, 101, 4, 4)]);
    const result = parseTiledMap(map);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors[0]).toContain("out of map bounds");
  });

  it("rejects a decoration object without a gid (no tile reference)", () => {
    const badObject: TiledObject = {
      id: 1,
      x: 32,
      y: 32,
      width: 32,
      height: 32,
      name: "",
      type: "",
      properties: [],
    };
    const map = buildMap([badObject]);
    const result = parseTiledMap(map);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors[0]).toContain("no gid");
  });

  it("derives the anchor cell from object pixel position (iso)", () => {
    const pixelObject: TiledObject = {
      id: 1,
      x: 48,
      y: 64,
      width: 32,
      height: 32,
      name: "",
      type: "",
      gid: 100,
      properties: [],
    };
    const map = buildMap([pixelObject]);
    const result = parseTiledMap(map);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.decorationObjects[0]).toMatchObject({
      kind: "rock_1",
      anchorX: 3,
      anchorY: 4,
    });
  });

  it("rejects an obstacle overlapping impassable terrain", () => {
    const map = buildMap([makeDecoObject(1, 100, 2, 2)]);
    const terrainLayer = map.layers.find((l) => l.name === "terrain");
    if (!terrainLayer || terrainLayer.type !== "tilelayer") {
      throw new Error("missing terrain layer in fixture");
    }
    const data = [...(terrainLayer.data ?? [])];
    data[2 * 5 + 2] = 2;
    const patchedLayers = map.layers.map((l) => (l.name === "terrain" ? { ...l, data } : l));
    const result = parseTiledMap({ ...map, layers: patchedLayers });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors[0]).toContain("impassable");
  });

  it("accepts a legacy empty decorations tilelayer with a warning (backward compat)", () => {
    const baseMap = buildMap([]);
    const layers = baseMap.layers.map((l) =>
      l.name === "decorations"
        ? {
            name: "decorations",
            type: "tilelayer" as const,
            width: 5,
            height: 5,
            visible: true,
            data: new Array(25).fill(0),
          }
        : l,
    );
    const result = parseTiledMap({ ...baseMap, layers });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.warnings.some((w) => w.includes("legacy empty tilelayer"))).toBe(true);
    expect(result.decorationObjects).toEqual([]);
  });

  it("rejects a non-empty decorations tilelayer (must be objectgroup)", () => {
    const baseMap = buildMap([]);
    const layers = baseMap.layers.map((l) => {
      if (l.name !== "decorations") {
        return l;
      }
      const data = new Array(25).fill(0);
      data[0] = 100;
      return {
        name: "decorations",
        type: "tilelayer" as const,
        width: 5,
        height: 5,
        visible: true,
        data,
      };
    });
    const result = parseTiledMap({ ...baseMap, layers });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors[0]).toContain("objectgroup");
  });
});
