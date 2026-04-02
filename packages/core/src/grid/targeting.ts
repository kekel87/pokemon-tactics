import { TargetingKind } from "../enums/targeting-kind";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import type { RangeConfig } from "../types/range-config";
import type { TargetingPattern } from "../types/targeting-pattern";
import type { TraversalContext } from "../types/traversal-context";
import { directionFromTo, getPerpendicularOffsets, stepInDirection } from "../utils/direction";
import { manhattanDistance } from "../utils/manhattan-distance";
import type { Grid } from "./Grid";

export function resolveTargeting(
  targetingPattern: TargetingPattern,
  caster: PokemonInstance,
  targetPosition: Position,
  grid: Grid,
  traversalContext?: TraversalContext,
): Position[] {
  const traversal = traversalContext ?? { allyIds: new Set<string>(), canTraverseEnemies: false };

  switch (targetingPattern.kind) {
    case TargetingKind.Single:
      return resolveSingle(
        caster.position,
        targetPosition,
        targetingPattern.range.min,
        targetingPattern.range.max,
        grid,
      );
    case TargetingKind.Self:
      return [caster.position];
    case TargetingKind.Cone:
      return resolveCone(caster.position, targetPosition, targetingPattern.range, grid);
    case TargetingKind.Cross:
      return resolveCross(caster.position, targetingPattern.size, grid);
    case TargetingKind.Line:
      return resolveLine(caster.position, targetPosition, targetingPattern.length, grid);
    case TargetingKind.Dash:
      return resolveDash(caster, targetPosition, targetingPattern.maxDistance, grid, traversal);
    case TargetingKind.Zone:
      return resolveZone(caster.position, targetingPattern.radius, grid);
    case TargetingKind.Slash:
      return resolveSlash(caster.position, targetPosition, grid);
    case TargetingKind.Blast:
      return resolveBlast(
        caster.position,
        targetPosition,
        targetingPattern.range,
        targetingPattern.radius,
        grid,
      );
  }
}

function resolveSingle(
  origin: Position,
  target: Position,
  minRange: number,
  maxRange: number,
  grid: Grid,
): Position[] {
  if (!grid.isInBounds(target)) {
    return [];
  }
  const distance = manhattanDistance(origin, target);
  if (distance < minRange || distance > maxRange) {
    return [];
  }
  return [target];
}

function resolveCone(
  origin: Position,
  target: Position,
  range: RangeConfig,
  grid: Grid,
): Position[] {
  const direction = directionFromTo(origin, target);
  const result: Position[] = [];

  for (let distance = range.min; distance <= range.max; distance++) {
    const center = stepInDirection(origin, direction, distance);
    if (grid.isInBounds(center)) {
      result.push(center);
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
          result.push(position);
        }
      }
    }
  }

  return result;
}

function resolveCross(center: Position, size: number, grid: Grid): Position[] {
  const result: Position[] = [];
  const halfSize = Math.floor(size / 2);

  for (let dx = -halfSize; dx <= halfSize; dx++) {
    const position = { x: center.x + dx, y: center.y };
    if (grid.isInBounds(position)) {
      result.push(position);
    }
  }
  for (let dy = -halfSize; dy <= halfSize; dy++) {
    if (dy === 0) {
      continue;
    }
    const position = { x: center.x, y: center.y + dy };
    if (grid.isInBounds(position)) {
      result.push(position);
    }
  }

  return result;
}

function resolveLine(origin: Position, target: Position, length: number, grid: Grid): Position[] {
  const direction = directionFromTo(origin, target);
  const result: Position[] = [];

  for (let step = 1; step <= length; step++) {
    const position = stepInDirection(origin, direction, step);
    if (!grid.isInBounds(position)) {
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
): Position[] {
  const direction = directionFromTo(caster.position, target);
  let lastReachable: Position | null = null;

  for (let step = 1; step <= maxDistance; step++) {
    const position = stepInDirection(caster.position, direction, step);
    if (!grid.isInBounds(position)) {
      break;
    }

    const occupant = grid.getOccupant(position);
    if (occupant !== null && occupant !== caster.id) {
      const isAlly = traversal.allyIds.has(occupant);
      if (isAlly || traversal.canTraverseEnemies) {
        lastReachable = position;
        continue;
      }
      return [position];
    }

    lastReachable = position;
  }

  return lastReachable ? [lastReachable] : [];
}

function resolveZone(center: Position, radius: number, grid: Grid): Position[] {
  return getTilesInRadius(center, radius, grid);
}

function resolveSlash(origin: Position, target: Position, grid: Grid): Position[] {
  const direction = directionFromTo(origin, target);
  const center = stepInDirection(origin, direction, 1);
  const result: Position[] = [];

  if (grid.isInBounds(center)) {
    result.push(center);
  }

  const perpendicularOffsets = getPerpendicularOffsets(direction);
  for (const perpendicular of perpendicularOffsets) {
    const position = { x: center.x + perpendicular.x, y: center.y + perpendicular.y };
    if (grid.isInBounds(position)) {
      result.push(position);
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
): Position[] {
  if (!grid.isInBounds(target)) {
    return [];
  }
  const distance = manhattanDistance(origin, target);
  if (distance < range.min || distance > range.max) {
    return [];
  }
  return getTilesInRadius(target, radius, grid);
}

function getTilesInRadius(center: Position, radius: number, grid: Grid): Position[] {
  const result: Position[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const position = { x: center.x + dx, y: center.y + dy };
      if (manhattanDistance(center, position) <= radius && grid.isInBounds(position)) {
        result.push(position);
      }
    }
  }
  return result;
}
