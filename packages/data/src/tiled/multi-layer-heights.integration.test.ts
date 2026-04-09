import { describe, expect, it } from "vitest";
import {
  ALL_TILE_DEFINITIONS,
  buildFixture,
  GRASS_BASE_GID,
  GRASS_HALF_GID,
  ROCK_BASE_GID,
  ROCK_HALF_GID,
} from "./__fixtures__/build-fixture";
import { parseTiledMap } from "./parse-tiled-map";

describe("multi-layer heights — integration", () => {
  // Given a 1x1 map with a grass base tile on the terrain layer
  // When parsed
  // Then the cell has height 1 (0 elevation + 1 tile.height)
  it("1x1 single grass base on terrain = height 1", () => {
    const tiled = buildFixture({
      width: 1,
      height: 1,
      terrainLayers: [{ name: "terrain", data: [GRASS_BASE_GID] }],
      tileDefinitions: ALL_TILE_DEFINITIONS,
    });

    const result = parseTiledMap(tiled);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.map.tiles[0]![0]!.height).toBe(1);
  });

  // Given a 1x1 map with a grass half-tile on terrain layer
  // Then height = 0.5
  it("1x1 single grass half on terrain = height 0.5", () => {
    const tiled = buildFixture({
      width: 1,
      height: 1,
      terrainLayers: [{ name: "terrain", data: [GRASS_HALF_GID] }],
      tileDefinitions: ALL_TILE_DEFINITIONS,
    });

    const result = parseTiledMap(tiled);
    if (!result.ok) {
      return;
    }

    expect(result.map.tiles[0]![0]!.height).toBe(0.5);
  });

  // Given a 1x1 map with grass base on terrain + grass half on terrain_1
  // Then height = 0.5 + 0.5 = 1.0 (higher layer wins)
  it("1x1 stack: grass base + grass half on terrain_1 = height 1.0", () => {
    const tiled = buildFixture({
      width: 1,
      height: 1,
      terrainLayers: [
        { name: "terrain", data: [GRASS_BASE_GID] },
        { name: "terrain_1", offsety: -8, data: [GRASS_HALF_GID] },
      ],
      tileDefinitions: ALL_TILE_DEFINITIONS,
    });

    const result = parseTiledMap(tiled);
    if (!result.ok) {
      return;
    }

    expect(result.map.tiles[0]![0]!.height).toBe(1);
  });

  // Given a 1x1 map with grass base on terrain + grass base on terrain_2
  // Then height = 1.0 + 1 = 2.0
  it("1x1 stack: 2 full blocks on terrain + terrain_2 = height 2.0", () => {
    const tiled = buildFixture({
      width: 1,
      height: 1,
      terrainLayers: [
        { name: "terrain", data: [GRASS_BASE_GID] },
        { name: "terrain_2", offsety: -16, data: [GRASS_BASE_GID] },
      ],
      tileDefinitions: ALL_TILE_DEFINITIONS,
    });

    const result = parseTiledMap(tiled);
    if (!result.ok) {
      return;
    }

    expect(result.map.tiles[0]![0]!.height).toBe(2);
  });

  // Given a 1x1 map with just terrain_2 (no base terrain tile)
  // Then height = 1.0 + 1 = 2.0 (floating block)
  it("1x1 floating block on terrain_2 only = height 2.0", () => {
    const tiled = buildFixture({
      width: 1,
      height: 1,
      terrainLayers: [
        { name: "terrain", data: [0] },
        { name: "terrain_2", offsety: -16, data: [GRASS_BASE_GID] },
      ],
      tileDefinitions: ALL_TILE_DEFINITIONS,
    });

    const result = parseTiledMap(tiled);
    if (!result.ok) {
      return;
    }

    expect(result.map.tiles[0]![0]!.height).toBe(2);
  });

  // Given a 1x1 map with 4 stacked full blocks (terrain, _2, _4, _6)
  // Then height = 3.0 + 1 = 4.0 (highest layer wins)
  it("1x1 stack of 4 full blocks = height 4.0", () => {
    const tiled = buildFixture({
      width: 1,
      height: 1,
      terrainLayers: [
        { name: "terrain", data: [GRASS_BASE_GID] },
        { name: "terrain_2", offsety: -16, data: [GRASS_BASE_GID] },
        { name: "terrain_4", offsety: -32, data: [GRASS_BASE_GID] },
        { name: "terrain_6", offsety: -48, data: [GRASS_BASE_GID] },
      ],
      tileDefinitions: ALL_TILE_DEFINITIONS,
    });

    const result = parseTiledMap(tiled);
    if (!result.ok) {
      return;
    }

    expect(result.map.tiles[0]![0]!.height).toBe(4);
  });

  // Given a 1x1 map with full block + half tile on top (terrain_2)
  // Then height = 1.0 + 0.5 = 1.5
  it("1x1 stack: full block + half tile on top = height 1.5", () => {
    const tiled = buildFixture({
      width: 1,
      height: 1,
      terrainLayers: [
        { name: "terrain", data: [GRASS_BASE_GID] },
        { name: "terrain_2", offsety: -16, data: [GRASS_HALF_GID] },
      ],
      tileDefinitions: ALL_TILE_DEFINITIONS,
    });

    const result = parseTiledMap(tiled);
    if (!result.ok) {
      return;
    }

    expect(result.map.tiles[0]![0]!.height).toBe(1.5);
  });

  // Given a 1x1 map with 2 half-tiles stacked (terrain + terrain_1)
  // Then height = 0.5 + 0.5 = 1.0
  it("1x1 stack: 2 half-tiles on terrain + terrain_1 = height 1.0", () => {
    const tiled = buildFixture({
      width: 1,
      height: 1,
      terrainLayers: [
        { name: "terrain", data: [GRASS_HALF_GID] },
        { name: "terrain_1", offsety: -8, data: [GRASS_HALF_GID] },
      ],
      tileDefinitions: ALL_TILE_DEFINITIONS,
    });

    const result = parseTiledMap(tiled);
    if (!result.ok) {
      return;
    }

    expect(result.map.tiles[0]![0]!.height).toBe(1);
  });

  // Given a 2x1 map with different heights per cell
  // Then each cell has the correct height independently
  it("2x1 map with different heights: flat + stacked", () => {
    const tiled = buildFixture({
      width: 2,
      height: 1,
      terrainLayers: [
        { name: "terrain", data: [GRASS_BASE_GID, GRASS_BASE_GID] },
        { name: "terrain_2", offsety: -16, data: [0, GRASS_BASE_GID] },
      ],
      tileDefinitions: ALL_TILE_DEFINITIONS,
    });

    const result = parseTiledMap(tiled);
    if (!result.ok) {
      return;
    }

    expect(result.map.tiles[0]![0]!.height).toBe(1);
    expect(result.map.tiles[0]![1]!.height).toBe(2);
  });

  // Given a 1x1 map with rock tiles (different terrain visual but same mechanics)
  // Then heights are computed the same way as grass
  it("1x1 rock base + rock half on top = height 1.5", () => {
    const tiled = buildFixture({
      width: 1,
      height: 1,
      terrainLayers: [
        { name: "terrain", data: [ROCK_BASE_GID] },
        { name: "terrain_2", offsety: -16, data: [ROCK_HALF_GID] },
      ],
      tileDefinitions: ALL_TILE_DEFINITIONS,
    });

    const result = parseTiledMap(tiled);
    if (!result.ok) {
      return;
    }

    expect(result.map.tiles[0]![0]!.height).toBe(1.5);
  });

  // Given a 1x1 map with a tile missing its height property (GID used but no def)
  // Then the parser does not crash and defaults to height 0 for that layer contribution
  it("1x1 missing tile def defaults to height 0", () => {
    const tiled = buildFixture({
      width: 1,
      height: 1,
      terrainLayers: [
        { name: "terrain", data: [GRASS_BASE_GID] },
        { name: "terrain_2", offsety: -16, data: [999] }, // unknown GID
      ],
      tileDefinitions: ALL_TILE_DEFINITIONS,
    });

    const result = parseTiledMap(tiled);
    if (!result.ok) {
      return;
    }

    // Higher layer wins with elevation 1.0 + unknown tile height 0 = 1.0
    expect(result.map.tiles[0]![0]!.height).toBe(1);
  });

  // Given a 3x1 map with a gradual slope (stairs of half-tiles)
  // Then each cell has incrementing heights
  it("3x1 stair pattern: gradual height increase via layers", () => {
    const tiled = buildFixture({
      width: 3,
      height: 1,
      terrainLayers: [
        {
          name: "terrain",
          data: [GRASS_HALF_GID, GRASS_BASE_GID, GRASS_BASE_GID],
        },
        { name: "terrain_2", offsety: -16, data: [0, 0, GRASS_BASE_GID] },
      ],
      tileDefinitions: ALL_TILE_DEFINITIONS,
    });

    const result = parseTiledMap(tiled);
    if (!result.ok) {
      return;
    }

    expect(result.map.tiles[0]![0]!.height).toBe(0.5);
    expect(result.map.tiles[0]![1]!.height).toBe(1);
    expect(result.map.tiles[0]![2]!.height).toBe(2);
  });

  // Given a 1x1 map with only "terrain" layer (no elevation layers)
  // Then elevationLayers array has exactly 1 element
  it("exposes elevationLayers for the renderer", () => {
    const tiled = buildFixture({
      width: 1,
      height: 1,
      terrainLayers: [
        { name: "terrain", data: [GRASS_BASE_GID] },
        { name: "terrain_2", offsety: -16, data: [GRASS_BASE_GID] },
      ],
      tileDefinitions: ALL_TILE_DEFINITIONS,
    });

    const result = parseTiledMap(tiled);
    if (!result.ok) {
      return;
    }

    expect(result.elevationLayers).toHaveLength(2);
    expect(result.elevationLayers[0]!.elevation).toBe(0);
    expect(result.elevationLayers[1]!.elevation).toBe(1);
    expect(result.elevationLayers[0]!.tileData).toEqual([GRASS_BASE_GID]);
    expect(result.elevationLayers[1]!.tileData).toEqual([GRASS_BASE_GID]);
  });

  // Given terrain_1 layer (odd index = half elevation)
  // Then elevation = 0.5
  it("parses half-elevation layers (terrain_1 = 0.5)", () => {
    const tiled = buildFixture({
      width: 1,
      height: 1,
      terrainLayers: [
        { name: "terrain", data: [0] },
        { name: "terrain_1", offsety: -8, data: [GRASS_BASE_GID] },
      ],
      tileDefinitions: ALL_TILE_DEFINITIONS,
    });

    const result = parseTiledMap(tiled);
    if (!result.ok) {
      return;
    }

    expect(result.elevationLayers[1]!.elevation).toBe(0.5);
    expect(result.map.tiles[0]![0]!.height).toBe(1.5);
  });

  // Given layers parsed out of order (terrain_2 before terrain_1)
  // Then elevationLayers are sorted ascending by elevation
  it("sorts elevation layers ascending regardless of input order", () => {
    const tiled = buildFixture({
      width: 1,
      height: 1,
      terrainLayers: [
        { name: "terrain", data: [GRASS_BASE_GID] },
        { name: "terrain_3", offsety: -24, data: [GRASS_BASE_GID] },
        { name: "terrain_1", offsety: -8, data: [GRASS_BASE_GID] },
        { name: "terrain_2", offsety: -16, data: [GRASS_BASE_GID] },
      ],
      tileDefinitions: ALL_TILE_DEFINITIONS,
    });

    const result = parseTiledMap(tiled);
    if (!result.ok) {
      return;
    }

    const elevations = result.elevationLayers.map((l) => l.elevation);
    expect(elevations).toEqual([0, 0.5, 1, 1.5]);
    // Highest layer wins: terrain_3 = 1.5 + 1 = 2.5
    expect(result.map.tiles[0]![0]!.height).toBe(2.5);
  });
});
