import {
  createBattleBoardView as babylonCreateBattleBoardView,
  createCombatScene as babylonCreateCombatScene,
} from "@pokemon-tactic/render-babylon";

/**
 * Rendering-backend seam (plan 125/126). The app-shell consumes the combat-scene
 * factory surface through this indirection instead of importing a renderer
 * directly, so swapping or adding an engine stays a one-file change: add a new
 * backend constant and a branch in {@link getRendererBackend}. The factory types
 * match the engine-agnostic `render-ports` combat-scene contract.
 *
 * `render-three` — the POC harness that proved the contract is engine-agnostic —
 * was removed once the shared logic was hoisted into `view-core` / `render-ports`
 * (plan 126). Babylon is currently the sole backend.
 */
export interface RendererBackend {
  readonly createCombatScene: typeof babylonCreateCombatScene;
  readonly createBattleBoardView: typeof babylonCreateBattleBoardView;
}

const BABYLON_BACKEND: RendererBackend = {
  createCombatScene: babylonCreateCombatScene,
  createBattleBoardView: babylonCreateBattleBoardView,
};

/** Resolve the rendering backend (Babylon is currently the only engine). */
export function getRendererBackend(): RendererBackend {
  return BABYLON_BACKEND;
}
