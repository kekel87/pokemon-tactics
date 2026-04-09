import type { TileState } from "@pokemon-tactic/core";
import type { TiledLayer, TiledTileset } from "./tiled-types";
import { resolveTileProperties } from "./tileset-resolver";

export function parseTerrainLayer(
  layer: TiledLayer,
  tileset: TiledTileset,
  mapWidth: number,
  mapHeight: number,
): TileState[][] {
  if (layer.type !== "tilelayer") {
    throw new Error(`Expected tilelayer, got "${layer.type}" for layer "${layer.name}"`);
  }

  if (!layer.data) {
    throw new Error(`Layer "${layer.name}" has no data`);
  }

  const expectedSize = mapWidth * mapHeight;
  if (layer.data.length !== expectedSize) {
    throw new Error(
      `Layer "${layer.name}" data length (${layer.data.length}) does not match map dimensions (${mapWidth}x${mapHeight} = ${expectedSize})`,
    );
  }

  const tiles: TileState[][] = [];
  for (let y = 0; y < mapHeight; y++) {
    const row: TileState[] = [];
    for (let x = 0; x < mapWidth; x++) {
      const index = y * mapWidth + x;
      const gid = layer.data[index] ?? 0;
      const { terrain, height } = resolveTileProperties(gid, tileset);
      row.push({
        position: { x, y },
        height,
        terrain,
        occupantId: null,
      });
    }
    tiles.push(row);
  }

  return tiles;
}
