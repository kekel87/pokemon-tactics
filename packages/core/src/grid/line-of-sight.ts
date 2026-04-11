import { heightBlocks } from "../battle/height-modifier";
import type { Position } from "../types/position";
import type { Grid } from "./Grid";

export function hasLineOfSight(
  grid: Grid,
  from: Position,
  to: Position,
  referenceHeight: number,
): boolean {
  const intermediates = bresenhamLine(from, to);
  for (const position of intermediates) {
    const tile = grid.getTile(position);
    if (tile === null) {
      continue;
    }
    if (heightBlocks(tile.height, referenceHeight)) {
      return false;
    }
  }
  return true;
}

export function bresenhamLine(from: Position, to: Position): Position[] {
  const points: Position[] = [];

  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const stepX = from.x < to.x ? 1 : -1;
  const stepY = from.y < to.y ? 1 : -1;
  let error = dx - dy;

  while (x !== to.x || y !== to.y) {
    const doubleError = error * 2;
    if (doubleError > -dy) {
      error -= dy;
      x += stepX;
    }
    if (doubleError < dx) {
      error += dx;
      y += stepY;
    }
    if (x === to.x && y === to.y) {
      break;
    }
    points.push({ x, y });
  }

  return points;
}
