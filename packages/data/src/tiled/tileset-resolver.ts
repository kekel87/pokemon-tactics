import { TerrainType } from "@pokemon-tactic/core";
import type { TiledTileset } from "./tiled-types";
import { findProperty } from "./tiled-utils";

export interface ResolvedTileProperties {
  readonly terrain: TerrainType;
  readonly height: number;
}

const TERRAIN_VALUES: ReadonlySet<string> = new Set(Object.values(TerrainType));

export function resolveTileProperties(gid: number, tileset: TiledTileset): ResolvedTileProperties {
  if (gid === 0) {
    return { terrain: TerrainType.Obstacle, height: 0 };
  }

  const localId = gid - tileset.firstgid;
  const tileDefinition = tileset.tiles?.find((t) => t.id === localId);

  const terrainProp = findProperty(tileDefinition?.properties, "terrain");
  const heightProp = findProperty(tileDefinition?.properties, "height");

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

  return { terrain, height };
}
