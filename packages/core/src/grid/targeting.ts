import { heightBlocks, isMeleeBlockedByHeight, withinHeightReach } from "../battle/height-modifier";
import { PokemonType } from "../enums/pokemon-type";
import { TargetingKind } from "../enums/targeting-kind";
import type { MoveFlags } from "../types/move-flags";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import type { RangeConfig } from "../types/range-config";
import type { TargetingPattern } from "../types/targeting-pattern";
import type { TraversalContext } from "../types/traversal-context";
import { directionFromTo, getPerpendicularOffsets, stepInDirection } from "../utils/direction";
import { manhattanDistance } from "../utils/manhattan-distance";
import type { Grid } from "./Grid";
import { bresenhamLine, hasLineOfSight } from "./line-of-sight";

export interface TargetingMoveContext {
  readonly type: PokemonType;
  readonly flags?: MoveFlags;
}

export interface DashBlockInfo {
  readonly wallHeightDiff: number;
}

export interface DashResolution {
  readonly positions: Position[];
  readonly block: DashBlockInfo | null;
}

interface LosGuard {
  readonly ignoresLoS: boolean;
  readonly grid: Grid;
}

function losAllows(
  guard: LosGuard,
  from: Position,
  to: Position,
  referenceHeight: number,
): boolean {
  if (guard.ignoresLoS) {
    return true;
  }
  return hasLineOfSight(guard.grid, from, to, referenceHeight);
}

function heightReachAllows(guard: LosGuard, originHeight: number, targetHeight: number): boolean {
  if (!guard.ignoresLoS) {
    return true;
  }
  return withinHeightReach(originHeight, targetHeight);
}

function getTileHeight(grid: Grid, position: Position): number {
  return grid.getTile(position)?.height ?? 0;
}

function computeIgnoresLoS(
  pattern: TargetingPattern,
  moveContext: TargetingMoveContext | undefined,
): boolean {
  if (moveContext === undefined) {
    return true;
  }
  if (moveContext.flags?.sound === true) {
    return true;
  }
  if (pattern.kind === TargetingKind.Zone && moveContext.type === PokemonType.Ground) {
    return true;
  }
  return false;
}

export function resolveTargeting(
  targetingPattern: TargetingPattern,
  caster: PokemonInstance,
  targetPosition: Position,
  grid: Grid,
  traversalContext?: TraversalContext,
  moveContext?: TargetingMoveContext,
): Position[] {
  const traversal = traversalContext ?? { allyIds: new Set<string>(), canTraverseEnemies: false };
  const ignoresLoS = computeIgnoresLoS(targetingPattern, moveContext);
  const guard: LosGuard = { ignoresLoS, grid };

  switch (targetingPattern.kind) {
    case TargetingKind.Single:
      return resolveSingle(
        caster.position,
        targetPosition,
        targetingPattern.range.min,
        targetingPattern.range.max,
        grid,
        guard,
      );
    case TargetingKind.Self:
      return [caster.position];
    case TargetingKind.Cone:
      return resolveCone(caster.position, targetPosition, targetingPattern.range, grid, guard);
    case TargetingKind.Cross:
      return resolveCross(caster.position, targetingPattern.size, grid, guard);
    case TargetingKind.Line:
      return resolveLine(caster.position, targetPosition, targetingPattern.length, grid);
    case TargetingKind.Dash:
      return resolveDash(caster, targetPosition, targetingPattern.maxDistance, grid, traversal)
        .positions;
    case TargetingKind.Zone:
      return resolveZone(caster.position, targetingPattern.radius, grid, guard);
    case TargetingKind.Slash:
      return resolveSlash(caster.position, targetPosition, grid);
    case TargetingKind.Blast:
      return resolveBlast(
        caster.position,
        targetPosition,
        targetingPattern.range,
        targetingPattern.radius,
        grid,
        guard,
      );
  }
}

export function resolveDashWithBlock(
  caster: PokemonInstance,
  target: Position,
  maxDistance: number,
  grid: Grid,
  traversalContext?: TraversalContext,
): DashResolution {
  const traversal = traversalContext ?? { allyIds: new Set<string>(), canTraverseEnemies: false };
  return resolveDash(caster, target, maxDistance, grid, traversal);
}

export function resolveBlastEpicenter(
  origin: Position,
  target: Position,
  grid: Grid,
  moveContext: TargetingMoveContext,
): Position {
  const ignoresLoS = computeIgnoresLoS(
    { kind: TargetingKind.Blast, range: { min: 0, max: 0 }, radius: 0 },
    moveContext,
  );
  const guard: LosGuard = { ignoresLoS, grid };
  return computeBlastEpicenter(origin, target, grid, guard);
}

