import type { MapDefinition } from "@pokemon-tactic/core";
import { TerrainType } from "@pokemon-tactic/core";
import type { TiledLayer, TiledTileset } from "./tiled-types";
import { decodeTiledGid, findProperty } from "./tiled-utils";

export const DecorationKind = {
  TallGrass: "tall_grass",
  Rock1: "rock_1",
  Rock2x2: "rock_2x2",
  Tree: "tree",
} as const;
export type DecorationKind = (typeof DecorationKind)[keyof typeof DecorationKind];

const DECORATION_KINDS: ReadonlySet<DecorationKind> = new Set<DecorationKind>(
  Object.values(DecorationKind),
);

function isDecorationKind(value: string): value is DecorationKind {
  return (DECORATION_KINDS as ReadonlySet<string>).has(value);
}

export interface DecorationObject {
  readonly gid: number;
  readonly kind: DecorationKind;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly footprintWidth: number;
  readonly footprintHeight: number;
  readonly heightUnits: number;
}

interface ParseDecorationsResult {
  readonly objects: readonly DecorationObject[];
  readonly errors: readonly string[];
}

export function parseDecorationsLayer(
  layer: TiledLayer,
  tilesets: readonly TiledTileset[],
  mapWidth: number,
  mapHeight: number,
  tileWidth: number,
  tileHeight: number,
  orientation: string,
): ParseDecorationsResult {
  if (layer.type !== "objectgroup") {
    return {
      objects: [],
      errors: [`Layer "${layer.name}" must be an objectgroup (got "${layer.type}")`],
    };
  }

  const objects: DecorationObject[] = [];
  const errors: string[] = [];

  for (const object of layer.objects ?? []) {
    if (object.gid === undefined) {
      errors.push(
        `Decoration object ${object.id} at pixel (${object.x}, ${object.y}) has no gid (must reference a tile)`,
      );
      continue;
    }

    const tileProperties = resolveObjectTileProperties(object.gid, tilesets);

    const objectKind = findProperty(object.properties, "kind");
    const objectFootprintWidth = findProperty(object.properties, "footprint_width");
    const objectFootprintHeight = findProperty(object.properties, "footprint_height");
    const objectHeightUnits = findProperty(object.properties, "height_units");

    const kindValue = String(
      objectKind?.value ?? findProperty(tileProperties, "kind")?.value ?? "",
    );
    if (!isDecorationKind(kindValue)) {
      errors.push(
        `Decoration object ${object.id} has invalid "kind" value "${kindValue}" (expected one of: ${[...DECORATION_KINDS].join(", ")})`,
      );
      continue;
    }

    const footprintWidth = Number(
      objectFootprintWidth?.value ?? findProperty(tileProperties, "footprint_width")?.value ?? 1,
    );
    const footprintHeight = Number(
      objectFootprintHeight?.value ?? findProperty(tileProperties, "footprint_height")?.value ?? 1,
    );
    const heightUnits = Number(
      objectHeightUnits?.value ?? findProperty(tileProperties, "height_units")?.value ?? 0,
    );

    const { anchorX, anchorY } = pixelToAnchorCell(
      object.x,
      object.y,
      tileWidth,
      tileHeight,
      orientation,
    );

    const minX = anchorX;
    const maxX = anchorX + footprintWidth - 1;
    const maxY = anchorY;
    const minY = anchorY - footprintHeight + 1;

    if (minX < 0 || maxX >= mapWidth || minY < 0 || maxY >= mapHeight) {
      errors.push(
        `Decoration object ${object.id} (${kindValue}) footprint ${footprintWidth}x${footprintHeight} at anchor (${anchorX}, ${anchorY}) derived from pixel (${object.x}, ${object.y}) goes out of map bounds ${mapWidth}x${mapHeight}`,
      );
      continue;
    }

    objects.push({
      gid: object.gid,
      kind: kindValue,
      anchorX,
      anchorY,
      footprintWidth,
      footprintHeight,
      heightUnits,
    });
  }

  return { objects, errors };
}

function pixelToAnchorCell(
  pixelX: number,
  pixelY: number,
  tileWidth: number,
  tileHeight: number,
  orientation: string,
): { anchorX: number; anchorY: number } {
  if (orientation === "isometric") {
    const halfTileWidth = tileWidth / 2;
    return {
      anchorX: Math.floor(pixelX / halfTileWidth),
      anchorY: Math.floor(pixelY / tileHeight),
    };
  }
  return {
    anchorX: Math.floor(pixelX / tileWidth),
    anchorY: Math.floor(pixelY / tileHeight),
  };
}

export function applyDecorationsToMap(
  map: MapDefinition,
  objects: readonly DecorationObject[],
): readonly string[] {
  const errors: string[] = [];
  const IMPASSABLE: ReadonlySet<TerrainType> = new Set([TerrainType.DeepWater, TerrainType.Lava]);

  for (const object of objects) {
    if (object.kind === DecorationKind.TallGrass) {
      continue;
    }

    const { anchorX, anchorY, footprintWidth, footprintHeight, heightUnits } = object;
    for (let dy = 0; dy < footprintHeight; dy++) {
      for (let dx = 0; dx < footprintWidth; dx++) {
        const x = anchorX + dx;
        const y = anchorY - dy;
        const row = map.tiles[y];
        const tile = row?.[x];
        if (!tile) {
          continue;
        }

        if (IMPASSABLE.has(tile.terrain)) {
          errors.push(
            `Decoration ${object.kind} at anchor (${anchorX}, ${anchorY}) overlaps impassable terrain "${tile.terrain}" at (${x}, ${y})`,
          );
          continue;
        }

        tile.terrain = TerrainType.Obstacle;
        tile.height += heightUnits;
      }
    }
  }

  return errors;
}

function resolveObjectTileProperties(gid: number, tilesets: readonly TiledTileset[]) {
  if (gid === 0) {
    return undefined;
  }
  const { tileId } = decodeTiledGid(gid);
  const tileset = [...tilesets]
    .filter((t) => t.firstgid <= tileId)
    .sort((a, b) => b.firstgid - a.firstgid)[0];
  if (!tileset) {
    return undefined;
  }
  const localId = tileId - tileset.firstgid;
  return tileset.tiles?.find((t) => t.id === localId)?.properties;
}
