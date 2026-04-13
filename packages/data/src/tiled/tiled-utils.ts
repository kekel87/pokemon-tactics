import type { TiledProperty } from "./tiled-types";

export function findProperty(
  properties: readonly TiledProperty[] | undefined,
  name: string,
): TiledProperty | undefined {
  return properties?.find((p) => p.name === name);
}

// Tiled encodes flip flags in the top 3 bits of the GID (unsigned 32-bit).
// https://doc.mapeditor.org/en/stable/reference/tmx-map-format/#tile-flipping
const TILED_FLIP_H = 0x80000000;
const TILED_FLIP_V = 0x40000000;
const TILED_FLIP_D = 0x20000000;
const TILED_GID_MASK = ~(TILED_FLIP_H | TILED_FLIP_V | TILED_FLIP_D);

export interface TiledGidDecoded {
  readonly tileId: number;
  readonly flipH: boolean;
  readonly flipV: boolean;
  /** Anti-diagonal flip (90° rotation). Not used for isometric tiles. */
  readonly flipD: boolean;
}

export function decodeTiledGid(rawGid: number): TiledGidDecoded {
  return {
    tileId: rawGid & TILED_GID_MASK,
    flipH: (rawGid & TILED_FLIP_H) !== 0,
    flipV: (rawGid & TILED_FLIP_V) !== 0,
    flipD: (rawGid & TILED_FLIP_D) !== 0,
  };
}
