/**
 * Game-stage overlay scaffold (Phase 5 Jalon 2; hoisted to ui-dom in plan 125 so
 * every engine renderer shares it). Pure DOM — no engine import — it just builds
 * the canvas + overlay layers each renderer (Babylon, Three, …) draws into:
 *
 *   #game-root            full viewport
 *     #game-stage         fills the viewport (no letterbox), container for scale
 *       <canvas>          the engine renders here, fills the page at any ratio
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

import type { RenderBackend } from "@pokemon-tactic/render-ports";

/** Design reference resolution that `--ui-scale = 1` corresponds to (plan 119 §9). */
export const DESIGN_REFERENCE_WIDTH = 1920;
export const DESIGN_REFERENCE_HEIGHT = 1080;

/**
 * Second design reference for phone-sized stages (plan 179 §B), same 16:9 ratio so the
 * `min()` below stays meaningful. Scaling a 1920-wide mockup down to a phone in landscape
 * yields `--ui-scale ≈ 0.36`, which renders 21.6px chrome text at 8px — unreadable.
 * Comparing against 1280×720 instead yields ≈0.54, i.e. the whole chrome ×1.5, keeping the
 * mockup homothetic (nothing stops scaling relative to anything else — only the reference
 * point moves). This is NOT the per-element font-size floor rejected on 2026-07-23.
 *
 * Either dimension can be the small one, so both are tested:
 *  - **height < 500**: a phone lying down is ~667-956 CSS px wide (indistinguishable from a
 *    desktop window) but only ~360-430 tall. The pre-existing `@container stage
 *    (width < 768px)` overrides never fired in landscape for exactly that reason.
 *  - **width < 900**: a *tablet held upright* (~820×1180) is the mirror case — tall enough to
 *    pass the height test, yet its width caps the scale at ~0.43. Portrait is allowed on
 *    tablets (see `orientation-prompt.css`), so this case has to be covered too.
 *
 * Both bounds sit clear of a 1280×720 laptop window (720 > 500, 1280 > 900), which must keep
 * the desktop reference — otherwise its chrome would jump 1.5× at that size.
 *
 * CSS that scales through container queries instead of `--ui-scale` (`--ip-px`, `--wh-px`,
 * `--tt-size`) mirrors this condition. Kept as a container query rather than a JS-set
 * attribute on purpose: an `#game-stage[data-…]` selector would outrank the plain-class rules
 * it has to coexist with (notably the narrow-width bottom-bar reflow in `info-panel.css`) and
 * silently win the cascade.
 */
export const MOBILE_DESIGN_REFERENCE_WIDTH = 1280;
export const MOBILE_DESIGN_REFERENCE_HEIGHT = 720;
/** Stage height (CSS px) below which the mobile design reference kicks in. */
export const MOBILE_DESIGN_REFERENCE_MAX_HEIGHT = 500;
/** Stage width (CSS px) below which the mobile design reference kicks in (upright tablets). */
export const MOBILE_DESIGN_REFERENCE_MAX_WIDTH = 900;

export interface GameStageOptions {
  /** Called after the stage is resized, with the stage CSS pixel size. */
  readonly onResize?: (width: number, height: number) => void;
}

export interface GameStage extends RenderBackend {
  /** Canvas the engine should target. */
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
 * Build the stage/overlay scaffold inside `root` and start tracking `--ui-scale`.
 * The caller owns the engine and should call its resize from `onResize`.
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
    const isPhoneSized =
      height < MOBILE_DESIGN_REFERENCE_MAX_HEIGHT || width < MOBILE_DESIGN_REFERENCE_MAX_WIDTH;
    const referenceWidth = isPhoneSized ? MOBILE_DESIGN_REFERENCE_WIDTH : DESIGN_REFERENCE_WIDTH;
    const referenceHeight = isPhoneSized ? MOBILE_DESIGN_REFERENCE_HEIGHT : DESIGN_REFERENCE_HEIGHT;
    const scale = Math.min(width / referenceWidth, height / referenceHeight);
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
