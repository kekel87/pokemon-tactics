import { TerrainType } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { parseTiledMap } from "./parse-tiled-map";
import type { TiledMap } from "./tiled-types";

function buildMinimalTiledMap(overrides?: Partial<TiledMap>): TiledMap {
  return {
    width: 3,
    height: 3,
    tilewidth: 32,
    tileheight: 32,
    orientation: "isometric",
    properties: [
      { name: "id", type: "string", value: "test-map" },
      { name: "name", type: "string", value: "Test Map" },
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
          { id: 1, properties: [{ name: "terrain", type: "string", value: "water" }] },
        ],
      },
    ],
    layers: [
      {
        name: "terrain",
        type: "tilelayer",
        width: 3,
        height: 3,
        visible: true,
        data: [1, 1, 1, 1, 2, 1, 1, 1, 1],
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

describe("parseTiledMap", () => {
  it("parses a valid minimal map", () => {
    const result = parseTiledMap(buildMinimalTiledMap());

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.map.id).toBe("test-map");
    expect(result.map.name).toBe("Test Map");
    expect(result.map.width).toBe(3);
    expect(result.map.height).toBe(3);
    expect(result.map.tiles).toHaveLength(3);
    expect(result.map.tiles[0]).toHaveLength(3);
    expect(result.map.tiles[1]![1]!.terrain).toBe(TerrainType.Water);
    expect(result.map.formats).toHaveLength(1);
    expect(result.map.formats[0]!.teamCount).toBe(2);
    expect(result.map.formats[0]!.spawnZones).toHaveLength(2);
  });

  it("reports missing terrain layer", () => {
    const tiledMap = buildMinimalTiledMap({
      layers: [
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
              name: "",
              type: "",
              properties: [
                { name: "teamIndex", type: "int", value: 0 },
                { name: "formatTeamCount", type: "int", value: 2 },
              ],
            },
          ],
        },
      ],
    });

    const result = parseTiledMap(tiledMap);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors[0]).toContain("terrain");
  });

  it("reports missing spawns layer", () => {
    const tiledMap = buildMinimalTiledMap({
      layers: [
        {
          name: "terrain",
          type: "tilelayer",
          width: 3,
          height: 3,
          visible: true,
          data: [1, 1, 1, 1, 1, 1, 1, 1, 1],
        },
      ],
    });

    const result = parseTiledMap(tiledMap);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors[0]).toContain("spawns");
  });

  it("reports missing tileset", () => {
    const tiledMap = buildMinimalTiledMap({ tilesets: [] });
    const result = parseTiledMap(tiledMap);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors[0]).toContain("tileset");
  });

  it("warns about missing decorations layer", () => {
    const result = parseTiledMap(buildMinimalTiledMap());
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.warnings).toContain('Optional layer "decorations" not found');
  });

  it("warns about missing map id and name", () => {
    const tiledMap = buildMinimalTiledMap({ properties: [] });
    const result = parseTiledMap(tiledMap);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.map.id).toBe("unnamed-map");
    expect(result.map.name).toBe("Unnamed Map");
    expect(result.warnings.some((w) => w.includes('"id"'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('"name"'))).toBe(true);
  });
});
