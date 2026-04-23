import { resolve } from "node:path";
import { TerrainType } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { loadTiledMapSync } from "../testing";
import { SPAWN_LAYER_NAMES } from "./parse-spawns-layer";
import { parseTiledMap } from "./parse-tiled-map";
import { validateTiledMap } from "./validate-tiled-map";

const mapsDir = resolve(__dirname, "../../../renderer/public/assets/maps");
const simpleArenaPath = resolve(mapsDir, "simple-arena.tmj");
const forestPath = resolve(mapsDir, "forest.tmj");
const crampedCavePath = resolve(mapsDir, "cramped-cave.tmj");
const leMurPath = resolve(mapsDir, "le-mur.tmj");
const volcanoPath = resolve(mapsDir, "volcano.tmj");
const swampPath = resolve(mapsDir, "swamp.tmj");
const desertPath = resolve(mapsDir, "desert.tmj");
const navalArenaPath = resolve(mapsDir, "naval-arena.tmj");

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

describe("forest.tmj", () => {
  it("parses into a valid MapDefinition", () => {
    const result = parseTiledMap(loadTiledMapSync(forestPath));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.map.id).toBe("forest");
    expect(result.map.width).toBe(14);
    expect(result.map.height).toBe(14);
  });

  it("declares the 5 expected spawn layers", () => {
    const raw = loadTiledMapSync(forestPath);
    const layerNames = raw.layers.map((l) => l.name);
    for (const expectedLayer of SPAWN_LAYER_NAMES) {
      expect(layerNames).toContain(expectedLayer);
    }
  });

  it("passes validateTiledMap with requireAllFormats", () => {
    const parsed = parseTiledMap(loadTiledMapSync(forestPath));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const validation = validateTiledMap(parsed.map, { requireAllFormats: true });
    expect(validation.errors).toEqual([]);
  });
});

describe("cramped-cave.tmj", () => {
  it("parses into a valid MapDefinition", () => {
    const result = parseTiledMap(loadTiledMapSync(crampedCavePath));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.map.id).toBe("cramped-cave");
    expect(result.map.width).toBe(12);
    expect(result.map.height).toBe(12);
  });

  it("declares the 5 expected spawn layers", () => {
    const raw = loadTiledMapSync(crampedCavePath);
    const layerNames = raw.layers.map((l) => l.name);
    for (const expectedLayer of SPAWN_LAYER_NAMES) {
      expect(layerNames).toContain(expectedLayer);
    }
  });

  it("passes validateTiledMap with requireAllFormats", () => {
    const parsed = parseTiledMap(loadTiledMapSync(crampedCavePath));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const validation = validateTiledMap(parsed.map, { requireAllFormats: true });
    expect(validation.errors).toEqual([]);
  });
});

describe("desert.tmj", () => {
  it("parses into a valid MapDefinition", () => {
    const result = parseTiledMap(loadTiledMapSync(desertPath));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.map.id).toBe("desert");
    expect(result.map.width).toBe(14);
    expect(result.map.height).toBe(14);
  });

  it("declares the 5 expected spawn layers", () => {
    const raw = loadTiledMapSync(desertPath);
    const layerNames = raw.layers.map((l) => l.name);
    for (const expectedLayer of SPAWN_LAYER_NAMES) {
      expect(layerNames).toContain(expectedLayer);
    }
  });

  it("passes validateTiledMap with requireAllFormats", () => {
    const parsed = parseTiledMap(loadTiledMapSync(desertPath));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const validation = validateTiledMap(parsed.map, { requireAllFormats: true });
    expect(validation.errors).toEqual([]);
  });
});

describe("swamp.tmj", () => {
  it("parses into a valid MapDefinition", () => {
    const result = parseTiledMap(loadTiledMapSync(swampPath));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.map.id).toBe("swamp");
    expect(result.map.width).toBe(14);
    expect(result.map.height).toBe(14);
  });

  it("declares the 5 expected spawn layers", () => {
    const raw = loadTiledMapSync(swampPath);
    const layerNames = raw.layers.map((l) => l.name);
    for (const expectedLayer of SPAWN_LAYER_NAMES) {
      expect(layerNames).toContain(expectedLayer);
    }
  });

  it("passes validateTiledMap with requireAllFormats", () => {
    const parsed = parseTiledMap(loadTiledMapSync(swampPath));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const validation = validateTiledMap(parsed.map, { requireAllFormats: true });
    expect(validation.errors).toEqual([]);
  });
});

describe("volcano.tmj", () => {
  it("parses into a valid MapDefinition", () => {
    const result = parseTiledMap(loadTiledMapSync(volcanoPath));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.map.id).toBe("volcano");
    expect(result.map.width).toBe(14);
    expect(result.map.height).toBe(14);
  });

  it("declares the 5 expected spawn layers", () => {
    const raw = loadTiledMapSync(volcanoPath);
    const layerNames = raw.layers.map((l) => l.name);
    for (const expectedLayer of SPAWN_LAYER_NAMES) {
      expect(layerNames).toContain(expectedLayer);
    }
  });

  it("passes validateTiledMap with requireAllFormats", () => {
    const parsed = parseTiledMap(loadTiledMapSync(volcanoPath));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const validation = validateTiledMap(parsed.map, { requireAllFormats: true });
    expect(validation.errors).toEqual([]);
  });
});

describe("le-mur.tmj", () => {
  it("parses into a valid MapDefinition", () => {
    const result = parseTiledMap(loadTiledMapSync(leMurPath));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.map.id).toBe("le-mur");
    expect(result.map.width).toBe(16);
    expect(result.map.height).toBe(16);
  });

  it("declares the 5 expected spawn layers", () => {
    const raw = loadTiledMapSync(leMurPath);
    const layerNames = raw.layers.map((l) => l.name);
    for (const expectedLayer of SPAWN_LAYER_NAMES) {
      expect(layerNames).toContain(expectedLayer);
    }
  });

  it("passes validateTiledMap with requireAllFormats", () => {
    const parsed = parseTiledMap(loadTiledMapSync(leMurPath));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const validation = validateTiledMap(parsed.map, { requireAllFormats: true });
    expect(validation.errors).toEqual([]);
  });
});

describe("naval-arena.tmj", () => {
  it("parses into a valid MapDefinition", () => {
    const result = parseTiledMap(loadTiledMapSync(navalArenaPath));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.map.id).toBe("naval-arena");
    expect(result.map.width).toBe(14);
    expect(result.map.height).toBe(14);
  });

  it("declares the 5 expected spawn layers", () => {
    const raw = loadTiledMapSync(navalArenaPath);
    const layerNames = raw.layers.map((l) => l.name);
    for (const expectedLayer of SPAWN_LAYER_NAMES) {
      expect(layerNames).toContain(expectedLayer);
    }
  });

  it("passes validateTiledMap with requireAllFormats", () => {
    const parsed = parseTiledMap(loadTiledMapSync(navalArenaPath));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const validation = validateTiledMap(parsed.map, { requireAllFormats: true });
    expect(validation.errors).toEqual([]);
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
