import {
  DEPTH_TILE_MAX_ELEVATION,
  TILE_ELEVATION_STEP,
  TILE_HEIGHT,
  TILE_WIDTH,
} from "../constants";

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

export interface ScreenToGridOptions {
  /**
   * When multiple cells overlap the screen point, pick the one with the
   * second-greatest depth (the cell "behind / below" the top candidate)
   * instead of the default greatest-depth-wins. Used to disambiguate
   * picking on tall pillars whose top diamond covers the flat tile behind.
   */
  readonly preferLower?: boolean;
}

export interface HitCandidate extends GridPosition {
  readonly depth: number;
}

/**
 * Strict diamond hit test: for each cell in the grid, test if the screen point
 * is inside the top-diamond of that cell at its heightData elevation.
 *
 * Default: return the cell with the greatest visual depth (top-most candidate).
 * With `preferLower`: return the candidate with the highest depth strictly
 * below the top (fallback to the only candidate if a single one is available).
 */
export function screenToGridWithHeight(
  screenX: number,
  screenY: number,
  heightData: readonly number[],
  context: IsoProjectionContext,
  options: ScreenToGridOptions = {},
): GridPosition | null {
  const candidates = collectHitCandidates(screenX, screenY, heightData, context);
  if (candidates.length === 0) {
    return null;
  }
  const top = selectByDepth(candidates, "max");
  if (!options.preferLower || candidates.length === 1) {
    return { x: top.x, y: top.y };
  }
  const below = selectBelowDepth(candidates, top.depth) ?? top;
  return { x: below.x, y: below.y };
}

function collectHitCandidates(
  screenX: number,
  screenY: number,
  heightData: readonly number[],
  context: IsoProjectionContext,
): HitCandidate[] {
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;
  const candidates: HitCandidate[] = [];

  for (let y = 0; y < context.gridHeight; y++) {
    for (let x = 0; x < context.gridWidth; x++) {
      const index = y * context.gridWidth + x;
      const height = heightData[index] ?? 0;
      const center = gridToScreen(x, y, height, context);
      const dx = screenX - center.x;
      const dy = screenY - center.y;
      if (Math.abs(dx) / halfW + Math.abs(dy) / halfH <= 1) {
        candidates.push({ x, y, depth: (x + y) * DEPTH_TILE_MAX_ELEVATION + height });
      }
    }
  }

  return candidates;
}

function selectByDepth(candidates: readonly HitCandidate[], mode: "max"): HitCandidate {
  let best = candidates[0];
  if (!best) {
    throw new Error("selectByDepth requires at least one candidate");
  }
  for (let i = 1; i < candidates.length; i++) {
    const current = candidates[i];
    if (current && (mode === "max" ? current.depth > best.depth : current.depth < best.depth)) {
      best = current;
    }
  }
  return best;
}

function selectBelowDepth(
  candidates: readonly HitCandidate[],
  topDepth: number,
): HitCandidate | null {
  let best: HitCandidate | null = null;
  for (const candidate of candidates) {
    if (candidate.depth >= topDepth) {
      continue;
    }
    if (!best || candidate.depth > best.depth) {
      best = candidate;
    }
  }
  return best;
}
