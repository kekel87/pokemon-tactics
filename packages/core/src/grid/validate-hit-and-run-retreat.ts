import type { Position } from "../types/position";
import type { RangeConfig } from "../types/range-config";
import { manhattanDistance } from "../utils/manhattan-distance";
import type { Grid } from "./Grid";

export function isValidHitAndRunRetreat(
  casterPosition: Position,
  retreatPosition: Position,
  retreatRange: RangeConfig,
  grid: Grid,
): boolean {
  if (!grid.isInBounds(retreatPosition)) {
    return false;
  }
  if (retreatPosition.x === casterPosition.x && retreatPosition.y === casterPosition.y) {
    return false;
  }
  const distance = manhattanDistance(casterPosition, retreatPosition);
  if (distance < retreatRange.min || distance > retreatRange.max) {
    return false;
  }
  if (grid.getOccupant(retreatPosition) !== null) {
    return false;
  }
  return true;
}

export function enumerateHitAndRunRetreatTiles(
  casterPosition: Position,
  retreatRange: RangeConfig,
  grid: Grid,
): Position[] {
  const tiles: Position[] = [];
  for (let dy = -retreatRange.max; dy <= retreatRange.max; dy++) {
    for (let dx = -retreatRange.max; dx <= retreatRange.max; dx++) {
      const candidate: Position = {
        x: casterPosition.x + dx,
        y: casterPosition.y + dy,
      };
      if (isValidHitAndRunRetreat(casterPosition, candidate, retreatRange, grid)) {
        tiles.push(candidate);
      }
    }
  }
  return tiles;
}
