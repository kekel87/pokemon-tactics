import type { Material } from "@babylonjs/core/Materials/material";
import { CreateGreasedLine } from "@babylonjs/core/Meshes/Builders/greasedLineBuilder";
import type { GreasedLineBaseMesh } from "@babylonjs/core/Meshes/GreasedLine/greasedLineBaseMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { Scene } from "@babylonjs/core/scene";
import type { AuraRingSpec } from "@pokemon-tactic/render-ports";
import { borderOutlineSegments } from "./babylon-border-outline.js";
import { hexToColor3 } from "./babylon-color.js";
import {
  BABYLON_AURA_RING_PULSE_MIN_ALPHA,
  BABYLON_AURA_RING_PULSE_PERIOD_MS,
  BABYLON_AURA_RING_STACK_PITCH,
  BABYLON_FIELD_TERRAIN_OUTLINE_WIDTH,
  BABYLON_TILE_OUTLINE_Y_OFFSET,
} from "./babylon-constants.js";
import type { TileHeightLookup } from "./babylon-tile-highlights.js";
import { tileTopCenter } from "./terrain-extruder.js";

export type { AuraRingSpec };

export interface AuraRings {
  /** Replace every ring (empty clears). Idempotent. */
  set(specs: readonly AuraRingSpec[]): void;
  dispose(): void;
}

/**
 * Permanent ground rings outlining each active aura zone (plan 182), replacing the
 * hover-only emoji markers of `babylon-aura-ground-icons`.
 *
 * Geometry is procedural, not a voxel `.glb` like the hazards and decorations: the
 * outline's shape depends on the zone's radius, on the map-edge clipping, and on the
 * caster's live position, so there is no authorable asset. It reuses the field-terrain
 * ("Champs") perimeter machinery wholesale — `borderOutlineSegments` for the stair-stepped
 * contour of an arbitrary tile set, one GreasedLine segment per border edge, each riding its
 * own tile's top so the ring follows the relief.
 *
 * A caster's rings stack in world-Y: `(stackIndex + 1) × BABYLON_AURA_RING_STACK_PITCH`
 * (2 voxels — 1 of stroke, 1 of gap; a 1-voxel pitch reads as one thicker stroke). The
 * same lift doubles as the coplanar-surface offset, so there is no separate
 * anti-z-fighting mechanism to reconcile with the stacking.
 *
 * The stroke breathes (alpha, floored well above zero so the outline stays readable at
 * the trough). No halo, no post-process — see `AURA_RING_PULSE_PERIOD_MS` for what was
 * tried and dropped.
 */
export function createAuraRings(
  scene: Scene,
  heightAt: TileHeightLookup,
  mapWidth: number,
  mapHeight: number,
): AuraRings {
  const root = new TransformNode("aura_rings", scene);
  // Disposed + rebuilt on each `set`: GreasedLine's `points` is not updatable, so a
  // moved caster means a new mesh either way.
  let rings: GreasedLineBaseMesh[] = [];
  // Materials of the live rings — the pulse observer breathes their alpha each frame.
  let ringMaterials: Material[] = [];
  let disposed = false;

  const inBounds = (x: number, y: number): boolean =>
    x >= 0 && x < mapWidth && y >= 0 && y < mapHeight;

  function topAt(x: number, y: number): { x: number; y: number; z: number } {
    return tileTopCenter(x, y, heightAt(x, y), mapWidth, mapHeight);
  }

  function clear(): void {
    for (const ring of rings) {
      // `disposeMaterialAndTextures = true` is REQUIRED, not defensive: `CreateGreasedLine`
      // builds a fresh StandardMaterial per call (never shared, never cached) and the
      // constructor registers it on the scene, so the default `dispose()` frees the geometry
      // and leaves the material on `scene.materials` forever. Rings are rebuilt on every
      // board resync — i.e. after every action — so the leak would grow all battle long.
      ring.dispose(false, true);
    }
    rings = [];
    ringMaterials = [];
  }

  function drawRing(spec: AuraRingSpec): void {
    const onGrid = spec.tiles.filter((tile) => inBounds(tile.x, tile.y));
    if (onGrid.length === 0) {
      return;
    }
    // `stackIndex + 1`: even a lone ring floats one pitch off the ground, so it never
    // reads as painted onto the tile the way the Champs perimeter does.
    const lift =
      BABYLON_TILE_OUTLINE_Y_OFFSET + (spec.stackIndex + 1) * BABYLON_AURA_RING_STACK_PITCH;
    const segments = borderOutlineSegments(
      onGrid,
      topAt,
      lift,
      BABYLON_FIELD_TERRAIN_OUTLINE_WIDTH / 2,
    );
    const ring = CreateGreasedLine(
      `aura_ring_${spec.id}`,
      { points: segments },
      { color: hexToColor3(spec.color), width: BABYLON_FIELD_TERRAIN_OUTLINE_WIDTH },
      scene,
    );
    ring.isPickable = false;
    ring.parent = root;
    rings.push(ring);
    if (ring.material) {
      ringMaterials.push(ring.material);
    }
  }

  // Breathe every ring's alpha between the floor and 1. Elapsed wraps at the period to
  // keep the sine argument bounded over a long session (same pattern as the decoration
  // wind clock). All rings share one phase: staggering them would read as flicker, not
  // as a pulse, once several are stacked on the same caster.
  let pulseElapsedMs = 0;
  const pulseObserver: Observer<Scene> = scene.onBeforeRenderObservable.add(() => {
    if (ringMaterials.length === 0) {
      return;
    }
    pulseElapsedMs =
      (pulseElapsedMs + scene.getEngine().getDeltaTime()) % BABYLON_AURA_RING_PULSE_PERIOD_MS;
    const phase = (2 * Math.PI * pulseElapsedMs) / BABYLON_AURA_RING_PULSE_PERIOD_MS;
    // sin ∈ [-1,1] → wave ∈ [0,1], so alpha sweeps the floor..1 band.
    const wave = 0.5 + 0.5 * Math.sin(phase);
    const alpha =
      BABYLON_AURA_RING_PULSE_MIN_ALPHA + (1 - BABYLON_AURA_RING_PULSE_MIN_ALPHA) * wave;
    for (const material of ringMaterials) {
      material.alpha = alpha;
    }
  });

  return {
    set: (specs) => {
      if (disposed) {
        return;
      }
      clear();
      for (const spec of specs) {
        drawRing(spec);
      }
    },
    dispose: () => {
      disposed = true;
      scene.onBeforeRenderObservable.remove(pulseObserver);
      clear();
      root.dispose(false, true);
    },
  };
}
