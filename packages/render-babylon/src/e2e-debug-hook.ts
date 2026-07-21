import type { Scene } from "@babylonjs/core";
import { MultiMaterial } from "@babylonjs/core/Materials/multiMaterial";

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
   *  hover-only UI (info panel of the hovered Pokemon, aura ground icons, threat preview). */
  hoverTile(x: number, y: number): void;
  /** Confirm the open direction picker with its current facing (the "Attendre"/placement flow) —
   *  lets e2e end a turn to drive end-of-turn effects (status ticks, charge T2, aura/field expiry).
   *  No-op if no picker is open. */
  confirmDirection(): void;
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
    spriteStates,
  });
  (globalThis as { __ptE2e__?: E2eSceneApi }).__ptE2e__ = api;
}
