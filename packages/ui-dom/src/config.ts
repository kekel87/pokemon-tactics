import type { I18nContext } from "@pokemon-tactic/render-ports";

/**
 * Host-injected dependencies for the reusable DOM combat-chrome (plan 125, Phase
 * 4). The components stay engine/i18n/asset-path agnostic by receiving these from
 * the app-shell at mount time instead of importing the renderer's `i18n` or
 * `team/asset-paths` modules — so a second renderer can reuse the same HTML UI.
 * Shares `translate` / `getLanguage` / `getPortraitUrl` with `PresentationContext`
 * via the common `I18nContext`.
 */
/** Key characters the control legend draws, keyed by the camera control they trigger (plan 185). */
export interface CameraKeyLabels {
  readonly rotateLeft: string;
  readonly rotateRight: string;
  readonly zoomIn: string;
  readonly zoomOut: string;
}

export interface UiDomConfig extends I18nContext {
  /** Type-badge icon URL for an elemental type id. */
  getTypeIconUrl(type: string): string;
  /** Move-category icon URL (physical / special / status). */
  getCategoryIconUrl(category: string): string;
  /** Weather-readout icon URL for a weather kind (sun / rain / sandstorm / snow). */
  getWeatherIconUrl(kind: string): string;
  /** Shared Kenney 1-bit input-prompt tilesheet (mask source for the instruction-line glyph). */
  getInputPromptSheetUrl(): string;
  /** Kenney 1-bit cursor tilesheet — magnifiers, pinch, rotation pair, pointing hand (plan 185). */
  getCursorSheetUrl(): string;
  /**
   * Characters to DRAW on the camera-control legend (plan 185), one per control.
   *
   * The host resolves them, because it owns both halves: which physical key each control is bound to
   * (`keyboard-source.ts`, by `KeyboardEvent.code`) and which character that key carries on the
   * player's layout (`key-legend.ts` — `KeyQ` is Q on QWERTY, A on AZERTY). `ui-dom` therefore never
   * names a key code, which also means the future remapping screen has a single table to rewrite.
   */
  getCameraKeyLabels(): CameraKeyLabels;
}
