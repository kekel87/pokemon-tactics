import { type MapDefinition, TerrainType } from "@pokemon-tactic/core";
import { DecorationKind, type DecorationObject } from "@pokemon-tactic/data";

/**
 * Engine-agnostic decoration placement planning (plan 126 hoist). Pure map data:
 * which decoration billboards a map needs and where — the explicit rock/tree
 * objects, then auto-placed tall-grass on every free `TallGrass` terrain tile (the
 * 2D renderer's rule). The renderer turns each placement into an engine billboard;
 * the occupancy + terrain-scan arithmetic is identical for every engine.
 */

/** One decoration to spawn: a kind standing on a footprint anchored at (anchorX, anchorY). */
export interface DecorationPlacement {
  readonly kind: DecorationKind;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly footprintWidth: number;
  readonly footprintHeight: number;
}

/**
 * Ordered placements for a map: explicit rock/tree objects first (in declaration
 * order), then auto-placed tall-grass on every free TallGrass tile not already
 * covered by a rock/tree footprint.
 */
export function planDecorations(
  map: MapDefinition,
  decorationObjects: readonly DecorationObject[],
): DecorationPlacement[] {
  const placements: DecorationPlacement[] = [];
  // Cells covered by a rock/tree footprint — tall-grass skips these.
  const occupied = new Set<string>();
  for (const object of decorationObjects) {
    if (object.kind === DecorationKind.TallGrass) {
      continue;
    }
    for (let dy = 0; dy < object.footprintHeight; dy++) {
      for (let dx = 0; dx < object.footprintWidth; dx++) {
        occupied.add(`${object.anchorX + dx},${object.anchorY - dy}`);
      }
    }
    placements.push({
      kind: object.kind,
      anchorX: object.anchorX,
      anchorY: object.anchorY,
      footprintWidth: object.footprintWidth,
      footprintHeight: object.footprintHeight,
    });
  }

  // Tall-grass auto-placement: every free TallGrass terrain tile (matches the 2D renderer).
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.tiles[y]?.[x]?.terrain === TerrainType.TallGrass && !occupied.has(`${x},${y}`)) {
        placements.push({
          kind: DecorationKind.TallGrass,
          anchorX: x,
          anchorY: y,
          footprintWidth: 1,
          footprintHeight: 1,
        });
      }
    }
  }

  return placements;
}
