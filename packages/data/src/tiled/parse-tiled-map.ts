import type { MapDefinition } from "@pokemon-tactic/core";
import { parseSpawnsLayer } from "./parse-spawns-layer";
import { parseTerrainLayer } from "./parse-terrain-layer";
import type { TiledMap } from "./tiled-types";
import { findProperty } from "./tiled-utils";

export interface ParseSuccess {
  readonly ok: true;
  readonly map: MapDefinition;
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

  const terrainLayer = tiledJson.layers.find((l) => l.name === "terrain" && l.type === "tilelayer");
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

    return { ok: true, map, warnings };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, errors: [message] };
  }
}
