/**
 * Grid→world placement math shared by every renderer (plan 126 hoist). Pure
 * scalar geometry — no engine types. The ONE place the two engines legitimately
 * diverge is captured by the explicit `Handedness` parameter: Babylon is
 * left-handed, Three right-handed, and the grid→world axis mapping must differ to
 * keep the board visually identical. Each renderer binds its handedness once (see
 * its `tileBodyHeight`/`gridToWorldXZ` wrappers) so call sites stay clean and the
 * mirror trap lives behind a single, tested switch.
 */

/**
 * Coordinate handedness of the target engine. `left-handed` = Babylon,
 * `right-handed` = Three (and any future WebGPU/right-handed backend).
 */
export type Handedness = "left-handed" | "right-handed";

/**
 * World-space height of a tile body, from its tileset `height` property (full = 1,
 * half = 0.5), floored to avoid 0-height, then squashed by `heightScale` so the
 * side walls aren't as tall as a full cube (the top diamond is unaffected —
 * footprint stays 1×1). Matches the 2D pipeline's wall-to-width proportion.
 */
export function tileBodyHeight(tileHeight: number, minHeight: number, heightScale: number): number {
  return Math.max(minHeight, tileHeight) * heightScale;
}

/**
 * Grid (col, row) → world XZ, centred on the origin.
 *
 * Babylon (left-handed) maps gridX→world Z, gridY→world X (a transpose), matching
 * the 2D iso orientation. Three is right-handed, so that same transpose renders the
 * board mirrored left-right; mapping the axes straight (gridX→X, gridY→Z) un-mirrors
 * it back to the Babylon layout. Terrain, sprites, picking and the camera all derive
 * from this one function, so they stay consistent within each engine.
 */
export function gridToWorldXZ(
  gridX: number,
  gridY: number,
  mapWidth: number,
  mapHeight: number,
  handedness: Handedness,
): { x: number; z: number } {
  if (handedness === "left-handed") {
    return {
      x: gridY - mapHeight / 2 + 0.5,
      z: gridX - mapWidth / 2 + 0.5,
    };
  }
  return {
    x: gridX - mapWidth / 2 + 0.5,
    z: gridY - mapHeight / 2 + 0.5,
  };
}

/** World-space centre of the TOP face of a tile, in the centred terrain frame. */
export function tileTopCenter(
  gridX: number,
  gridY: number,
  tileHeight: number,
  mapWidth: number,
  mapHeight: number,
  handedness: Handedness,
  minHeight: number,
  heightScale: number,
): { x: number; y: number; z: number } {
  const { x, z } = gridToWorldXZ(gridX, gridY, mapWidth, mapHeight, handedness);
  return { x, y: tileBodyHeight(tileHeight, minHeight, heightScale), z };
}
