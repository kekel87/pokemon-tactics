import { resolve } from "node:path";
import { TerrainType } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { loadTiledMapSync } from "../testing";
import { parseTiledMap } from "./parse-tiled-map";
import { validateTiledMap } from "./validate-tiled-map";

const mapsDir = resolve(__dirname, "../../../renderer/public/assets/maps");
const testArenaPath = resolve(mapsDir, "test-arena.tmj");

describe("test-arena.tmj", () => {
  it("parses into a valid MapDefinition", () => {
    const result = parseTiledMap(loadTiledMapSync(testArenaPath));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.map.id).toBe("test-arena");
    expect(result.map.name).toBe("Test Arena");
    expect(result.map.width).toBe(12);
    expect(result.map.height).toBe(20);
  });

  it("has correct tile dimensions", () => {
    const result = parseTiledMap(loadTiledMapSync(testArenaPath));
    if (!result.ok) {
      return;
    }

    expect(result.map.tiles).toHaveLength(20);
    expect(result.map.tiles[0]).toHaveLength(12);

    for (const row of result.map.tiles) {
      for (const tile of row!) {
        expect(tile.terrain).toBe(TerrainType.Normal);
        expect(tile.height).toBe(1);
        expect(tile.occupantId).toBeNull();
      }
    }
  });

  it("has 2-team format with 16 spawns per team", () => {
    const result = parseTiledMap(loadTiledMapSync(testArenaPath));
    if (!result.ok) {
      return;
    }

    expect(result.map.formats).toHaveLength(1);
    const format = result.map.formats[0]!;
    expect(format.teamCount).toBe(2);
    expect(format.spawnZones).toHaveLength(2);
    expect(format.spawnZones[0]!.positions).toHaveLength(16);
    expect(format.spawnZones[1]!.positions).toHaveLength(16);
  });

  it("spawn positions have correct col range (2-9)", () => {
    const result = parseTiledMap(loadTiledMapSync(testArenaPath));
    if (!result.ok) {
      return;
    }

    for (const zone of result.map.formats[0]!.spawnZones) {
      const xValues = new Set(zone.positions.map((p) => p.x));
      expect(xValues).toEqual(new Set([2, 3, 4, 5, 6, 7, 8, 9]));
    }
  });

  it("spawn positions have 16 per team", () => {
    const result = parseTiledMap(loadTiledMapSync(testArenaPath));
    if (!result.ok) {
      return;
    }

    for (const zone of result.map.formats[0]!.spawnZones) {
      expect(zone.positions).toHaveLength(16);
      for (const pos of zone.positions) {
        expect(pos.x).toBeGreaterThanOrEqual(0);
        expect(pos.x).toBeLessThan(result.map.width);
        expect(pos.y).toBeGreaterThanOrEqual(0);
        expect(pos.y).toBeLessThan(result.map.height);
      }
    }
  });

  it("passes validation", () => {
    const result = parseTiledMap(loadTiledMapSync(testArenaPath));
    if (!result.ok) {
      return;
    }

    const validation = validateTiledMap(result.map);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });
});

describe("LoS sandbox map (plan 047)", () => {
  it("sandbox-los has two aligned pillars h3 at (3,3) and (5,3)", () => {
    const result = parseTiledMap(loadTiledMapSync(resolve(mapsDir, "sandbox-los.tmj")));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.map.tiles[3]?.[3]?.height).toBe(3);
    expect(result.map.tiles[3]?.[5]?.height).toBe(3);
    expect(result.map.tiles[3]?.[1]?.height).toBe(1);
  });
});
