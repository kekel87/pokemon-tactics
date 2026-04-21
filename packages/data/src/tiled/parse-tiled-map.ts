import type { MapDefinition, MapFormat } from "@pokemon-tactic/core";
import {
  applyDecorationsToMap,
  type DecorationObject,
  parseDecorationsLayer,
} from "./parse-decorations-layer";
import {
  isSpawnLayerName,
  parseLegacySpawnsLayer,
  parseSpawnsLayers,
  SPAWN_LAYER_NAMES,
} from "./parse-spawns-layer";
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
  readonly decorationObjects: readonly DecorationObject[];
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

  const newSpawnLayers = tiledJson.layers.filter(
    (l) => isSpawnLayerName(l.name) && l.type === "objectgroup",
  );
  const legacySpawnsLayer = tiledJson.layers.find(
    (l) => l.name === "spawns" && l.type === "objectgroup",
  );
  if (newSpawnLayers.length === 0 && !legacySpawnsLayer) {
    errors.push(
      `Missing spawn layers (expected one of: ${SPAWN_LAYER_NAMES.join(", ")}, or legacy "spawns")`,
    );
  }

  const decorationsLayer = tiledJson.layers.find((l) => l.name === "decorations");
  if (!decorationsLayer) {
    warnings.push('Optional layer "decorations" not found');
  } else if (decorationsLayer.type !== "objectgroup") {
    const hasContent = (decorationsLayer.data ?? []).some((gid) => gid !== 0);
    if (hasContent) {
      errors.push(
        `Layer "decorations" must be an objectgroup (got "${decorationsLayer.type}") when it contains tiles`,
      );
    } else {
      warnings.push('Layer "decorations" is a legacy empty tilelayer — convert to objectgroup');
    }
  }

  const tileset = tiledJson.tilesets[0];
  if (!tileset) {
    errors.push("No tileset found (expected embedded tileset)");
  }

  if (errors.length > 0 || !terrainLayer || !tileset) {
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

    let formats: MapFormat[];
    if (newSpawnLayers.length > 0) {
      formats = parseSpawnsLayers(
        tiledJson.layers,
        tiledJson.tilewidth,
        tiledJson.tileheight,
        tiledJson.width,
        tiledJson.height,
        tiledJson.orientation,
      );
    } else if (legacySpawnsLayer) {
      warnings.push(
        `Using legacy "spawns" layer. Migrate to per-format layers (${SPAWN_LAYER_NAMES.join(", ")})`,
      );
      formats = parseLegacySpawnsLayer(
        legacySpawnsLayer,
        tiledJson.tilewidth,
        tiledJson.tileheight,
        tiledJson.width,
        tiledJson.height,
        tiledJson.orientation,
      );
    } else {
      formats = [];
    }

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

    let decorationObjects: readonly DecorationObject[] = [];
    if (decorationsLayer && decorationsLayer.type === "objectgroup") {
      const parsed = parseDecorationsLayer(
        decorationsLayer,
        tiledJson.tilesets,
        tiledJson.width,
        tiledJson.height,
        tiledJson.tilewidth,
        tiledJson.tileheight,
        tiledJson.orientation,
      );
      if (parsed.errors.length > 0) {
        return { ok: false, errors: [...parsed.errors] };
      }
      const applyErrors = applyDecorationsToMap(map, parsed.objects);
      if (applyErrors.length > 0) {
        return { ok: false, errors: [...applyErrors] };
      }
      decorationObjects = parsed.objects;
    }

    return { ok: true, map, elevationLayers, slopeData, decorationObjects, warnings };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, errors: [message] };
  }
}
