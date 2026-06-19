import type { Position } from "../types/position";
import { manhattanDistance } from "../utils/manhattan-distance";
import type { Grid } from "./Grid";

/**
 * Resolve a ground-target aim (entry-hazard setters): a single in-bounds tile within Manhattan range,
 * occupant indifferent (unlike Teleport, which requires an empty destination). Returns [target] when
 * valid, else [].
 */
export function resolveGroundTarget(
  origin: Position,
  target: Position,
  minRange: number,
  maxRange: number,
  grid: Grid,
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
  return [target];
}
