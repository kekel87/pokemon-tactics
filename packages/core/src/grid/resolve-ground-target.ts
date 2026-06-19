import type { Position } from "../types/position";
import { manhattanDistance } from "../utils/manhattan-distance";
import type { Grid } from "./Grid";

/**
 * Resolve a ground-target aim (entry-hazard setters, Prescience): a single in-bounds tile within
 * Manhattan range, occupant indifferent (unlike Teleport, which requires an empty destination). When
 * `radius` > 0 (Prescience AoE), returns the aimed tile plus every in-bounds tile within that
 * Manhattan radius around it, so the preview shows the splash zone. Returns [] if the aim is invalid.
 */
export function resolveGroundTarget(
  origin: Position,
  target: Position,
  minRange: number,
  maxRange: number,
  grid: Grid,
  radius = 0,
): Position[] {
  if (!grid.isInBounds(target)) {
    return [];
  }
  const distance = manhattanDistance(origin, target);
  if (distance < minRange || distance > maxRange) {
    return [];
  }
  if (!grid.getTile(target)) {
    return [];
  }
  if (radius <= 0) {
    return [target];
  }
  const tiles: Position[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const tile = { x: target.x + dx, y: target.y + dy };
      if (Math.abs(dx) + Math.abs(dy) <= radius && grid.isInBounds(tile) && grid.getTile(tile)) {
        tiles.push(tile);
      }
    }
  }
  return tiles;
}
