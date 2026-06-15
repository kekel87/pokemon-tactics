import type { Scene } from "@babylonjs/core";

/**
 * E2E scene-graph hook (plan 127). Exposes a **read-only, frozen** surface for Playwright to
 * assert mesh facts (position, visibility, rendering group) — never raw Babylon objects, never
 * pixels. Guarded by `VITE_E2E`: in a production build the env value is undefined, the guard
 * returns early, and nothing is exposed. The PRNG / battle state are never reachable from here.
 */
export interface E2eSceneApi {
  /** True once the map + all initial sprite atlases have loaded (deterministic wait signal). */
  isReady(): boolean;
  meshNames(): string[];
  countByName(name: string): number;
  meshInfo(name: string): {
    isVisible: boolean;
    isEnabled: boolean;
    renderingGroupId: number;
    position: { x: number; y: number; z: number };
  } | null;
}

export function installE2eSceneHook(scene: Scene, isReady: () => boolean): void {
  // biome-ignore lint/style/useNamingConvention: VITE_E2E is an external Vite env var name.
  const e2eFlag = (import.meta as { env?: { VITE_E2E?: string } }).env?.VITE_E2E;
  if (e2eFlag !== "true") {
    return;
  }
  const api: E2eSceneApi = Object.freeze({
    isReady,
    meshNames: (): string[] => scene.meshes.map((mesh) => mesh.name),
    countByName: (name: string): number => scene.meshes.filter((mesh) => mesh.name === name).length,
    meshInfo: (name: string) => {
      const mesh = scene.getMeshByName(name);
      if (!mesh) {
        return null;
      }
      return {
        isVisible: mesh.isVisible,
        isEnabled: mesh.isEnabled(),
        renderingGroupId: mesh.renderingGroupId,
        position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
      };
    },
  });
  (globalThis as { __ptE2e__?: E2eSceneApi }).__ptE2e__ = api;
}
