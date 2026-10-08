import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Sprite } from "@babylonjs/core/Sprites/sprite";
import { SpriteManager } from "@babylonjs/core/Sprites/spriteManager";
import type { Scene } from "@babylonjs/core/scene";
import type { Position } from "@pokemon-tactic/core";
import type { MoveEffectPlayback, MoveEffectSpec } from "@pokemon-tactic/render-ports";
import {
  BABYLON_MOVE_EFFECT_CAMERA_PULL,
  BABYLON_MOVE_EFFECT_CAPACITY,
  BABYLON_MOVE_EFFECT_GROUND_LIFT,
  BABYLON_MOVE_EFFECT_IN_FRONT_PULL,
  BABYLON_MOVE_EFFECT_LIFT,
  BABYLON_SPRITE_PIXELS_PER_UNIT,
  BABYLON_SPRITE_RENDERING_GROUP,
} from "./babylon-constants.js";
import { type LayoutContext, layoutMoveEffect } from "./babylon-move-effect-layouts.js";
import { type Particle, particleFrame } from "./babylon-move-effect-particle.js";
import type { TileHeightLookup } from "./babylon-tile-highlights.js";
import {
  MOVE_EFFECT_SHEET_HEIGHT,
  MOVE_EFFECT_SHEET_URL,
  MOVE_EFFECT_SHEET_WIDTH,
  MOVE_EFFECT_STRIPS,
  type MoveEffectStripKey,
} from "./move-effect-atlas.js";
import { tileTopCenter } from "./terrain-extruder.js";

export interface MoveEffects {
  /**
   * Play a move's effect from `origin` (the caster's tile, or the struck Pokémon's for a spark).
   * `launch` is where a travelling effect leaves from — the caster's head — when the sprite knows it.
   */
  play(origin: Position, spec: MoveEffectSpec, launch?: Vector3): MoveEffectPlayback;
  /** Advance every effect by `combatDeltaMs` (the combat clock: speed, pause and scrub). */
  update(combatDeltaMs: number): void;
  /** Drop every effect in flight (the workshop's replay), settling their promises. */
  clear(): void;
  dispose(): void;
}

const STRIP_KEYS = Object.keys(MOVE_EFFECT_STRIPS) as MoveEffectStripKey[];

/** Every strip's cell names, by direction row then frame, built once (cells are addressed by name). */
const CELL_NAMES = new Map<MoveEffectStripKey, readonly (readonly string[])[]>(
  STRIP_KEYS.map((key) => {
    const strip = MOVE_EFFECT_STRIPS[key];
    return [
      key,
      Array.from({ length: strip.rows }, (_, row) =>
        Array.from({ length: strip.frames }, (_, frame) => `${key}:${row}:${frame}`),
      ),
    ];
  }),
);

/** The sheet as the packed-sprite JSON Babylon reads: one named cell per frame and direction. */
function packedSheet(): string {
  const frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }> = {};
  for (const key of STRIP_KEYS) {
    const strip = MOVE_EFFECT_STRIPS[key];
    (CELL_NAMES.get(key) ?? []).forEach((row, rowIndex) => {
      row.forEach((cellName, frame) => {
        frames[cellName] = {
          frame: {
            x: strip.x + frame * strip.frameWidth,
            y: strip.y + rowIndex * strip.frameHeight,
            w: strip.frameWidth,
            h: strip.frameHeight,
          },
        };
      });
    });
  }
  return JSON.stringify({ frames });
}

interface RunningEffect {
  elapsedMs: number;
  impactMs: number;
  durationMs: number;
  particles: Particle[];
  landImpact: () => void;
  finish: () => void;
}

/**
 * Generic move effects (plan 234, VFX lot 2a): PMD Origins particles from one packed sheet, drawn by
 * one sprite manager (always facing the camera, one draw call), tinted by the move's type. Every
 * effect is a timeline of particles laid out up front (`layoutMoveEffect`) — so its impact and end
 * are known in advance (the workshop's sequence shows them) — and advanced by the combat clock,
 * which gives speed, pause and scrub for free. Drawn in the sprite group so the terrain in front
 * still hides them.
 */
