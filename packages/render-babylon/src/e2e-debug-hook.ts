import { MultiMaterial } from "@babylonjs/core/Materials/multiMaterial";
import type { Scene } from "@babylonjs/core/scene";

/**
 * E2E scene-graph hook (plan 127). Exposes a **read-only, frozen** surface for Playwright to
 * assert mesh facts (position, visibility, rendering group) — never raw Babylon objects, never
 * pixels. Guarded by `VITE_E2E`: in a production build the env value is undefined, the guard
 * returns early, and nothing is exposed. The PRNG / battle state are never reachable from here.
 */
export interface E2eSceneApi {
  /** True once the map + all initial sprite atlases have loaded (deterministic wait signal). */
  isReady(): boolean;
  /** Drive a tile click (same path as a real canvas pick → orchestrator), to pilot a turn in e2e. */
  clickTile(x: number, y: number): void;
  /** Drive a tile hover (same path as a real canvas pointer-move → orchestrator) — lets e2e assert
   *  hover-only UI (info panel of the hovered Pokemon, threat preview). Aura zones are NO LONGER
   *  hover-driven since plan 182: they are permanent ground rings. */
  hoverTile(x: number, y: number): void;
  /** Confirm the open direction picker with its current facing (the "Attendre"/placement flow) —
   *  lets e2e end a turn to drive end-of-turn effects (status ticks, charge T2, aura/field expiry).
   *  No-op if no picker is open. */
  confirmDirection(): void;
  /**
   * Tap a tile as a FINGER would (plan 183): synthesises a real `pointerdown`/`pointerup` pair with
   * `pointerType: "touch"` on the canvas, so the press travels the actual input layer — pick, drag
   * threshold, and the two-step tap included.
   *
   * Deliberately NOT a variant of `clickTile`: that one short-circuits straight to the orchestrator
   * and every existing e2e test depends on it doing exactly that. This is the only entry point that
   * exercises the touch path, so a two-step tap needs two calls, like a real player.
   *
   * Returns false when the tile could not be projected to a canvas point (map not ready yet).
   */
  tapTile(x: number, y: number): boolean;
  meshNames(): string[];
  countByName(name: string): number;
  meshInfo(name: string): {
    isVisible: boolean;
    isEnabled: boolean;
    renderingGroupId: number;
    position: { x: number; y: number; z: number };
    /** Whether the mesh's material alpha-blends (plan 166 liquid surface / any translucent overlay). */
    transparent: boolean;
  } | null;
  /**
   * World-space bounding box of a mesh (min/max corners), or null if absent. Needed because some
   * meshes bake their world coordinates into the vertex data instead of `position`: the aura rings
   * (plan 182) are GreasedLine meshes built from absolute points, so they sit at the origin and
   * their extent — where the ring is, and which Y plane its stack level rides — is only readable
   * here. Primitives only, like the rest of the surface.
   */
  meshBounds(name: string): {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  } | null;
  /** Per-sprite animation state (§11 flying-anim assertions): the animation playing now, the
   *  resting animation it reverts to, the occupied tile and its terrain. Serializable primitives. */
  spriteStates(): {
    pokemonId: string;
    animation: string;
    restingAnimation: string;
    tile: { x: number; y: number };
    terrain: string | undefined;
  }[];
}

export interface E2eSpriteState {
  pokemonId: string;
  animation: string;
  restingAnimation: string;
  tile: { x: number; y: number };
  terrain: string | undefined;
}

export function installE2eSceneHook(
  scene: Scene,
  isReady: () => boolean,
  clickTile: (x: number, y: number) => void,
  hoverTile: (x: number, y: number) => void,
  confirmDirection: () => void,
  spriteStates: () => E2eSpriteState[],
  tapTile: (x: number, y: number) => boolean,
): void {
  // biome-ignore lint/style/useNamingConvention: VITE_E2E is an external Vite env var name.
  const e2eFlag = (import.meta as { env?: { VITE_E2E?: string } }).env?.VITE_E2E;
  if (e2eFlag !== "true") {
    return;
  }
  const api: E2eSceneApi = Object.freeze({
    isReady,
    clickTile,
    hoverTile,
    confirmDirection,
    tapTile,
    meshNames: (): string[] => scene.meshes.map((mesh) => mesh.name),
    countByName: (name: string): number => scene.meshes.filter((mesh) => mesh.name === name).length,
    meshInfo: (name: string) => {
      const mesh = scene.getMeshByName(name);
      if (!mesh) {
        return null;
      }
      // A MultiMaterial (culled liquid boxes) doesn't delegate `needAlphaBlending`, so
      // inspect its sub-materials; a plain material answers directly.
      const material = mesh.material;
      const transparent =
        material instanceof MultiMaterial
          ? material.subMaterials.some((sub) => sub?.needAlphaBlending() ?? false)
          : (material?.needAlphaBlending() ?? false);
      return {
        isVisible: mesh.isVisible,
        isEnabled: mesh.isEnabled(),
        renderingGroupId: mesh.renderingGroupId,
        position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
        transparent,
      };
    },
    meshBounds: (name: string) => {
      const mesh = scene.getMeshByName(name);
      if (!mesh) {
        return null;
      }
      // The one write on this otherwise read-only surface, and it is deliberate: the world
      // matrix is a cache the render loop refreshes every frame anyway, and forcing it here
      // makes the bounds correct even when queried before the next frame.
      mesh.computeWorldMatrix(true);
      const box = mesh.getBoundingInfo().boundingBox;
      return {
        min: { x: box.minimumWorld.x, y: box.minimumWorld.y, z: box.minimumWorld.z },
        max: { x: box.maximumWorld.x, y: box.maximumWorld.y, z: box.maximumWorld.z },
      };
    },
    spriteStates,
  });
  (globalThis as { __ptE2e__?: E2eSceneApi }).__ptE2e__ = api;
}
