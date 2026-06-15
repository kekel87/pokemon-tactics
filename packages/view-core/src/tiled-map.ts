import type { MapDefinition } from "@pokemon-tactic/core";
import type { DecorationObject, ElevationLayer, TiledTileset } from "@pokemon-tactic/data";
import {
  decodeTiledGid,
  parseTiledMap,
  type TiledMap,
  validateTiledMap,
} from "@pokemon-tactic/data";

/**
 * Engine-agnostic Tiled `.tmj` loader (plan 125 — hoisted from render-babylon so
 * every renderer extrudes the same map). Pure parsing (core + data + `fetch`); no
 * DOM/engine import. Returns a `LoadedTiledMap` each renderer turns into meshes.
 */

/**
 * Visual terrain group of a tile, derived from its tileset row (NOT the gameplay
 * `terrain` property — herbe/roche/brique/pavé/path/wood all share gameplay
 * `normal` but are visually distinct). Drives which flat texture is applied.
 */
export type VisualTerrainGroup =
  | "herbe"
  | "tall_grass"
  | "roche"
  | "brique"
  | "sable"
  | "pave"
  | "path"
  | "wood"
  | "snow"
  | "ice"
  | "magma"
  | "water"
  | "deep_water"
  | "lava"
  | "swamp";

/** Raw VISUAL tile (from the terrain tilelayer GID), before any gameplay stamping. */
export interface VisualTile {
  readonly group: VisualTerrainGroup;
  readonly height: number;
}

/**
 * Tileset row → visual group. Solid terrains occupy 6-tile blocks (5 used + 1
 * separator) from local id 0; liquids sit at fixed ids. Source of truth:
 * `docs/tileset-mapping.md`.
 */
const SOLID_GROUPS: readonly VisualTerrainGroup[] = [
  "herbe",
  "tall_grass",
  "roche",
  "brique",
  "sable",
  "pave",
  "path",
  "wood",
  "snow",
  "ice",
  "magma",
];
const SOLID_BLOCK_SIZE = 6;
const SOLID_USED_PER_BLOCK = 5;

/** Liquids sit at fixed local ids (full + half-a). Source: `docs/tileset-mapping.md`. */
const LIQUID_GROUP_BY_LOCAL_ID: Readonly<Record<number, VisualTerrainGroup>> = {
  66: "water",
  67: "water",
  69: "deep_water",
  70: "deep_water",
  72: "lava",
  73: "lava",
  75: "swamp",
  76: "swamp",
};

/** Tileset tile custom properties as stored in the `.tsj`. */
type TiledTileProperties =
  | readonly { name: string; value: string | number | boolean }[]
  | undefined;

function visualGroupForLocalId(localId: number): VisualTerrainGroup {
  if (localId >= 0) {
    const block = Math.floor(localId / SOLID_BLOCK_SIZE);
    const within = localId % SOLID_BLOCK_SIZE;
    if (block < SOLID_GROUPS.length && within < SOLID_USED_PER_BLOCK) {
      return SOLID_GROUPS[block] ?? "herbe";
    }
  }
  return LIQUID_GROUP_BY_LOCAL_ID[localId] ?? "herbe";
}

/**
 * Result of loading a Tiled `.tmj` map for an engine renderer.
 *
 * `map` is the gameplay `MapDefinition` the core consumes — note `parseTiledMap`
 * stamps `obstacle` terrain + extra height onto tiles UNDER rock decorations (for
 * collision). `visualTiles` is the RAW per-cell terrain/height read straight from
 * the terrain tilelayer GIDs (before that stamping) — this is what the renderer
 * must extrude, so a magma tile with a rock decoration renders as flat magma, not
 * a grey obstacle cube. Rocks themselves are drawn as decorations (Jalon 3).
 */
export interface LoadedTiledMap {
  readonly map: MapDefinition;
  readonly elevationLayers: readonly ElevationLayer[];
  readonly visualTiles: readonly (readonly VisualTile[])[];
  /** Rock/tree/tall-grass decoration objects parsed from the Tiled `decorations` object-layer. */
  readonly decorationObjects: readonly DecorationObject[];
  /** Per-cell slope marker (row-major, `width × height`); non-null = a ramp tile (drives Walk-not-Hop). */
  readonly slopeData: readonly (string | null)[];
}