export function createMoveEffects(
  scene: Scene,
  heightAt: TileHeightLookup,
  mapWidth: number,
  mapHeight: number,
): MoveEffects {
  const manager = new SpriteManager(
    "move_effects",
    MOVE_EFFECT_SHEET_URL,
    BABYLON_MOVE_EFFECT_CAPACITY,
    { width: MOVE_EFFECT_SHEET_WIDTH, height: MOVE_EFFECT_SHEET_HEIGHT },
    scene,
    // Alpha-test threshold: drop only the fully transparent texels (cells come from the packed JSON).
    0.01,
    Texture.NEAREST_SAMPLINGMODE,
    true,
    packedSheet(),
  );
  manager.renderingGroupId = BABYLON_SPRITE_RENDERING_GROUP;
  manager.disableDepthWrite = true;
  manager.isPickable = false;
  let running: RunningEffect[] = [];
  /** Hidden sprites waiting for their next particle (disposing one walks the manager's list). */
  const idleSprites: Sprite[] = [];
  const cameraPull = new Vector3();
  const cameraRight = new Vector3();
  const cameraUp = new Vector3();
  const segment = new Vector3();

  const tileTop = (tile: Position, lift: number): Vector3 => {
    const top = tileTopCenter(tile.x, tile.y, heightAt(tile.x, tile.y), mapWidth, mapHeight);
    return new Vector3(top.x, top.y + lift, top.z);
  };

  const refreshCamera = (): void => {
    const camera = scene.activeCamera;
    if (!camera) {
      return;
    }
    camera.getDirectionToRef(Vector3.Forward(), cameraPull);
    cameraPull.scaleInPlace(BABYLON_MOVE_EFFECT_CAMERA_PULL);
    camera.getDirectionToRef(Vector3.Right(), cameraRight);
    camera.getDirectionToRef(Vector3.Up(), cameraUp);
  };

  const context: LayoutContext = {
    worldAt: (tile) => tileTop(tile, BABYLON_MOVE_EFFECT_LIFT),
    groundAt: (tile) => tileTop(tile, BABYLON_MOVE_EFFECT_GROUND_LIFT),
    screenAngle: (from, to) => {
      refreshCamera();
      to.subtractToRef(from, segment);
      return Math.atan2(Vector3.Dot(segment, cameraUp), Vector3.Dot(segment, cameraRight));
    },
  };

  /** A segment's length as seen on screen (its depth along the view does not show). */
  const screenLength = (from: Vector3, to: Vector3): number => {
    to.subtractToRef(from, segment);
    return Math.hypot(Vector3.Dot(segment, cameraRight), Vector3.Dot(segment, cameraUp));
  };

  /** Sprites made so far: the manager only ever draws its first `capacity` ones. */
  let createdSprites = 0;

  /** A sprite for a particle, or none once the manager is full (the particle is then skipped). */
  const acquireSprite = (item: Particle): Sprite | null => {
    let sprite = idleSprites.pop();
    if (!sprite) {
      if (createdSprites >= BABYLON_MOVE_EFFECT_CAPACITY) {
        return null;
      }
      createdSprites += 1;
      sprite = new Sprite("move_effect", manager);
    }
    const strip = MOVE_EFFECT_STRIPS[item.strip];
    const width = (strip.frameWidth / BABYLON_SPRITE_PIXELS_PER_UNIT) * item.scale;
    sprite.width = width;
    sprite.height = (strip.frameHeight / BABYLON_SPRITE_PIXELS_PER_UNIT) * item.scale * item.squash;
    sprite.color = item.tint;
    sprite.angle = item.angle;
    sprite.isPickable = false;
    sprite.isVisible = true;
    sprite.invertV = item.flipped;
    return sprite;
  };

  const releaseSprite = (item: Particle): void => {
    if (item.sprite) {
      item.sprite.isVisible = false;
      idleSprites.push(item.sprite);
      item.sprite = null;
      item.frame = -1;
    }
  };

  const placeParticle = (item: Particle, ageMs: number): void => {
    const sprite = item.sprite ?? acquireSprite(item);
    if (!sprite) {
      return;
    }
    item.sprite = sprite;
    const progress = item.travelMs > 0 ? Math.min(1, ageMs / item.travelMs) : 1;
    const position = sprite.position;
    Vector3.LerpToRef(item.from, item.to, progress, position);
    if (item.stretched) {
      // A ray's body: from its start to the running tip, as long on screen as the segment.
      sprite.height = Math.max(0.001, screenLength(item.from, position));
      Vector3.LerpToRef(item.from, position, 0.5, position);
    }
    position.y += item.arc * 4 * progress * (1 - progress);
    position.subtractInPlace(cameraPull);
    if (item.inFront) {
      // Pulled further towards the camera, past the struck Pokémon's sprite.
      position.subtractInPlace(cameraPull.scale(BABYLON_MOVE_EFFECT_IN_FRONT_PULL));
    }
    const frame = particleFrame(item, ageMs);
    if (frame !== item.frame) {
      item.frame = frame;
      sprite.cellRef = CELL_NAMES.get(item.strip)?.[item.row]?.[frame] ?? "";
    }
  };

  const settle = (effect: RunningEffect): void => {
    for (const item of effect.particles) {
      releaseSprite(item);
    }
    effect.landImpact();
    effect.finish();
  };

  const clear = (): void => {
    for (const effect of running) {
      settle(effect);
    }
    running = [];
  };

  return {
    play: (origin, spec, launch) => {
      const { particles, impactMs } = layoutMoveEffect(
        context,
        origin,
        spec,
        launch ?? context.worldAt(origin),
      );
      const durationMs = particles.reduce(
        (latest, item) => Math.max(latest, item.startMs + item.lifeMs),
        0,
      );
      let landImpact: () => void = () => undefined;
      let finish: () => void = () => undefined;
      const impact = new Promise<void>((resolve) => {
        landImpact = resolve;
      });
      const done = new Promise<void>((resolve) => {
        finish = resolve;
      });
      if (impactMs <= 0) {
        landImpact();
      }
      if (durationMs <= 0) {
        finish();
      } else {
        running.push({ elapsedMs: 0, impactMs, durationMs, particles, landImpact, finish });
      }
      return { impact, done, durationMs, impactMs };
    },
    update: (combatDeltaMs) => {
      if (running.length === 0) {
        return;
      }
      refreshCamera();
      let kept = 0;
      for (const effect of running) {
        effect.elapsedMs += combatDeltaMs;
        for (const item of effect.particles) {
          const ageMs = effect.elapsedMs - item.startMs;
          if (ageMs >= item.lifeMs) {
            releaseSprite(item);
          } else if (ageMs >= 0) {
            placeParticle(item, ageMs);
          }
        }
        if (effect.elapsedMs >= effect.impactMs) {
          effect.landImpact();
        }
        if (effect.elapsedMs >= effect.durationMs) {
          settle(effect);
        } else {
          running[kept++] = effect;
        }
      }
      running.length = kept;
    },
    clear,
    dispose: () => {
      clear();
      manager.dispose();
    },
  };
}
