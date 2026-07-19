import { Direction } from "@pokemon-tactic/core";

/**
 * Engine-agnostic layout data for the placement direction picker (plan 126 hoist).
 * Both renderers lay the same voxel `arrow.glb` flat on the four neighbour tiles
 * and rotate it outward; the angles are pure and handedness-independent because
 * the grid→world axis convention is already normalised upstream (see the renderers'
 * `gridToWorldXZ`), so by the time we reach yaw both engines see the same world axes.
 */

export const ALL_PLACEMENT_DIRECTIONS = [
  Direction.North,
  Direction.South,
  Direction.East,
  Direction.West,
] as const;

export const ARROW_GLB_URL = "assets/ui/arrow.glb";

/**
 * The voxel arrow is modelled upright in the XY plane (goxel Y-up, pointing +Y);
 * rotate it +90° about X to lay it flat on the ground pointing +Z.
 */
export const ARROW_LAY_FLAT_X = Math.PI / 2;

/** The flattened arrow points back toward the Pokémon; +π turns each one outward. */
export const ARROW_YAW_OFFSET = Math.PI;

/**
 * Yaw bringing the flattened arrow onto each world direction. gridX → world Z,
 * gridY → world X: North = -X, South = +X, East = +Z, West = -Z.
 */
export const ARROW_ROTATION_Y: Readonly<Record<Direction, number>> = {
  [Direction.East]: 0,
  [Direction.South]: Math.PI / 2,
  [Direction.West]: Math.PI,
  [Direction.North]: -Math.PI / 2,
};

/**
 * 1 voxel = 1 sprite pixel = 1/pixelsPerWorldUnit world units (goxel/voxigen export
 * one voxel per glTF unit), so any voxel model (placement arrow, hover cursor) shares
 * the exact pixel density of the sprites.
 */
export function voxelWorldSize(pixelsPerWorldUnit: number): number {
  return 1 / pixelsPerWorldUnit;
}
