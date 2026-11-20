/**
 * SpriteKiln trainer atlas → PMD atlas (plan 252).
 *
 * SpriteKiln names its frames `idle_s_0` with durations in milliseconds; the combat billboard reads
 * PMD atlases (`Idle-South-0`, durations in 24 ms ticks under `meta.animations`). Converting once at
 * pack time lets a trainer go through the exact same billboard as a Pokémon.
 */

import { PMD_TICK_DURATION_MS } from "../packages/view-core/src/constants.js";

const DIRECTION_BY_SPRITEKILN_SUFFIX: Readonly<Record<string, string>> = {
  s: "South",
  se: "SouthEast",
  e: "East",
  ne: "NorthEast",
  n: "North",
  nw: "NorthWest",
  w: "West",
  sw: "SouthWest",
};

interface AtlasRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SpriteKilnFrame {
  frame: AtlasRect;
  rotated: boolean;
  trimmed: boolean;
  spriteSourceSize: AtlasRect;
  sourceSize: { w: number; h: number };
  duration: number;
}

export interface SpriteKilnAtlas {
  frames: Record<string, SpriteKilnFrame>;
  meta: { size: { w: number; h: number } };
}

export interface PmdAtlasAnimation {
  frameWidth: number;
  frameHeight: number;
  durations: number[];
}

export interface PmdAtlas {
  frames: Record<string, Omit<SpriteKilnFrame, "duration">>;
  meta: { size: { w: number; h: number }; animations: Record<string, PmdAtlasAnimation> };
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** `idle_s_3` → `{ animation: "Idle", direction: "South", index: 3 }`; throws on an unknown shape. */
export function parseSpriteKilnFrameName(name: string): {
  animation: string;
  direction: string;
  index: number;
} {
  const match = /^([a-z]+)_([a-z]+)_(\d+)$/.exec(name);
  const direction = match?.[2] ? DIRECTION_BY_SPRITEKILN_SUFFIX[match[2]] : undefined;
  if (!match?.[1] || !match[3] || !direction) {
    throw new Error(`Unexpected SpriteKiln frame name: ${name}`);
  }
  return { animation: capitalize(match[1]), direction, index: Number(match[3]) };
}

/** Milliseconds → whole PMD ticks, never 0 (a 0-tick frame would never show). */
export function millisecondsToTicks(durationMs: number): number {
  return Math.max(1, Math.round(durationMs / PMD_TICK_DURATION_MS));
}

/**
 * Rename every frame to PMD naming and lift the per-frame durations into `meta.animations`. The
 * durations of an animation are read from its South direction: SpriteKiln times all directions alike.
 */
export function convertSpriteKilnAtlas(source: SpriteKilnAtlas): PmdAtlas {
  const frames: PmdAtlas["frames"] = {};
  const southFrames = new Map<string, { index: number; frame: SpriteKilnFrame }[]>();
  for (const [name, { duration, ...frame }] of Object.entries(source.frames)) {
    const { animation, direction, index } = parseSpriteKilnFrameName(name);
    frames[`${animation}-${direction}-${index}`] = frame;
    if (direction === "South") {
      const bucket = southFrames.get(animation) ?? [];
      bucket.push({ index, frame: { ...frame, duration } });
      southFrames.set(animation, bucket);
    }
  }
  const animations: PmdAtlas["meta"]["animations"] = {};
  for (const [animation, entries] of southFrames) {
    entries.sort((a, b) => a.index - b.index);
    const first = entries[0]?.frame;
    if (!first) {
      continue;
    }
    animations[animation] = {
      frameWidth: first.sourceSize.w,
      frameHeight: first.sourceSize.h,
      durations: entries.map((entry) => millisecondsToTicks(entry.frame.duration)),
    };
  }
  return { frames, meta: { size: source.meta.size, animations } };
}
