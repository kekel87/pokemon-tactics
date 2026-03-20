import { Direction } from "../enums/direction";
import type { Position } from "../types/position";

export function directionFromTo(from: Position, to: Position): Direction {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0 ? Direction.East : Direction.West;
  }
  return deltaY >= 0 ? Direction.South : Direction.North;
}

export function stepInDirection(position: Position, direction: Direction, steps: number): Position {
  switch (direction) {
    case Direction.North:
      return { x: position.x, y: position.y - steps };
    case Direction.South:
      return { x: position.x, y: position.y + steps };
    case Direction.East:
      return { x: position.x + steps, y: position.y };
    case Direction.West:
      return { x: position.x - steps, y: position.y };
  }
}

export function getPerpendicularOffsets(direction: Direction): Position[] {
  switch (direction) {
    case Direction.North:
    case Direction.South:
      return [
        { x: -1, y: 0 },
        { x: 1, y: 0 },
      ];
    case Direction.East:
    case Direction.West:
      return [
        { x: 0, y: -1 },
        { x: 0, y: 1 },
      ];
  }
}
