import { describe, expect, it } from "vitest";
import { MockMap } from "../testing/mock-map";
import { validateMapDefinition } from "./validate-map";

describe("validateMapDefinition", () => {
  it("returns valid for a correct map", () => {
    const result = validateMapDefinition(MockMap.map8x8);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects zero dimensions", () => {
    const map = structuredClone(MockMap.map8x8);
    map.width = 0;
    const result = validateMapDefinition(map);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("dimensions");
  });

  it("rejects mismatched tile row count", () => {
    const map = structuredClone(MockMap.map8x8);
    map.tiles = MockMap.buildFlatTiles(8, 6);
    const result = validateMapDefinition(map);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("row count");
  });

  it("rejects mismatched tile column count", () => {
    const map = structuredClone(MockMap.map8x8);
    const row = map.tiles[0];
    if (row) {
      row.pop();
    }
    const result = validateMapDefinition(map);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("columns");
  });

  it("rejects map with no formats", () => {
    const map = structuredClone(MockMap.map8x8);
    map.formats = [];
    const result = validateMapDefinition(map);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("no formats");
  });

  it("rejects wrong number of spawn zones", () => {
    const map = structuredClone(MockMap.map8x8);
    const format = map.formats[0];
    if (format) {
      format.spawnZones = [format.spawnZones[0]].filter(Boolean);
    }
    const result = validateMapDefinition(map);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("spawn zones");
  });

  it("rejects format exceeding 12 Pokemon max", () => {
    const map = structuredClone(MockMap.map8x8);
    const format = map.formats[0];
    if (format) {
      format.teamCount = 4;
      format.maxPokemonPerTeam = 4;
    }
    const result = validateMapDefinition(map);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining("exceeds 12")]));
  });

  it("rejects zone with too few positions", () => {
    const map = structuredClone(MockMap.map8x8);
    const format = map.formats[0];
    if (format) {
      format.spawnZones[0] = { positions: [{ x: 0, y: 7 }] };
    }
    const result = validateMapDefinition(map);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("needs at least");
  });

  it("rejects out-of-bounds spawn position", () => {
    const map = structuredClone(MockMap.map8x8);
    const zone = map.formats[0]?.spawnZones[0];
    if (zone) {
      zone.positions[0] = { x: 99, y: 0 };
    }
    const result = validateMapDefinition(map);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("out-of-bounds");
  });

  it("rejects impassable spawn position", () => {
    const map = structuredClone(MockMap.map8x8);
    const tile = map.tiles[7]?.[0];
    if (tile) {
      tile.isPassable = false;
    }
    const result = validateMapDefinition(map);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("impassable");
  });

  it("rejects overlapping spawn positions between zones", () => {
    const map = structuredClone(MockMap.map8x8);
    const format = map.formats[0];
    if (format) {
      format.spawnZones[1] = {
        positions: [
          { x: 0, y: 6 },
          { x: 1, y: 6 },
          { x: 2, y: 6 },
          { x: 3, y: 6 },
        ],
      };
    }
    const result = validateMapDefinition(map);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("overlapping");
  });
});
