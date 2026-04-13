import { TerrainType } from "@pokemon-tactic/core";
import type { TiledTileset } from "./tiled-types";
import { decodeTiledGid, findProperty } from "./tiled-utils";

export interface ResolvedTileProperties {
  readonly terrain: TerrainType;
  readonly height: number;
  /**
   * Direction of the ramp ("north" | "south" | "east" | "west"), or `null`
   * for flat tiles. Ramps are half-height slope tiles that let Pokemon
   * walk smoothly between elevations without triggering a jump animation.
   */
  readonly slope: string | null;
}

const TERRAIN_VALUES: ReadonlySet<string> = new Set(Object.values(TerrainType));

const SLOPE_DIAGONAL: Record<string, string> = {
  north: "west",
  west: "north",
  south: "east",
  east: "south",
};

const SLOPE_HORIZONTAL: Record<string, string> = {
  east: "west",
  west: "east",
  north: "north",
  south: "south",
};

const SLOPE_VERTICAL: Record<string, string> = {
  north: "south",
  south: "north",
  east: "east",
  west: "west",
};

export function resolveTileProperties(gid: number, tileset: TiledTileset): ResolvedTileProperties {
  if (gid === 0) {
    return { terrain: TerrainType.Obstacle, height: 0, slope: null };
  }

  const { tileId, flipH, flipV, flipD } = decodeTiledGid(gid);
  const localId = tileId - tileset.firstgid;
  const tileDefinition = tileset.tiles?.find((t) => t.id === localId);

  const terrainProp = findProperty(tileDefinition?.properties, "terrain");
  const heightProp = findProperty(tileDefinition?.properties, "height");
  const slopeProp = findProperty(tileDefinition?.properties, "slope");

  let terrain: TerrainType = TerrainType.Normal;
  if (terrainProp !== undefined) {
    const value = String(terrainProp.value);
    if (!TERRAIN_VALUES.has(value)) {
      throw new Error(
        `Invalid terrain "${value}" on tile GID ${gid} (local ID ${localId}). Valid values: ${[...TERRAIN_VALUES].join(", ")}`,
      );
    }
    terrain = value as TerrainType;
  }

  const height = heightProp === undefined ? 0 : Number(heightProp.value);
  const baseSlope = slopeProp === undefined ? null : String(slopeProp.value);
  const slope = baseSlope === null ? null : transformSlopeForFlip(baseSlope, flipH, flipV, flipD);

  return { terrain, height, slope };
}

// Tiled applies flip bits in a fixed order: diagonal, then horizontal, then vertical.
function transformSlopeForFlip(
  slope: string,
  flipH: boolean,
  flipV: boolean,
  flipD: boolean,
): string {
  let current = slope;
  if (flipD) {
    current = SLOPE_DIAGONAL[current] ?? current;
  }
  if (flipH) {
    current = SLOPE_HORIZONTAL[current] ?? current;
  }
  if (flipV) {
    current = SLOPE_VERTICAL[current] ?? current;
  }
  return current;
}