async function resolveExternalTilesets(tiledMap: TiledMap, mapUrl: string): Promise<TiledMap> {
  const baseUrl = mapUrl.substring(0, mapUrl.lastIndexOf("/") + 1);
  const resolvedTilesets = await Promise.all(
    tiledMap.tilesets.map(async (tileset) => {
      if (!tileset.source) {
        return tileset;
      }
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

function tilePropertyValue(
  properties: TiledTileProperties,
  name: string,
): string | number | boolean | undefined {
  return properties?.find((property) => property.name === name)?.value;
}

/**
 * Resolves each cell to the VISIBLE top of its stacked terrain column: the
 * highest elevation layer (`terrain`, `terrain_2`, …) that carries a tile wins,
 * giving the surface group + total height (`layer elevation + tile height`).
 * This is the raw terrain ground — untouched by the decoration obstacle-stamping
 * that `parseTiledMap` bakes into `map.tiles` (rocks render as decorations, not
 * grey cubes). Mirrors the 2D renderer's elevation stacking.
 */
function buildVisualTiles(
  tiledMap: TiledMap,
  map: MapDefinition,
  elevationLayers: readonly ElevationLayer[],
): VisualTile[][] {
  const { width, height } = map;
  // The terrain tileset is named "terrain" (fallback: lowest firstgid).
  const sortedByFirstgid = [...tiledMap.tilesets].sort((a, b) => a.firstgid - b.firstgid);
  const terrainTileset =
    sortedByFirstgid.find((tileset) => tileset.name === "terrain") ?? sortedByFirstgid[0];
  const firstgid = terrainTileset?.firstgid ?? 1;
  const propertiesByLocalId = new Map<number, TiledTileProperties>();
  for (const tile of terrainTileset?.tiles ?? []) {
    propertiesByLocalId.set(tile.id, tile.properties);
  }

  // Layers ascending by elevation so the last hit at a cell is its visible top.
  const layersLowToHigh = [...elevationLayers].sort((a, b) => a.elevation - b.elevation);

  const visualTiles: VisualTile[][] = [];
  for (let y = 0; y < height; y++) {
    const row: VisualTile[] = [];
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      let group: VisualTerrainGroup = "herbe";
      // Empty cell (no terrain tile at any elevation) falls back to the parsed height.
      let tileHeight = map.tiles[y]?.[x]?.height ?? 0;
      for (const layer of layersLowToHigh) {
        const gid = layer.tileData[index] ?? 0;
        if (gid === 0) {
          continue;
        }
        // Decode masks Tiled's flip/rotation bits — raw subtraction would break on flipped tiles.
        const localId = decodeTiledGid(gid).tileId - firstgid;
        const rawHeight = tilePropertyValue(propertiesByLocalId.get(localId), "height");
        group = visualGroupForLocalId(localId);
        tileHeight = layer.elevation + (typeof rawHeight === "number" ? rawHeight : 0);
      }
      row.push({ group, height: tileHeight });
    }
    visualTiles.push(row);
  }
  return visualTiles;
}

export async function loadTiledMap(url: string): Promise<LoadedTiledMap> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  let tiledMap = (await response.json()) as TiledMap;
  tiledMap = await resolveExternalTilesets(tiledMap, url);

  const parseResult = parseTiledMap(tiledMap);
  if (!parseResult.ok) {
    throw new Error(`Parse failure: ${parseResult.errors.join(", ")}`);
  }

  // Dev maps (sandbox-flat…) declare a single format on purpose — skip the
  // "all standard formats" check for them, like the Phaser loader (maps/load-tiled-map.ts).
  const isDevMap = url.includes("/maps/dev/");
  const validation = validateTiledMap(parseResult.map, { requireAllFormats: !isDevMap });
  if (!validation.valid) {
    throw new Error(`Validation failure: ${validation.errors.join(", ")}`);
  }

  return {
    map: parseResult.map,
    elevationLayers: parseResult.elevationLayers,
    visualTiles: buildVisualTiles(tiledMap, parseResult.map, parseResult.elevationLayers),
    decorationObjects: parseResult.decorationObjects,
    slopeData: parseResult.slopeData,
  };
}
