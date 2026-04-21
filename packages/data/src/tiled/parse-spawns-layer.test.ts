import { describe, expect, it } from "vitest";
import {
  isSpawnLayerName,
  parseLegacySpawnsLayer,
  parseSpawnsLayers,
  SPAWN_LAYER_NAMES,
  SPAWN_LAYER_TO_TEAM_COUNT,
} from "./parse-spawns-layer";
import type { TiledLayer, TiledObject } from "./tiled-types";

function spawnObject(pixelX: number, pixelY: number, teamIndex: number, id = 1) {
  return {
    id,
    x: pixelX,
    y: pixelY,
    width: 0,
    height: 0,
    name: "",
    type: "",
    properties: [{ name: "teamIndex", type: "int" as const, value: teamIndex }],
  };
}

function rectSpawnObject(
  pixelX: number,
  pixelY: number,
  width: number,
  height: number,
  teamIndex: number,
  id = 1,
) {
  return {
    id,
    x: pixelX,
    y: pixelY,
    width,
    height,
    name: "",
    type: "",
    properties: [{ name: "teamIndex", type: "int" as const, value: teamIndex }],
  };
}

function polygonSpawnObject(
  originX: number,
  originY: number,
  polygon: readonly { x: number; y: number }[],
  teamIndex: number,
  id = 1,
) {
  return {
    id,
    x: originX,
    y: originY,
    width: 0,
    height: 0,
    name: "",
    type: "",
    polygon,
    properties: [{ name: "teamIndex", type: "int" as const, value: teamIndex }],
  };
}

function legacySpawnObject(
  pixelX: number,
  pixelY: number,
  teamIndex: number,
  formatTeamCount: number,
) {
  return {
    id: Math.random(),
    x: pixelX,
    y: pixelY,
    width: 0,
    height: 0,
    name: "",
    type: "",
    properties: [
      { name: "teamIndex", type: "int" as const, value: teamIndex },
      { name: "formatTeamCount", type: "int" as const, value: formatTeamCount },
    ],
  };
}

function makeLayer(name: string, objects: readonly TiledObject[]): TiledLayer {
  return { name, type: "objectgroup", visible: true, objects };
}

describe("SPAWN_LAYER_TO_TEAM_COUNT", () => {
  it("maps the 5 required layer names to team counts", () => {
    expect(SPAWN_LAYER_TO_TEAM_COUNT.spawns_1v1).toBe(2);
    expect(SPAWN_LAYER_TO_TEAM_COUNT.spawns_3p).toBe(3);
    expect(SPAWN_LAYER_TO_TEAM_COUNT.spawns_4p).toBe(4);
    expect(SPAWN_LAYER_TO_TEAM_COUNT.spawns_6p).toBe(6);
    expect(SPAWN_LAYER_TO_TEAM_COUNT.spawns_12p).toBe(12);
    expect(SPAWN_LAYER_NAMES).toHaveLength(5);
  });

  it("recognises valid layer names", () => {
    expect(isSpawnLayerName("spawns_1v1")).toBe(true);
    expect(isSpawnLayerName("spawns_12p")).toBe(true);
    expect(isSpawnLayerName("spawns")).toBe(false);
    expect(isSpawnLayerName("terrain")).toBe(false);
  });
});

