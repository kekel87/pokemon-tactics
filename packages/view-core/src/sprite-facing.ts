import { Direction } from "@pokemon-tactic/core";

/**
 * Engine-agnostic sprite-facing math (plan 125 — hoisted from render-babylon so
 * every renderer shares it). A PMD billboard shows one of 8 directional frames
 * depending on its world-facing angle relative to the camera azimuth; the angle
 * convention assumes the grid→world mapping `gridX → world Z, gridY → world X`
 * (a world facing of `atan2(z, x)` equal to the camera azimuth = "facing the
 * camera" = the South frame). The renderer only uploads the chosen frame's UV.
 */
export type PmdDirection =
  | "South"
  | "SouthEast"
  | "East"
  | "NorthEast"
  | "North"
  | "NorthWest"
  | "West"
  | "SouthWest";

export const DIRECTION_SECTORS: readonly PmdDirection[] = [
  "South",
  "SouthEast",
  "East",
  "NorthEast",
  "North",
  "NorthWest",
  "West",
  "SouthWest",
];

const WORLD_FACING_BY_DIRECTION: Readonly<Record<Direction, number>> = {
  [Direction.South]: 0,
  [Direction.East]: Math.PI / 2,
  [Direction.North]: Math.PI,
  [Direction.West]: -Math.PI / 2,
};

/** Core grid direction → billboard world-facing angle (radians, world XZ plane). */
export function worldFacingFromDirection(direction: Direction): number {
  return WORLD_FACING_BY_DIRECTION[direction];
}

/** World-facing angle + camera azimuth → the PMD directional frame to display. */
export function computeDisplayDirection(
  worldFacingRadians: number,
  cameraAzimuthRadians: number,
): PmdDirection {
  const relative = worldFacingRadians - cameraAzimuthRadians;
  const normalized = ((relative % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const sector = Math.round(normalized / (Math.PI / 4)) % 8;
  const direction = DIRECTION_SECTORS[sector];
  if (!direction) {
    throw new Error(`Invalid sector ${sector}`);
  }
  return direction;
}
