import type { Position } from "../types/position";
import { manhattanDistance } from "../utils/manhattan-distance";
import type { Grid } from "./Grid";

const CARDINAL_OFFSETS: Position[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export function resolveTeleport(
  origin: Position,
  target: Position,
  minRange: number,
  maxRange: number,
  grid: Grid,
  aoeRadius?: number,
): Position[] {
  if (!grid.isInBounds(target)) {
    return [];
  }
  const distance = manhattanDistance(origin, target);
  if (distance < minRange || distance > maxRange) {
    return [];
  }
  if (grid.getOccupant(target) !== null) {
    return [];
  }
  const result: Position[] = [target];
  if (aoeRadius !== undefined && aoeRadius >= 1) {
    for (const offset of CARDINAL_OFFSETS) {
      const cardinal: Position = { x: target.x + offset.x, y: target.y + offset.y };
      if (grid.isInBounds(cardinal)) {
        result.push(cardinal);
      }
    }
  }
  return result;
}
