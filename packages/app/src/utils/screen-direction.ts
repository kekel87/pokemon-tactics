import { Direction } from "@pokemon-tactic/core";

export function getDirectionFromScreenPosition(
  worldX: number,
  worldY: number,
  centerX: number,
  centerY: number,
): Direction {
  const dx = worldX - centerX;
  const dy = worldY - centerY;

  if (dx >= 0) {
    return dy < 0 ? Direction.North : Direction.East;
  }
  return dy <= 0 ? Direction.West : Direction.South;
}