describe("parseSpawnsLayers", () => {
  it("returns empty array when no spawn layers present", () => {
    const formats = parseSpawnsLayers([], 32, 32, 10, 10, "orthogonal");
    expect(formats).toEqual([]);
  });

  it("skips empty spawn layers", () => {
    const layers: TiledLayer[] = [makeLayer("spawns_1v1", [])];
    const formats = parseSpawnsLayers(layers, 32, 32, 10, 10, "orthogonal");
    expect(formats).toEqual([]);
  });

  it("parses a single populated layer into 1 format", () => {
    const layers: TiledLayer[] = [
      makeLayer("spawns_1v1", [
        spawnObject(0, 0, 0, 1),
        spawnObject(32, 0, 0, 2),
        spawnObject(0, 64, 1, 3),
        spawnObject(32, 64, 1, 4),
      ]),
    ];

    const formats = parseSpawnsLayers(layers, 32, 32, 10, 10, "orthogonal");

    expect(formats).toHaveLength(1);
    expect(formats[0]!.teamCount).toBe(2);
    expect(formats[0]!.maxPokemonPerTeam).toBe(2);
    expect(formats[0]!.spawnZones).toHaveLength(2);
    expect(formats[0]!.spawnZones[0]!.positions).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
    expect(formats[0]!.spawnZones[1]!.positions).toEqual([
      { x: 0, y: 2 },
      { x: 1, y: 2 },
    ]);
  });

  it("parses multiple formats from separate layers", () => {
    const layers: TiledLayer[] = [
      makeLayer("spawns_1v1", [spawnObject(0, 0, 0, 1), spawnObject(64, 64, 1, 2)]),
      makeLayer("spawns_4p", [
        spawnObject(0, 0, 0, 3),
        spawnObject(32, 0, 1, 4),
        spawnObject(64, 0, 2, 5),
        spawnObject(96, 0, 3, 6),
      ]),
    ];

    const formats = parseSpawnsLayers(layers, 32, 32, 10, 10, "orthogonal");

    expect(formats).toHaveLength(2);
    expect(formats[0]!.teamCount).toBe(2);
    expect(formats[1]!.teamCount).toBe(4);
    expect(formats[1]!.spawnZones).toHaveLength(4);
  });

  it("throws on missing teamIndex", () => {
    const layers: TiledLayer[] = [
      makeLayer("spawns_1v1", [
        {
          id: 1,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          name: "",
          type: "",
          properties: [],
        },
      ]),
    ];
    expect(() => parseSpawnsLayers(layers, 32, 32, 10, 10, "orthogonal")).toThrow("teamIndex");
  });

  it("derives teamIndex from class name when property is absent (Tiled default class value)", () => {
    const layers: TiledLayer[] = [
      makeLayer("spawns_1v1", [
        {
          id: 1,
          x: 0,
          y: 0,
          width: 96,
          height: 64,
          name: "",
          type: "spawn_team_0",
        },
        {
          id: 2,
          x: 0,
          y: 192,
          width: 96,
          height: 64,
          name: "",
          type: "spawn_team_1",
        },
      ]),
    ];

    const formats = parseSpawnsLayers(layers, 32, 32, 10, 10, "orthogonal");

    expect(formats).toHaveLength(1);
    expect(formats[0]!.spawnZones).toHaveLength(2);
    expect(formats[0]!.spawnZones[0]!.positions).toHaveLength(6);
    expect(formats[0]!.spawnZones[1]!.positions).toHaveLength(6);
  });

  it("property teamIndex takes precedence over class name if both present", () => {
    const layers: TiledLayer[] = [
      makeLayer("spawns_1v1", [
        {
          id: 1,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          name: "",
          type: "spawn_team_5",
          properties: [{ name: "teamIndex", type: "int", value: 1 }],
        },
        {
          id: 2,
          x: 0,
          y: 64,
          width: 0,
          height: 0,
          name: "",
          type: "spawn_team_0",
        },
      ]),
    ];

    const formats = parseSpawnsLayers(layers, 32, 32, 10, 10, "orthogonal");

    expect(formats).toHaveLength(1);
    expect(formats[0]!.spawnZones).toHaveLength(2);
    expect(formats[0]!.spawnZones[0]!.positions).toEqual([{ x: 0, y: 2 }]);
    expect(formats[0]!.spawnZones[1]!.positions).toEqual([{ x: 0, y: 0 }]);
  });

  it("enumerates all cells covered by a rectangle object", () => {
    const layers: TiledLayer[] = [
      makeLayer("spawns_1v1", [
        rectSpawnObject(0, 0, 96, 64, 0, 1),
        rectSpawnObject(0, 192, 96, 64, 1, 2),
      ]),
    ];

    const formats = parseSpawnsLayers(layers, 32, 32, 10, 10, "orthogonal");

    expect(formats).toHaveLength(1);
    expect(formats[0]!.spawnZones).toHaveLength(2);
    expect(formats[0]!.spawnZones[0]!.positions).toHaveLength(6);
    expect(formats[0]!.spawnZones[0]!.positions).toEqual(
      expect.arrayContaining([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ]),
    );
    expect(formats[0]!.spawnZones[1]!.positions).toHaveLength(6);
  });

  it("deduplicates cells across overlapping rectangles in the same team", () => {
    const layers: TiledLayer[] = [
      makeLayer("spawns_1v1", [
        rectSpawnObject(0, 0, 64, 64, 0, 1),
        rectSpawnObject(32, 0, 64, 64, 0, 2),
        rectSpawnObject(0, 192, 32, 32, 1, 3),
      ]),
    ];

    const formats = parseSpawnsLayers(layers, 32, 32, 10, 10, "orthogonal");
    expect(formats).toHaveLength(1);
    const zone0 = formats[0]!.spawnZones[0]!;
    expect(zone0.positions).toHaveLength(6);
    expect(zone0.positions).toEqual(
      expect.arrayContaining([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ]),
    );
  });

  it("enumerates cells inside a polygon object (rasterization)", () => {
    const triangle = [
      { x: 0, y: 0 },
      { x: 128, y: 0 },
      { x: 0, y: 128 },
    ];
    const layers: TiledLayer[] = [
      makeLayer("spawns_1v1", [
        polygonSpawnObject(0, 0, triangle, 0, 1),
        polygonSpawnObject(0, 192, triangle, 1, 2),
      ]),
    ];

    const formats = parseSpawnsLayers(layers, 32, 32, 10, 10, "orthogonal");
    expect(formats).toHaveLength(1);
    const zone0 = formats[0]!.spawnZones[0]!;
    expect(zone0.positions).toEqual(
      expect.arrayContaining([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 0, y: 2 },
      ]),
    );
    expect(zone0.positions).not.toContainEqual({ x: 3, y: 3 });
    expect(zone0.positions).not.toContainEqual({ x: 2, y: 2 });
  });
});

describe("parseLegacySpawnsLayer", () => {
  it("parses mixed formats from a single legacy layer", () => {
    const layer: TiledLayer = {
      name: "spawns",
      type: "objectgroup",
      visible: true,
      objects: [
        legacySpawnObject(0, 0, 0, 2),
        legacySpawnObject(64, 64, 1, 2),
        legacySpawnObject(0, 0, 0, 4),
        legacySpawnObject(32, 0, 1, 4),
        legacySpawnObject(64, 0, 2, 4),
        legacySpawnObject(96, 0, 3, 4),
      ],
    };

    const formats = parseLegacySpawnsLayer(layer, 32, 32, 10, 10, "orthogonal");
    expect(formats).toHaveLength(2);
    expect(formats[0]!.teamCount).toBe(2);
    expect(formats[1]!.teamCount).toBe(4);
  });

  it("throws on missing formatTeamCount", () => {
    const layer: TiledLayer = {
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
          properties: [{ name: "teamIndex", type: "int", value: 0 }],
        },
      ],
    };
    expect(() => parseLegacySpawnsLayer(layer, 32, 32, 10, 10, "orthogonal")).toThrow(
      "formatTeamCount",
    );
  });
});
