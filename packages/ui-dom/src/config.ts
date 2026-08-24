import type { I18nContext } from "@pokemon-tactic/render-ports";

/**
 * Host-injected dependencies for the reusable DOM combat-chrome (plan 125, Phase
 * 4). The components stay engine/i18n/asset-path agnostic by receiving these from
 * the app-shell at mount time instead of importing the renderer's `i18n` or
 * `team/asset-paths` modules — so a second renderer can reuse the same HTML UI.
 * Shares `translate` / `getLanguage` / `getPortraitUrl` with `PresentationContext`
 * via the common `I18nContext`.
 */
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
   * Character to DRAW for a physical key position (plan 185). The bindings are by position
   * (`KeyboardEvent.code`), so the character depends on the layout — `KeyQ` is Q on QWERTY and A on
   * AZERTY. Resolved by the host (`key-legend.ts`), which owns both the bindings and the layout.
   */
  getKeyLabel(code: string): string;
}
