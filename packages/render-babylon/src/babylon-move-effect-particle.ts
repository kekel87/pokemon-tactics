import type { Color4 } from "@babylonjs/core/Maths/math.color";
import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Sprite } from "@babylonjs/core/Sprites/sprite";
import { BABYLON_MOVE_EFFECT_FRAME_MS } from "./babylon-constants.js";
import { MOVE_EFFECT_STRIPS, type MoveEffectStripKey } from "./move-effect-atlas.js";

/**
 * One sprite on a move effect's timeline (plan 234), in combat ms since the effect started. It plays
 * its strip once (or loops, or holds one frame) while it travels from `from` to `to`.
 */
export interface Particle {
  strip: MoveEffectStripKey;
  /** Direction row of a Dir8 strip (PMD order: Down, DownLeft, Left, UpLeft, Up, …). */
  row: number;
  startMs: number;
  lifeMs: number;
  from: Vector3;
  to: Vector3;
  /** How long the trip from `from` to `to` takes; the particle then stays at `to`. */
  travelMs: number;
  /** World-Y bump at mid-trip (a throw, a lob). */
  arc: number;
  tint: Color4;
  /** Size against the sprites' pixel density (1 = same pixel size). */
  scale: number;
  /** Height over width: 0.5 lays a ring flat on the ground, as seen in perspective. */
  squash: number;
  /** Screen rotation, radians, counter-clockwise (a Dir1 strip pointing along its blow). */
  angle: number;
  frameMs: number;
  /** Loop between these frames instead of playing the strip once. */
  loop: readonly [number, number] | null;
  /** Hold this frame for the whole life (one picked out of a strip of variants: a note's colour). */
  heldFrame: number | null;
  /** Shown upside down (a stat stroke rising instead of falling). */
  flipped: boolean;
  /**
   * A stretched segment instead of a point (a ray's body): it runs from `from` to its tip, which
   * travels to `to`; the sprite's height becomes the segment's on-screen length.
   */
  stretched: boolean;
  /** Drawn over the Pokémon sprites (a blow's mark), not among them. */
  inFront: boolean;
  sprite: Sprite | null;
  frame: number;
}

export function stripLifeMs(
  strip: MoveEffectStripKey,
  frameMs = BABYLON_MOVE_EFFECT_FRAME_MS,
): number {
  return MOVE_EFFECT_STRIPS[strip].frames * frameMs;
}

/** A particle with every option at its default: plays its strip once, travelling from → to. */
export function particle(
  strip: MoveEffectStripKey,
  from: Vector3,
  to: Vector3,
  startMs: number,
  lifeMs: number,
  tint: Color4,
  options: Partial<Omit<Particle, "strip" | "from" | "to" | "startMs" | "lifeMs" | "tint">> = {},
): Particle {
  return {
    strip,
    row: 0,
    startMs,
    lifeMs,
    from,
    to,
    travelMs: lifeMs,
    arc: 0,
    tint,
    scale: 1,
    squash: 1,
    angle: 0,
    frameMs: BABYLON_MOVE_EFFECT_FRAME_MS,
    loop: null,
    heldFrame: null,
    flipped: false,
    stretched: false,
    inFront: false,
    sprite: null,
    frame: -1,
    ...options,
  };
}

/** The frame a particle shows `ageMs` into its life. */
export function particleFrame(item: Particle, ageMs: number): number {
  if (item.heldFrame !== null) {
    return item.heldFrame;
  }
  const tick = Math.floor(ageMs / item.frameMs);
  if (item.loop) {
    return item.loop[0] + (tick % (item.loop[1] - item.loop[0] + 1));
  }
  return Math.min(MOVE_EFFECT_STRIPS[item.strip].frames - 1, tick);
}
