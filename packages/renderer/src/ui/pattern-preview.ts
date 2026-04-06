import type { TargetingPattern } from "@pokemon-tactic/core";
import { TargetingKind } from "@pokemon-tactic/core";

export const PatternCell = {
  Empty: "empty",
  Target: "target",
  Dash: "dash",
  Caster: "caster",
} as const;

export type PatternCell = (typeof PatternCell)[keyof typeof PatternCell];

const MIN_SIZE = 3;

function emptyRow(width: number): PatternCell[] {
  return Array.from({ length: width }, () => PatternCell.Empty);
}

function ensureMinSize(cells: PatternCell[][]): PatternCell[][] {
  let result = cells;
  const height = result.length;
  const width = result[0]?.length ?? 0;

  if (width < MIN_SIZE) {
    const padLeft = Math.floor((MIN_SIZE - width) / 2);
    result = result.map((row) => {
      const padded = emptyRow(MIN_SIZE);
      for (let i = 0; i < row.length; i++) {
        padded[padLeft + i] = row[i] ?? PatternCell.Empty;
      }
      return padded;
    });
  }

  if (height < MIN_SIZE) {
    const totalPad = MIN_SIZE - height;
    const padTop = Math.floor(totalPad / 2);
    const padBottom = totalPad - padTop;
    const currentWidth = result[0]?.length ?? MIN_SIZE;
    const topRows = Array.from({ length: padTop }, () => emptyRow(currentWidth));
    const bottomRows = Array.from({ length: padBottom }, () => emptyRow(currentWidth));
    result = [...topRows, ...result, ...bottomRows];
  }

  return result;
}

function set(cells: PatternCell[][], x: number, y: number, cell: PatternCell): void {
  const row = cells[y];
  if (row && x >= 0 && x < row.length) {
    row[x] = cell;
  }
}

export function buildPatternPreview(pattern: TargetingPattern): PatternCell[][] {
  switch (pattern.kind) {
    case TargetingKind.Self:
      return buildSelf();
    case TargetingKind.Single:
      return buildSingle(pattern.range.max);
    case TargetingKind.Line:
      return buildLine(pattern.length);
    case TargetingKind.Dash:
      return buildDash(pattern.maxDistance);
    case TargetingKind.Cone:
      return buildCone(pattern.range.min, pattern.range.max);
    case TargetingKind.Slash:
      return buildSlash();
    case TargetingKind.Cross:
      return buildCross(pattern.size);
    case TargetingKind.Zone:
      return buildZone(pattern.radius);
    case TargetingKind.Blast:
      return buildBlast(pattern.radius);
  }
}

function makeGrid(width: number, height: number): PatternCell[][] {
  return Array.from({ length: height }, () => emptyRow(width));
}

function buildSelf(): PatternCell[][] {
  const grid = makeGrid(1, 1);
  set(grid, 0, 0, PatternCell.Caster);
  return ensureMinSize(grid);
}

function buildSingle(maxRange: number): PatternCell[][] {
  if (maxRange <= 1) {
    const grid = makeGrid(1, 2);
    set(grid, 0, 0, PatternCell.Target);
    set(grid, 0, 1, PatternCell.Caster);
    return ensureMinSize(grid);
  }
  const grid = makeGrid(1, 1);
  set(grid, 0, 0, PatternCell.Target);
  return ensureMinSize(grid);
}

function buildLine(length: number): PatternCell[][] {
  const height = length + 1;
  const grid = makeGrid(1, height);
  set(grid, 0, height - 1, PatternCell.Caster);
  for (let i = 0; i < length; i++) {
    set(grid, 0, height - 2 - i, PatternCell.Target);
  }
  return ensureMinSize(grid);
}

function buildDash(maxDistance: number): PatternCell[][] {
  const height = maxDistance + 1;
  const grid = makeGrid(1, height);
  set(grid, 0, height - 1, PatternCell.Caster);
  for (let i = 1; i < maxDistance; i++) {
    set(grid, 0, height - 1 - i, PatternCell.Dash);
  }
  set(grid, 0, 0, PatternCell.Target);
  return ensureMinSize(grid);
}

function buildCone(minDist: number, maxDist: number): PatternCell[][] {
  const maxWidth = maxDist * 2 - 1;
  const height = maxDist - minDist + 1 + 1;
  const grid = makeGrid(maxWidth, height);
  const centerX = Math.floor(maxWidth / 2);

  set(grid, centerX, height - 1, PatternCell.Caster);

  for (let distance = minDist; distance <= maxDist; distance++) {
    const row = height - 2 - (distance - minDist);
    set(grid, centerX, row, PatternCell.Target);
    const halfWidth = distance - 1;
    for (let offset = 1; offset <= halfWidth; offset++) {
      set(grid, centerX - offset, row, PatternCell.Target);
      set(grid, centerX + offset, row, PatternCell.Target);
    }
  }
  return ensureMinSize(grid);
}

function buildSlash(): PatternCell[][] {
  const grid = makeGrid(3, 2);
  set(grid, 0, 0, PatternCell.Target);
  set(grid, 1, 0, PatternCell.Target);
  set(grid, 2, 0, PatternCell.Target);
  set(grid, 1, 1, PatternCell.Caster);
  return ensureMinSize(grid);
}

function buildCross(size: number): PatternCell[][] {
  const grid = makeGrid(size, size);
  const center = Math.floor(size / 2);
  set(grid, center, center, PatternCell.Caster);
  for (let i = 1; i <= center; i++) {
    set(grid, center, center - i, PatternCell.Target);
    set(grid, center, center + i, PatternCell.Target);
    set(grid, center - i, center, PatternCell.Target);
    set(grid, center + i, center, PatternCell.Target);
  }
  return ensureMinSize(grid);
}

function buildZone(radius: number): PatternCell[][] {
  const size = radius * 2 + 1;
  const grid = makeGrid(size, size);
  const center = radius;
  set(grid, center, center, PatternCell.Caster);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (Math.abs(dx) + Math.abs(dy) <= radius && (dx !== 0 || dy !== 0)) {
        set(grid, center + dx, center + dy, PatternCell.Target);
      }
    }
  }
  return ensureMinSize(grid);
}

function buildBlast(radius: number): PatternCell[][] {
  const size = radius * 2 + 1;
  const grid = makeGrid(size, size);
  const center = radius;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (Math.abs(dx) + Math.abs(dy) <= radius) {
        set(grid, center + dx, center + dy, PatternCell.Target);
      }
    }
  }
  return ensureMinSize(grid);
}
