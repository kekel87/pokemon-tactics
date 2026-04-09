import type { MapDefinition } from "@pokemon-tactic/core";
import type { ElevationLayer, TiledTileset } from "@pokemon-tactic/data";
import { parseTiledMap, type TiledMap, validateTiledMap } from "@pokemon-tactic/data";

export interface LoadedTiledMap {
  readonly map: MapDefinition;
  readonly elevationLayers: readonly ElevationLayer[];
  readonly heightData: readonly number[];
  readonly slopeData: readonly (string | null)[];
  readonly firstgid: number;
}

async function resolveExternalTilesets(tiledMap: TiledMap, mapUrl: string): Promise<TiledMap> {
  const baseUrl = mapUrl.substring(0, mapUrl.lastIndexOf("/") + 1);
  const resolvedTilesets = await Promise.all(
    tiledMap.tilesets.map(async (tileset) => {
      if (!tileset.source) {
        return tileset;
      }
      const tilesetUrl = baseUrl + tileset.source;
      const response = await fetch(tilesetUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch tileset "${tilesetUrl}": ${response.status}`);
      }
      const externalTileset = (await response.json()) as TiledTileset;
      return { ...externalTileset, firstgid: tileset.firstgid };
    }),
  );
  return { ...tiledMap, tilesets: resolvedTilesets };
}

export async function loadTiledMap(url: string): Promise<LoadedTiledMap> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch map at "${url}": ${response.status} ${response.statusText}`);
  }

  let tiledMap = (await response.json()) as TiledMap;
  tiledMap = await resolveExternalTilesets(tiledMap, url);

  const parseResult = parseTiledMap(tiledMap);

  if (!parseResult.ok) {
    throw new Error(`Failed to parse map "${url}":\n${parseResult.errors.join("\n")}`);
  }

  const validation = validateTiledMap(parseResult.map);
  if (!validation.valid) {
    throw new Error(`Map "${url}" validation failed:\n${validation.errors.join("\n")}`);
  }

  if (validation.warnings.length > 0) {
    console.warn(`Map "${url}" warnings:\n${validation.warnings.join("\n")}`);
  }

  if (parseResult.warnings.length > 0) {
    console.warn(`Map "${url}" parse warnings:\n${parseResult.warnings.join("\n")}`);
  }

  const firstgid = tiledMap.tilesets[0]?.firstgid ?? 1;

  const heightData: number[] = [];
  for (const row of parseResult.map.tiles) {
    for (const tile of row) {
      heightData.push(tile.height);
    }
  }

  return {
    map: parseResult.map,
    elevationLayers: parseResult.elevationLayers,
    heightData,
    slopeData: parseResult.slopeData,
    firstgid,
  };
}