export function resolveBlastImpactTile(
  origin: Position,
  target: Position,
  grid: Grid,
  moveContext: TargetingMoveContext,
): Position | null {
  const ignoresLoS = computeIgnoresLoS(
    { kind: TargetingKind.Blast, range: { min: 0, max: 0 }, radius: 0 },
    moveContext,
  );
  if (ignoresLoS) {
    return null;
  }
  return findBlastInterception(origin, target, grid);
}

function findBlastInterception(origin: Position, target: Position, grid: Grid): Position | null {
  const originHeight = getTileHeight(grid, origin);
  const targetHeight = getTileHeight(grid, target);
  const reference = Math.min(originHeight, targetHeight);
  const path = bresenhamLine(origin, target);
  let previous: Position = origin;
  for (const position of path) {
    const tileHeight = getTileHeight(grid, position);
    if (heightBlocks(tileHeight, reference)) {
      return previous;
    }
    previous = position;
  }
  return null;
}

function resolveSingle(
  origin: Position,
  target: Position,
  minRange: number,
  maxRange: number,
  grid: Grid,
  guard: LosGuard,
): Position[] {
  if (!grid.isInBounds(target)) {
    return [];
  }
  const distance = manhattanDistance(origin, target);
  if (distance < minRange || distance > maxRange) {
    return [];
  }
  const originHeight = getTileHeight(grid, origin);
  const targetHeight = getTileHeight(grid, target);

  if (maxRange === 1) {
    if (isMeleeBlockedByHeight(originHeight, targetHeight, maxRange)) {
      return [];
    }
    return [target];
  }

  if (!heightReachAllows(guard, originHeight, targetHeight)) {
    return [];
  }

  const reference = Math.min(originHeight, targetHeight);
  if (!losAllows(guard, origin, target, reference)) {
    return [];
  }
  return [target];
}

function resolveCone(
  origin: Position,
  target: Position,
  range: RangeConfig,
  grid: Grid,
  guard: LosGuard,
): Position[] {
  const direction = directionFromTo(origin, target);
  const originHeight = getTileHeight(grid, origin);
  const result: Position[] = [];

  for (let distance = range.min; distance <= range.max; distance++) {
    const center = stepInDirection(origin, direction, distance);
    if (grid.isInBounds(center)) {
      const centerHeight = getTileHeight(grid, center);
      if (
        heightReachAllows(guard, originHeight, centerHeight) &&
        losAllows(guard, origin, center, Math.min(originHeight, centerHeight))
      ) {
        result.push(center);
      }
    }

    const halfWidth = distance - 1;
    const perpendicularOffsets = getPerpendicularOffsets(direction);
    for (let offset = 1; offset <= halfWidth; offset++) {
      for (const perpendicular of perpendicularOffsets) {
        const position = {
          x: center.x + perpendicular.x * offset,
          y: center.y + perpendicular.y * offset,
        };
        if (grid.isInBounds(position)) {
          const height = getTileHeight(grid, position);
          if (
            heightReachAllows(guard, originHeight, height) &&
            losAllows(guard, origin, position, Math.min(originHeight, height))
          ) {
            result.push(position);
          }
        }
      }
    }
  }

  return result;
}

function resolveCross(center: Position, size: number, grid: Grid, guard: LosGuard): Position[] {
  const result: Position[] = [];
  const halfSize = Math.floor(size / 2);
  const centerHeight = getTileHeight(grid, center);

  for (let dx = -halfSize; dx <= halfSize; dx++) {
    const position = { x: center.x + dx, y: center.y };
    if (grid.isInBounds(position)) {
      const height = getTileHeight(grid, position);
      if (
        heightReachAllows(guard, centerHeight, height) &&
        losAllows(guard, center, position, Math.min(centerHeight, height))
      ) {
        result.push(position);
      }
    }
  }
  for (let dy = -halfSize; dy <= halfSize; dy++) {
    if (dy === 0) {
      continue;
    }
    const position = { x: center.x, y: center.y + dy };
    if (grid.isInBounds(position)) {
      const height = getTileHeight(grid, position);
      if (
        heightReachAllows(guard, centerHeight, height) &&
        losAllows(guard, center, position, Math.min(centerHeight, height))
      ) {
        result.push(position);
      }
    }
  }

  return result;
}

