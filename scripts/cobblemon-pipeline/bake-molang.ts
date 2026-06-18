/**
 * Molang baker (plan 129, temps 3, étape 2) — the only hand-written code of the
 * Bedrock→GLB pipeline. Cobblemon animations are almost entirely PROCEDURAL Molang
 * (e.g. `math.sin(q.anim_time*90*4)*0.2`), which Blender/mcblend cannot import. This
 * pre-evaluates every channel expression via `@bridge-editor/molang` (Bedrock degree
 * semantics, NOT a from-scratch interpreter) by sampling `query.anim_time` at a fixed
 * rate over the loop window, emitting pure keyframes. `convert.py` then builds Blender
 * actions from this baked JSON.
 *
 * Usage: tsx bake-molang.ts <animation.json> <out.baked.json> [fps]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Molang } from "@bridge-editor/molang";

const SAMPLE_FPS_DEFAULT = 30;
/** Fallback loop window (s) when a clip declares no length and no period is detected. */
const DEFAULT_ANIMATION_LENGTH = 4;
/** Period detection (looping procedural clips): how far to look for a repeat, and tolerance. */
const MAX_LOOP_WINDOW_SECONDS = 16;
/** Seam error (deg/units) treated as an exact loop → short-circuit period search. */
const LOOP_MATCH_EPSILON = 0.05;

type Vec3Expr = (number | string)[];
type ChannelValue = number | string | Vec3Expr | Record<string, unknown>;

interface BakedKeyframe {
  readonly time: number;
  readonly value: [number, number, number];
}
interface BakedClip {
  readonly length: number;
  readonly loop: boolean;
  readonly bones: Record<string, Record<string, BakedKeyframe[]>>;
}

// Bedrock semantics = degrees (useRadians false). Cache + optimizers MUST stay off: the
// static optimizer folds `query.anim_time` to its first value (0), freezing every sampled
// frame. Re-parsing per frame is fine for an offline batch.
const molang = new Molang(
  { query: { anim_time: 0 } },
  { useRadians: false, useCache: false, useOptimizer: false, useAgressiveStaticOptimizer: false },
);

/** Expressions that threw during evaluation (e.g. reference an undefined query) → reported. */
const evalFailures = new Map<string, number>();

/** Evaluate one channel component (number passes through, Molang string is executed). */
function evalComponent(component: number | string, animTime: number): number {
  if (typeof component === "number") {
    return component;
  }
  molang.updateExecutionEnv({
    query: { anim_time: animTime, life_time: animTime },
    q: { anim_time: animTime, life_time: animTime },
    variable: {},
    v: {},
  });
  try {
    const result = molang.execute(component);
    return typeof result === "number" && Number.isFinite(result) ? result : 0;
  } catch {
    // A few Cobblemon clips reference queries we don't feed (rider/seat state, etc.).
    // Default to 0 (bind pose for that channel) rather than aborting the whole batch.
    evalFailures.set(component, (evalFailures.get(component) ?? 0) + 1);
    return 0;
  }
}

function evalVec3(value: Vec3Expr, animTime: number): [number, number, number] {
  return [
    evalComponent(value[0] ?? 0, animTime),
    evalComponent(value[1] ?? 0, animTime),
    evalComponent(value[2] ?? 0, animTime),
  ];
}

/** A channel is either a constant/expression Vec3 or a `{ "time": <kf> }` keyframe map. */
function isKeyframeMap(value: ChannelValue): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).every((key) => !Number.isNaN(Number(key)))
  );
}

function toVec3(value: number | string | Vec3Expr): Vec3Expr {
  return Array.isArray(value) ? value : [value, value, value];
}

/**
 * Normalise one keyframe value to a Vec3 expression. Bedrock keyframes come as a bare
 * vec3 (`[x,y,z]`, components may be Molang strings) or as a smoothing object
 * `{ pre?, post?, lerp_mode }` — for a baked snapshot we take the post value (the value
 * held after the keyframe), falling back to pre.
 */
