/**
 * Engine-agnostic PMDCollab atlas timing helpers (plan 125 — hoisted from
 * render-babylon so every renderer shares the playback math). PMD animations
 * hold each frame for its own number of "ticks" (`<Durations>` in the atlas
 * meta); a renderer turns that into real milliseconds and advances frames, but
 * the timing arithmetic itself is the same regardless of the draw engine. Tick
 * timing is passed in (the renderer owns its constants); only the math lives here.
 */

/** Per-animation duration metadata as it appears in a PMDCollab atlas JSON. */
export interface AtlasAnimationDurations {
  /** Per-frame PMD tick counts; length = the animation's frame count. */
  durations?: number[];
}

export interface SpriteFrameTiming {
  /** Real ms per PMD tick. */
  tickMs: number;
  /** Ticks assumed for a frame whose duration is missing from the meta. */
  defaultTicks: number;
  /** Fixed ms per frame when the animation has no PMD duration data at all. */
  fallbackMs: number;
}

/** Index an atlas's per-frame tick counts by animation name (drops empty entries). */
export function indexAtlasDurations(
  animations: Record<string, AtlasAnimationDurations> | undefined,
): Map<string, number[]> {
  const durationsByAnimation = new Map<string, number[]>();
  if (!animations) {
    return durationsByAnimation;
  }
  for (const [name, meta] of Object.entries(animations)) {
    if (meta.durations && meta.durations.length > 0) {
      durationsByAnimation.set(name, meta.durations);
    }
  }
  return durationsByAnimation;
}

/**
 * Real display time (ms) of one frame: its PMD tick count × tick duration, else
 * the fixed fallback. Ticks are clamped to ≥1 so a 0-duration frame can't spin a
 * frame-advance loop forever.
 */
export function frameDurationMs(
  durations: number[] | undefined,
  frameIndex: number,
  timing: SpriteFrameTiming,
): number {
  if (!durations || durations.length === 0) {
    return timing.fallbackMs;
  }
  const ticks = durations[frameIndex % durations.length] ?? timing.defaultTicks;
  return Math.max(1, ticks) * timing.tickMs;
}

/**
 * Total play time (ms) of an animation: sum of its per-frame PMD durations, else
 * `frameCount × fallback` when the atlas carries no duration data.
 */
export function animationTotalDurationMs(
  durations: number[] | undefined,
  frameCount: number,
  timing: Pick<SpriteFrameTiming, "tickMs" | "fallbackMs">,
): number {
  if (!durations || durations.length === 0) {
    return frameCount * timing.fallbackMs;
  }
  return durations.reduce((sum, ticks) => sum + Math.max(1, ticks) * timing.tickMs, 0);
}
