import { TerrainType } from "@pokemon-tactic/core";
import type { TiledTileset } from "./tiled-types";
import { findProperty } from "./tiled-utils";

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

export function resolveTileProperties(gid: number, tileset: TiledTileset): ResolvedTileProperties {
  if (gid === 0) {
    return { terrain: TerrainType.Obstacle, height: 0, slope: null };
  }

  const localId = gid - tileset.firstgid;
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
  const slope = slopeProp === undefined ? null : String(slopeProp.value);

  return { terrain, height, slope };
}