function keyframeToVec3(value: unknown): Vec3Expr {
  if (Array.isArray(value)) {
    return value as Vec3Expr;
  }
  if (value && typeof value === "object") {
    const smoothing = value as { pre?: unknown; post?: unknown };
    const chosen = smoothing.post ?? smoothing.pre;
    if (Array.isArray(chosen)) {
      return chosen as Vec3Expr;
    }
  }
  if (typeof value === "number" || typeof value === "string") {
    return [value, value, value];
  }
  return [0, 0, 0];
}

function bakeChannel(
  value: ChannelValue,
  length: number,
  fps: number,
  loop: boolean,
): BakedKeyframe[] {
  // Keyframe map: bake each declared time (its value may be a vec3, a Molang string
  // vec3, or a `{ pre, post, lerp_mode }` smoothing object).
  if (isKeyframeMap(value)) {
    return Object.entries(value)
      .map(([time, kf]) => ({
        time: Number(time),
        value: evalVec3(keyframeToVec3(kf), Number(time)),
      }))
      .sort((a, b) => a.time - b.time);
  }
  // Expression/constant vec3: sample the whole window at `fps`.
  const vec = toVec3(value as number | string | Vec3Expr);
  const isStatic = vec.every((component) => typeof component === "number");
  if (isStatic) {
    return [{ time: 0, value: evalVec3(vec, 0) }];
  }
  const frames: BakedKeyframe[] = [];
  const frameCount = Math.max(1, Math.round(length * fps));
  // A looping clip's frame at t=length equals t=0 (Bedrock authors length = one period).
  // Emitting both leaves a duplicate keyframe → a 1-frame stutter when Babylon wraps the
  // loop. Drop the endpoint for loops so the last frame flows straight back into the first.
  const lastFrame = loop ? frameCount - 1 : frameCount;
  for (let frame = 0; frame <= lastFrame; frame++) {
    frames.push({ time: frame / fps, value: evalVec3(vec, frame / fps) });
  }
  return frames;
}

/**
 * Detect the true loop period (seconds) of a set of procedural channels. Cobblemon
 * idle/walk clips omit `animation_length` and rely on a continuously-increasing
 * `query.anim_time` (Bedrock default `anim_time_update`), so they only loop seamlessly
 * over their full mathematical period — the LCM of their trig component periods (e.g. a
 * mix of `cos(t*90*1)` at 4s and `cos(t*90*1/2)` at 8s → 8s). Rather than parse the
 * expressions, sample the combined signal and find the smallest window where the pose
 * repeats (value matches at several phases within tolerance). Falls back to `fallback`.
 */
function detectLoopPeriod(vecs: Vec3Expr[], fps: number, fallback: number): number {
  if (vecs.length === 0) {
    return fallback;
  }
  const maxFrames = Math.round(MAX_LOOP_WINDOW_SECONDS * fps);
  const margin = fps; // so testIndex + W stays inside the precomputed grid
  const grid: number[][] = [];
  for (let frame = 0; frame <= maxFrames + margin; frame++) {
    const time = frame / fps;
    const row: number[] = [];
    for (const vec of vecs) {
      row.push(...evalVec3(vec, time));
    }
    grid.push(row);
  }
  // Compare the signal against itself shifted by W at a few phases (catches components
  // that happen to align at one phase but not another), and keep the window with the
  // SMALLEST seam — not the first under a fixed tolerance. A loose tolerance used to accept
  // a near-match (e.g. 4s) while a slow component (period 5.7s) was still mid-cycle, leaving
  // a small jump; the true period can exceed the search budget, so the least-error window is
  // the smoothest loop we can bake. An exact match short-circuits.
  const testIndices = [0, Math.round(fps * 0.25), Math.round(fps * 0.5), Math.round(fps * 0.75)];
  const minFrames = Math.round(fps * 0.3);
  let bestWindow = maxFrames;
  let bestError = Number.POSITIVE_INFINITY;
  for (let window = minFrames; window <= maxFrames; window++) {
    let error = 0;
    for (const index of testIndices) {
      const a = grid[index];
      const b = grid[index + window];
      for (let component = 0; component < a.length; component++) {
        error = Math.max(error, Math.abs(a[component] - b[component]));
      }
    }
    if (error < bestError) {
      bestError = error;
      bestWindow = window;
    }
    if (error < LOOP_MATCH_EPSILON) {
      return window / fps;
    }
  }
  return bestWindow / fps;
}

