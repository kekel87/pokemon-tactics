import type { TiledProperty } from "./tiled-types";

export function findProperty(
  properties: readonly TiledProperty[] | undefined,
  name: string,
): TiledProperty | undefined {
  return properties?.find((p) => p.name === name);
}
