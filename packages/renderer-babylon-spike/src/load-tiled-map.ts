import type { MapDefinition } from "@pokemon-tactic/core";
import type { ElevationLayer, TiledTileset } from "@pokemon-tactic/data";
import { parseTiledMap, type TiledMap, validateTiledMap } from "@pokemon-tactic/data";

export interface LoadedTiledMap {
  readonly map: MapDefinition;
  readonly elevationLayers: readonly ElevationLayer[];
  readonly heightData: readonly number[];
  readonly terrainData: readonly string[];
}

async function resolveExternalTilesets(tiledMap: TiledMap, mapUrl: string): Promise<TiledMap> {
  const baseUrl = mapUrl.substring(0, mapUrl.lastIndexOf("/") + 1);
  const resolvedTilesets = await Promise.all(
    tiledMap.tilesets.map(async (tileset) => {
      if (!tileset.source) return tileset;
      const response = await fetch(baseUrl + tileset.source);
      if (!response.ok) {
        throw new Error(`Failed to fetch tileset "${tileset.source}": ${response.status}`);
      }
      const externalTileset = (await response.json()) as TiledTileset;
      return { ...externalTileset, firstgid: tileset.firstgid };
    }),
  );
  return { ...tiledMap, tilesets: resolvedTilesets };
}

export async function loadTiledMap(url: string): Promise<LoadedTiledMap> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);

  let tiledMap = (await response.json()) as TiledMap;
  tiledMap = await resolveExternalTilesets(tiledMap, url);

  const parseResult = parseTiledMap(tiledMap);
  if (!parseResult.ok) {
    throw new Error(`Parse failure: ${parseResult.errors.join(", ")}`);
  }

  const validation = validateTiledMap(parseResult.map);
  if (!validation.valid) {
    throw new Error(`Validation failure: ${validation.errors.join(", ")}`);
  }

  const heightData: number[] = [];
  const terrainData: string[] = [];
  for (const row of parseResult.map.tiles) {
    for (const tile of row) {
      heightData.push(tile.height);
      terrainData.push(tile.terrain);
    }
  }

  return {
    map: parseResult.map,
    elevationLayers: parseResult.elevationLayers,
    heightData,
    terrainData,
  };
}
