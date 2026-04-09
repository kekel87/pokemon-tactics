import { describe, expect, it } from "vitest";
import { parseSpawnsLayer } from "./parse-spawns-layer";
import type { TiledLayer } from "./tiled-types";

function spawnObject(pixelX: number, pixelY: number, teamIndex: number, formatTeamCount: number) {
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

describe("parseSpawnsLayer", () => {
  it("parses 4 spawns into 1 format with 2 teams", () => {
    const layer: TiledLayer = {
      name: "spawns",
      type: "objectgroup",
      visible: true,
      objects: [
        spawnObject(0, 0, 0, 2),
        spawnObject(32, 0, 0, 2),
        spawnObject(0, 64, 1, 2),
        spawnObject(32, 64, 1, 2),
      ],
    };

    const formats = parseSpawnsLayer(layer, 32, 32, 10, 10, "orthogonal");

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

  it("parses multiple formats from same layer", () => {
    const layer: TiledLayer = {
      name: "spawns",
      type: "objectgroup",
      visible: true,
      objects: [
        spawnObject(0, 0, 0, 2),
        spawnObject(64, 64, 1, 2),
        spawnObject(0, 0, 0, 4),
        spawnObject(32, 0, 1, 4),
        spawnObject(64, 0, 2, 4),
        spawnObject(96, 0, 3, 4),
      ],
    };

    const formats = parseSpawnsLayer(layer, 32, 32, 10, 10, "orthogonal");

    expect(formats).toHaveLength(2);
    expect(formats[0]!.teamCount).toBe(2);
    expect(formats[1]!.teamCount).toBe(4);
    expect(formats[1]!.spawnZones).toHaveLength(4);
  });

  it("throws on missing teamIndex", () => {
    const layer: TiledLayer = {
      name: "spawns",
      type: "objectgroup",
      visible: true,
      objects: [{ id: 1, x: 0, y: 0, width: 0, height: 0, name: "", type: "", properties: [] }],
    };
    expect(() => parseSpawnsLayer(layer, 32, 32, 10, 10, "orthogonal")).toThrow("teamIndex");
  });

  it("throws on wrong layer type", () => {
    const layer: TiledLayer = {
      name: "spawns",
      type: "tilelayer",
      visible: true,
      data: [],
    };
    expect(() => parseSpawnsLayer(layer, 32, 32, 10, 10, "orthogonal")).toThrow(
      "Expected objectgroup",
    );
  });

  it("throws on empty objects", () => {
    const layer: TiledLayer = {
      name: "spawns",
      type: "objectgroup",
      visible: true,
      objects: [],
    };
    expect(() => parseSpawnsLayer(layer, 32, 32, 10, 10, "orthogonal")).toThrow("no spawn objects");
  });
});
