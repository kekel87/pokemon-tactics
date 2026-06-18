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
/** Loop window (s) when a clip declares no `animation_length` (procedural loops). */
const DEFAULT_ANIMATION_LENGTH = 4;

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
  const result = molang.execute(component);
  return typeof result === "number" && Number.isFinite(result) ? result : 0;
}

function evalVec3(value: Vec3Expr, animTime: number): [number, number, number] {
  return [
    evalComponent(value[0] ?? 0, animTime),
    evalComponent(value[1] ?? 0, animTime),
    evalComponent(value[2] ?? 0, animTime),
  ];
}

/** A channel is either a constant/expression Vec3 or a `{ "time": vec3 }` keyframe map. */
function isKeyframeMap(value: ChannelValue): value is Record<string, Vec3Expr | number> {
  return (
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).every((key) => !Number.isNaN(Number(key)))
  );
}

function toVec3(value: number | string | Vec3Expr): Vec3Expr {
  return Array.isArray(value) ? value : [value, value, value];
}

function bakeChannel(value: ChannelValue, length: number, fps: number): BakedKeyframe[] {
  // Keyframe map: bake each declared time (its vec3 may still hold Molang strings).
  if (isKeyframeMap(value)) {
    return Object.entries(value)
      .map(([time, vec]) => ({ time: Number(time), value: evalVec3(toVec3(vec), Number(time)) }))
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
  for (let frame = 0; frame <= frameCount; frame++) {
    const time = (frame / fps) % (length + 1 / fps);
    frames.push({ time: frame / fps, value: evalVec3(vec, time) });
  }
  return frames;
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
    const length =
      typeof clip.animation_length === "number" ? clip.animation_length : DEFAULT_ANIMATION_LENGTH;
    const bones: BakedClip["bones"] = {};
    for (const [boneName, channels] of Object.entries(clip.bones ?? {})) {
      const bakedChannels: Record<string, BakedKeyframe[]> = {};
      for (const [channelName, value] of Object.entries(channels)) {
        bakedChannels[channelName] = bakeChannel(value, length, fps);
      }
      bones[boneName] = bakedChannels;
    }
    baked[clipName] = { length, loop: clip.loop === true || clip.loop === "true", bones };
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
}

main();
