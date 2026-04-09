import type { MapDefinition } from "@pokemon-tactic/core";
import { parseSpawnsLayer } from "./parse-spawns-layer";
import { parseTerrainLayer } from "./parse-terrain-layer";
import type { TiledMap } from "./tiled-types";
import { findProperty } from "./tiled-utils";
import { resolveTileProperties } from "./tileset-resolver";

const ELEVATION_PER_LAYER = 0.5;

function parseElevation(layerName: string): number {
  if (layerName === "terrain") {
    return 0;
  }
  const match = layerName.match(/^terrain_(\d+)$/);
  return match ? Number(match[1]) * ELEVATION_PER_LAYER : 0;
}

export interface ElevationLayer {
  readonly elevation: number;
  readonly tileData: readonly number[];
}

export interface ParseSuccess {
  readonly ok: true;
  readonly map: MapDefinition;
  readonly elevationLayers: readonly ElevationLayer[];
  /**
   * Per-cell slope direction ("north" | "south" | "east" | "west") or `null`
   * for flat cells. Indexed as `y * width + x`. A cell is considered a slope
   * if any of its stacked tiles (across elevation layers) carries a slope
   * property.
   */
  readonly slopeData: readonly (string | null)[];
  readonly warnings: string[];
}

export interface ParseFailure {
  readonly ok: false;
  readonly errors: string[];
}

export type ParseResult = ParseSuccess | ParseFailure;

export function parseTiledMap(tiledJson: TiledMap): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const terrainLayers = tiledJson.layers.filter(
    (l) => l.type === "tilelayer" && l.name.startsWith("terrain"),
  );
  const terrainLayer = terrainLayers.find((l) => l.name === "terrain");
  if (!terrainLayer) {
    errors.push('Missing required layer "terrain" (tilelayer)');
  }

  const spawnsLayer = tiledJson.layers.find((l) => l.name === "spawns" && l.type === "objectgroup");
  if (!spawnsLayer) {
    errors.push('Missing required layer "spawns" (objectgroup)');
  }

  const decorationsLayer = tiledJson.layers.find(
    (l) => l.name === "decorations" && l.type === "tilelayer",
  );
  if (!decorationsLayer) {
    warnings.push('Optional layer "decorations" not found');
  }

  const tileset = tiledJson.tilesets[0];
  if (!tileset) {
    errors.push("No tileset found (expected embedded tileset)");
  }

  if (errors.length > 0 || !terrainLayer || !spawnsLayer || !tileset) {
    return { ok: false, errors };
  }

  try {
    const tiles = parseTerrainLayer(terrainLayer, tileset, tiledJson.width, tiledJson.height);

    const elevationLayers: ElevationLayer[] = [];
    const sortedLayers = [...terrainLayers].sort((a, b) => {
      const elevA = parseElevation(a.name);
      const elevB = parseElevation(b.name);
      return elevA - elevB;
    });

    const slopeData: (string | null)[] = new Array(tiledJson.width * tiledJson.height).fill(null);

    for (const layer of sortedLayers) {
      const elevation = parseElevation(layer.name);
      if (!layer.data) {
        continue;
      }
      elevationLayers.push({ elevation, tileData: layer.data });

      for (let y = 0; y < tiledJson.height; y++) {
        for (let x = 0; x < tiledJson.width; x++) {
          const index = y * tiledJson.width + x;
          const gid = layer.data[index] ?? 0;
          if (gid === 0) {
            continue;
          }
          const { terrain, height: tileHeight, slope } = resolveTileProperties(gid, tileset);
          if (slope !== null) {
            slopeData[index] = slope;
          }
          const row = tiles[y];
          if (row) {
            const tile = row[x];
            if (tile) {
              tile.height = elevation + tileHeight;
              tile.terrain = terrain;
            }
          }
        }
      }
    }

    const formats = parseSpawnsLayer(
      spawnsLayer,
      tiledJson.tilewidth,
      tiledJson.tileheight,
      tiledJson.width,
      tiledJson.height,
      tiledJson.orientation,
    );

    const idProp = findProperty(tiledJson.properties, "id");
    const nameProp = findProperty(tiledJson.properties, "name");

    const mapId = idProp ? String(idProp.value) : "unnamed-map";
    const mapName = nameProp ? String(nameProp.value) : "Unnamed Map";

    if (!idProp) {
      warnings.push('Map property "id" not set, using "unnamed-map"');
    }
    if (!nameProp) {
      warnings.push('Map property "name" not set, using "Unnamed Map"');
    }

    const map: MapDefinition = {
      id: mapId,
      name: mapName,
      width: tiledJson.width,
      height: tiledJson.height,
      tiles,
      formats,
    };

    return { ok: true, map, elevationLayers, slopeData, warnings };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, errors: [message] };
  }
}
