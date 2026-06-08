import { Direction } from "@pokemon-tactic/core";

/**
 * Core grid direction → billboard world-facing angle (radians, world XZ plane).
 * Grid axes map to world as gridX → world Z, gridY → world X
 * (terrain-extruder.gridToWorldXZ), and a world facing of `atan2(z, x)` equal to
 * the camera azimuth means "facing the camera" (displayed as the PMD South
 * sprite by `computeDisplayDirection`).
 */
const WORLD_FACING_BY_DIRECTION: Readonly<Record<Direction, number>> = {
  [Direction.South]: 0,
  [Direction.East]: Math.PI / 2,
  [Direction.North]: Math.PI,
  [Direction.West]: -Math.PI / 2,
};

export function worldFacingFromDirection(direction: Direction): number {
  return WORLD_FACING_BY_DIRECTION[direction];
}
