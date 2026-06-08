/**
 * Game-stage overlay contract (Phase 5 Jalon 2).
 *
 * Builds the DOM scaffold that every Babylon scene + HTML UI shares:
 *
 *   #game-root            full viewport
 *     #game-stage         fills the viewport (no letterbox), container for scale
 *       <canvas>          Babylon renders here, fills the page at any ratio
 *       #game-overlay     absolute inset:0, pixel-aligned to the canvas
 *         .ui-world       world-anchored elements (HP bars, cursor, damage) — projected per frame
 *         .ui-screen      screen-anchored panels (info panel, timeline, menus)
 *
 * No letterbox: the canvas fills the page on any screen ratio and the dimetric
 * ortho camera "fills" the extra space (shows more/less scene). The overlay
 * matches the canvas rect for free (both fill the stage). A `ResizeObserver` on
 * the stage publishes `--ui-scale` (stage size ÷ design reference) so chrome
 * tokens scale with the *game*, not the browser.
 *
 * See `docs/babylon/babylon-2d-overlay-scaling.md` and plan 119 §4.
 */

/** Design reference resolution that `--ui-scale = 1` corresponds to (plan 119 §9). */
export const DESIGN_REFERENCE_WIDTH = 1920;
export const DESIGN_REFERENCE_HEIGHT = 1080;

export interface GameStageOptions {
  /** Called after the stage is resized, with the stage CSS pixel size. */
  readonly onResize?: (width: number, height: number) => void;
}

export interface GameStage {
  /** Canvas the Babylon engine should target. */
  readonly canvas: HTMLCanvasElement;
  /** Full-viewport playfield box; carries `--ui-scale` and the size container. */
  readonly stage: HTMLElement;
  /** Pixel-aligned overlay covering the canvas. */
  readonly overlay: HTMLElement;
  /** World-anchored layer (category A): transformed each frame. */
  readonly worldLayer: HTMLElement;
  /** Screen-anchored layer (category B): edge-anchored panels (InfoPanel, timeline, menus). */
  readonly screenLayer: HTMLElement;
  dispose(): void;
}

/**
 * Build the stage/overlay scaffold inside `root` and start tracking
 * `--ui-scale`. The caller owns the Babylon engine and should call
 * `engine.resize()` from `onResize`.
 */
export function mountGameStage(root: HTMLElement, options: GameStageOptions = {}): GameStage {
  const stage = document.createElement("div");
  stage.id = "game-stage";

  const canvas = document.createElement("canvas");
  canvas.id = "game-canvas";

  const overlay = document.createElement("div");
  overlay.id = "game-overlay";

  const worldLayer = document.createElement("div");
  worldLayer.className = "ui-world";

  const screenLayer = document.createElement("div");
  screenLayer.className = "ui-screen";

  overlay.append(worldLayer, screenLayer);
  stage.append(canvas, overlay);
  root.append(stage);

  const applyScale = (width: number, height: number): void => {
    const scale = Math.min(width / DESIGN_REFERENCE_WIDTH, height / DESIGN_REFERENCE_HEIGHT);
    stage.style.setProperty("--ui-scale", String(scale));
    options.onResize?.(width, height);
  };

  const resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) {
      return;
    }
    const box = entry.contentBoxSize[0];
    if (box) {
      applyScale(box.inlineSize, box.blockSize);
    }
  });
  resizeObserver.observe(stage);
  // Seed once synchronously so the first frame has a scale before the observer fires.
  applyScale(stage.clientWidth, stage.clientHeight);

  return {
    canvas,
    stage,
    overlay,
    worldLayer,
    screenLayer,
    dispose: () => {
      resizeObserver.disconnect();
      stage.remove();
    },
  };
}
