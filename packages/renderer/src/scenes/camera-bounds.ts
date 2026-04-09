import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  TILE_ELEVATION_STEP,
  TILE_HEIGHT,
  TILE_WIDTH,
} from "../constants";

export interface CameraBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Computes the camera bounds rectangle for an isometric grid, accounting for
 * elevated tiles so the whole map (including the highest stack) stays visible
 * when the camera is zoomed out.
 *
 * The origin of the isometric projection is the top corner of tile (0, 0).
 * Tiles with a positive height push the map upwards on screen by
 * `height * TILE_ELEVATION_STEP` pixels, so the camera bounds need to extend
 * by that same amount above the baseline.
 */
export function computeCameraBounds(
  gridWidth: number,
  gridHeight: number,
  maxTileHeight = 0,
): CameraBounds {
  const offsetX = CANVAS_WIDTH / 2;
  const isoTotalWidth = ((gridWidth + gridHeight) * TILE_WIDTH) / 2;
  const isoTotalHeight = ((gridWidth + gridHeight) * TILE_HEIGHT) / 2;
  const elevationExtra = maxTileHeight * TILE_ELEVATION_STEP;
  const offsetY = CANVAS_HEIGHT / 2 - (isoTotalHeight + elevationExtra) / 2;

  const marginX = isoTotalWidth / 2;
  const marginY = isoTotalHeight / 2 + elevationExtra;

  return {
    x: offsetX - isoTotalWidth / 2 - marginX,
    y: offsetY - marginY,
    width: isoTotalWidth + marginX * 2,
    height: isoTotalHeight + elevationExtra + marginY * 2,
  };
}
