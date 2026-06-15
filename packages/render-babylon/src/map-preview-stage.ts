import { type CombatScene, createCombatScene } from "./combat-scene.js";

export interface MapPreviewStage {
  /** Swap the previewed map (disposes the previous Babylon scene). */
  setMap(mapUrl: string): void;
  dispose(): void;
}

/**
 * Live map preview for the map-select screen (plan 120 step 3): a combat scene
 * without Pokemon inside an arbitrary container. One Babylon engine per map —
 * simple and leak-free (the combat-scene dispose chain is already exercised by
 * the FSM); swap cost is acceptable for a selection list.
 */
export function createMapPreviewStage(container: HTMLElement): MapPreviewStage {
  const canvas = document.createElement("canvas");
  canvas.className = "ms-preview-canvas";
  container.append(canvas);

  let scene: CombatScene | null = null;

  return {
    setMap(mapUrl) {
      scene?.dispose();
      scene = createCombatScene({
        canvas,
        mapUrl,
        pokemon: [],
        showHoverCursor: false,
      });
    },
    dispose() {
      scene?.dispose();
      scene = null;
      canvas.remove();
    },
  };
}
