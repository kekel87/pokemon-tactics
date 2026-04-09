import { DEPTH_TILE_MAX_ELEVATION, TILE_ELEVATION_STEP, TILE_HEIGHT, TILE_WIDTH } from "../constants";

export interface IsoProjectionContext {
  readonly gridWidth: number;
  readonly gridHeight: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

export interface ScreenPosition {
  readonly x: number;
  readonly y: number;
}

export interface GridPosition {
  readonly x: number;
  readonly y: number;
}

export function gridToScreen(
  gridX: number,
  gridY: number,
  height: number,
  context: IsoProjectionContext,
): ScreenPosition {
  return {
    x: (gridX - gridY) * (TILE_WIDTH / 2) + context.offsetX,
    y: (gridX + gridY) * (TILE_HEIGHT / 2) + context.offsetY - height * TILE_ELEVATION_STEP,
  };
}

export function screenToGridFlat(
  screenX: number,
  screenY: number,
  context: IsoProjectionContext,
): GridPosition | null {
  const relX = screenX - context.offsetX;
  const relY = screenY - context.offsetY;

  const gridX = (relX / (TILE_WIDTH / 2) + relY / (TILE_HEIGHT / 2)) / 2;
  const gridY = (relY / (TILE_HEIGHT / 2) - relX / (TILE_WIDTH / 2)) / 2;

  const roundedX = Math.round(gridX);
  const roundedY = Math.round(gridY);

  if (
    roundedX < 0 ||
    roundedX >= context.gridWidth ||
    roundedY < 0 ||
    roundedY >= context.gridHeight
  ) {
    return null;
  }

  return { x: roundedX, y: roundedY };
}

/**
 * Strict diamond hit test: for each cell in the grid, test if the screen point
 * is inside the top-diamond of that cell at its heightData elevation.
 * In case of overlap, the cell with the greatest visual depth wins.
 */
export function screenToGridWithHeight(
  screenX: number,
  screenY: number,
  heightData: readonly number[],
  context: IsoProjectionContext,
): GridPosition | null {
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;
  let bestMatch: GridPosition | null = null;
  let bestDepth = Number.NEGATIVE_INFINITY;

  for (let y = 0; y < context.gridHeight; y++) {
    for (let x = 0; x < context.gridWidth; x++) {
      const index = y * context.gridWidth + x;
      const height = heightData[index] ?? 0;
      const center = gridToScreen(x, y, height, context);
      const dx = screenX - center.x;
      const dy = screenY - center.y;
      if (Math.abs(dx) / halfW + Math.abs(dy) / halfH <= 1) {
        const depth = (x + y) * DEPTH_TILE_MAX_ELEVATION + height;
        if (depth > bestDepth) {
          bestDepth = depth;
          bestMatch = { x, y };
        }
      }
    }
  }

  return bestMatch;
}
