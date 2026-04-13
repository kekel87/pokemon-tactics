import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { TiledMap, TiledTileset } from "../tiled/tiled-types";

function resolveExternalTilesetsSync(mapPath: string, tiledMap: TiledMap): TiledMap {
  const baseDir = dirname(mapPath);
  const tilesets = tiledMap.tilesets.map((tileset) => {
    if (!tileset.source) {
      return tileset;
    }
    const external = JSON.parse(
      readFileSync(resolve(baseDir, tileset.source), "utf-8"),
    ) as TiledTileset;
    return { ...external, firstgid: tileset.firstgid };
  });
  return { ...tiledMap, tilesets };
}

export function loadTiledMapSync(path: string): TiledMap {
  const raw = readFileSync(path, "utf-8");
  const tiledMap = JSON.parse(raw) as TiledMap;
  return resolveExternalTilesetsSync(path, tiledMap);
}
