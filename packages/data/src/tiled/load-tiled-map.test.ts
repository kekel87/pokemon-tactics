import { resolve } from "node:path";
import { TerrainType } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { loadTiledMapSync } from "../testing";
import { SPAWN_LAYER_NAMES } from "./parse-spawns-layer";
import { parseTiledMap } from "./parse-tiled-map";

const mapsDir = resolve(__dirname, "../../../renderer/public/assets/maps");
const simpleArenaPath = resolve(mapsDir, "simple-arena.tmj");
const highlandsPath = resolve(mapsDir, "highlands.tmj");

describe("simple-arena.tmj", () => {
  it("parses into a valid MapDefinition", () => {
    const result = parseTiledMap(loadTiledMapSync(simpleArenaPath));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.map.id).toBe("simple-arena");
    expect(result.map.name).toBe("Simple Arena");
    expect(result.map.width).toBe(12);
    expect(result.map.height).toBe(20);
  });

  it("has correct tile dimensions", () => {
    const result = parseTiledMap(loadTiledMapSync(simpleArenaPath));
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

  it("declares the 5 expected spawn layers (empty, pending manual population)", () => {
    const raw = loadTiledMapSync(simpleArenaPath);
    const layerNames = raw.layers.map((l) => l.name);
    for (const expectedLayer of SPAWN_LAYER_NAMES) {
      expect(layerNames).toContain(expectedLayer);
    }
  });
});

describe("highlands.tmj", () => {
  it("parses into a valid MapDefinition", () => {
    const result = parseTiledMap(loadTiledMapSync(highlandsPath));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.map.id).toBe("highlands");
    expect(result.map.width).toBe(12);
    expect(result.map.height).toBe(12);
  });

  it("declares the 5 expected spawn layers (empty, pending manual population)", () => {
    const raw = loadTiledMapSync(highlandsPath);
    const layerNames = raw.layers.map((l) => l.name);
    for (const expectedLayer of SPAWN_LAYER_NAMES) {
      expect(layerNames).toContain(expectedLayer);
    }
  });
});

describe("LoS sandbox map (plan 047)", () => {
  it("sandbox-los has two aligned pillars h3 at (3,3) and (5,3)", () => {
    const result = parseTiledMap(loadTiledMapSync(resolve(mapsDir, "dev/sandbox-los.tmj")));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.map.tiles[3]?.[3]?.height).toBe(3);
    expect(result.map.tiles[3]?.[5]?.height).toBe(3);
    expect(result.map.tiles[3]?.[1]?.height).toBe(1);
  });
});