/** Collect the procedural (expression) channel vectors of a clip — the loopable signal. */
function dynamicChannelVecs(clipBones: Record<string, Record<string, ChannelValue>>): Vec3Expr[] {
  const vecs: Vec3Expr[] = [];
  for (const channels of Object.values(clipBones)) {
    for (const value of Object.values(channels)) {
      if (isKeyframeMap(value)) {
        continue;
      }
      const vec = toVec3(value as number | string | Vec3Expr);
      if (!vec.every((component) => typeof component === "number")) {
        vecs.push(vec);
      }
    }
  }
  return vecs;
}

function bakeAnimationFile(inputPath: string, fps: number): Record<string, BakedClip> {
  const source = JSON.parse(readFileSync(inputPath, "utf8")) as {
    animations: Record<
      string,
      {
        animation_length?: number;
        loop?: boolean | string;
        bones?: Record<string, Record<string, ChannelValue>>;
      }
    >;
  };
  const baked: Record<string, BakedClip> = {};
  for (const [clipName, clip] of Object.entries(source.animations ?? {})) {
    const loop = clip.loop === true || clip.loop === "true";
    // A declared length wins. Otherwise: a looping procedural clip loops over its detected
    // signal period (continuous anim_time); a non-looping one falls back to the default.
    let length: number;
    if (typeof clip.animation_length === "number") {
      length = clip.animation_length;
    } else if (loop) {
      length = detectLoopPeriod(
        dynamicChannelVecs(clip.bones ?? {}),
        fps,
        DEFAULT_ANIMATION_LENGTH,
      );
    } else {
      length = DEFAULT_ANIMATION_LENGTH;
    }
    const bones: BakedClip["bones"] = {};
    for (const [boneName, channels] of Object.entries(clip.bones ?? {})) {
      const bakedChannels: Record<string, BakedKeyframe[]> = {};
      for (const [channelName, value] of Object.entries(channels)) {
        bakedChannels[channelName] = bakeChannel(value, length, fps, loop);
      }
      bones[boneName] = bakedChannels;
    }
    baked[clipName] = { length, loop, bones };
  }
  return baked;
}

function main(): void {
  const [inputPath, outputPath, fpsArg] = process.argv.slice(2);
  if (!inputPath || !outputPath) {
    throw new Error("usage: tsx bake-molang.ts <animation.json> <out.baked.json> [fps]");
  }
  const fps = fpsArg ? Number(fpsArg) : SAMPLE_FPS_DEFAULT;
  const baked = bakeAnimationFile(inputPath, fps);
  writeFileSync(outputPath, JSON.stringify(baked, null, 2));

  const clips = Object.entries(baked);
  console.log(`baked ${clips.length} clips → ${outputPath} (${fps}fps)`);
  for (const [name, clip] of clips) {
    const boneCount = Object.keys(clip.bones).length;
    console.log(`  ${name}: ${clip.length}s, ${boneCount} bones, loop=${clip.loop}`);
  }
  if (evalFailures.size > 0) {
    const total = [...evalFailures.values()].reduce((sum, count) => sum + count, 0);
    console.log(`⚠ ${evalFailures.size} expression(s) failed (${total} evals → 0):`);
    for (const [expr, count] of evalFailures) {
      console.log(`    ${count}×  ${expr.slice(0, 80)}`);
    }
  }
}

main();