function resolveLine(origin: Position, target: Position, length: number, grid: Grid): Position[] {
  const direction = directionFromTo(origin, target);
  const originHeight = getTileHeight(grid, origin);
  const result: Position[] = [];

  for (let step = 1; step <= length; step++) {
    const position = stepInDirection(origin, direction, step);
    if (!grid.isInBounds(position)) {
      break;
    }
    const tileHeight = getTileHeight(grid, position);
    if (heightBlocks(tileHeight, originHeight)) {
      break;
    }
    result.push(position);
  }

  return result;
}

function resolveDash(
  caster: PokemonInstance,
  target: Position,
  maxDistance: number,
  grid: Grid,
  traversal: TraversalContext,
): DashResolution {
  const direction = directionFromTo(caster.position, target);
  let lastReachable: Position | null = null;
  let previousHeight = getTileHeight(grid, caster.position);
  let block: DashBlockInfo | null = null;

  for (let step = 1; step <= maxDistance; step++) {
    const position = stepInDirection(caster.position, direction, step);
    if (!grid.isInBounds(position)) {
      break;
    }

    const nextHeight = getTileHeight(grid, position);
    const heightDiff = nextHeight - previousHeight;
    if (heightDiff > 0.5) {
      block = { wallHeightDiff: heightDiff };
      break;
    }

    const occupant = grid.getOccupant(position);
    if (occupant !== null && occupant !== caster.id) {
      const isAlly = traversal.allyIds.has(occupant);
      if (isAlly || traversal.canTraverseEnemies) {
        lastReachable = position;
        previousHeight = nextHeight;
        continue;
      }
      return { positions: [position], block: null };
    }

    lastReachable = position;
    previousHeight = nextHeight;
  }

  if (lastReachable === null) {
    return { positions: [], block };
  }
  return { positions: [lastReachable], block };
}

function resolveZone(center: Position, radius: number, grid: Grid, guard: LosGuard): Position[] {
  return getTilesInRadius(center, radius, grid, guard);
}

function resolveSlash(origin: Position, target: Position, grid: Grid): Position[] {
  const direction = directionFromTo(origin, target);
  const center = stepInDirection(origin, direction, 1);
  const originHeight = getTileHeight(grid, origin);
  const result: Position[] = [];

  if (grid.isInBounds(center)) {
    if (!isMeleeBlockedByHeight(originHeight, getTileHeight(grid, center), 1)) {
      result.push(center);
    }
  }

  const perpendicularOffsets = getPerpendicularOffsets(direction);
  for (const perpendicular of perpendicularOffsets) {
    const position = { x: center.x + perpendicular.x, y: center.y + perpendicular.y };
    if (grid.isInBounds(position)) {
      if (!isMeleeBlockedByHeight(originHeight, getTileHeight(grid, position), 1)) {
        result.push(position);
      }
    }
  }

  return result;
}

function resolveBlast(
  origin: Position,
  target: Position,
  range: RangeConfig,
  radius: number,
  grid: Grid,
  guard: LosGuard,
): Position[] {
  if (!grid.isInBounds(target)) {
    return [];
  }
  const distance = manhattanDistance(origin, target);
  if (distance < range.min || distance > range.max) {
    return [];
  }

  const epicenter = computeBlastEpicenter(origin, target, grid, guard);
  return getTilesInRadius(epicenter, radius, grid, guard);
}

function computeBlastEpicenter(
  origin: Position,
  target: Position,
  grid: Grid,
  guard: LosGuard,
): Position {
  if (guard.ignoresLoS) {
    return target;
  }
  const interception = findBlastInterception(origin, target, grid);
  return interception ?? target;
}

function getTilesInRadius(
  center: Position,
  radius: number,
  grid: Grid,
  guard: LosGuard,
): Position[] {
  const result: Position[] = [];
  const centerHeight = getTileHeight(grid, center);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const position = { x: center.x + dx, y: center.y + dy };
      if (manhattanDistance(center, position) > radius) {
        continue;
      }
      if (!grid.isInBounds(position)) {
        continue;
      }
      const tileHeight = getTileHeight(grid, position);
      if (guard.ignoresLoS) {
        if (!withinHeightReach(centerHeight, tileHeight)) {
          continue;
        }
      } else {
        if (heightBlocks(tileHeight, centerHeight)) {
          continue;
        }
        const reference = Math.min(centerHeight, tileHeight);
        if (!hasLineOfSight(grid, center, position, reference)) {
          continue;
        }
      }
      result.push(position);
    }
  }
  return result;
}
