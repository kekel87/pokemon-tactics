import type { I18nContext } from "./i18n-context.js";

/**
 * Host-injected dependencies for the presentation layer (plan 125, décision #4).
 * The orchestrator + view-builders stay engine/renderer-agnostic by receiving
 * these from the app-shell at boot instead of importing the renderer's i18n,
 * settings or asset-path modules. Shares `translate` / `getLanguage` /
 * `getPortraitUrl` with `UiDomConfig` via the common `I18nContext`.
 */
export interface PresentationContext extends I18nContext {
  /** Whether the confirm-phase damage preview is enabled (renderer setting). */
  isDamagePreviewEnabled(): boolean;
  /** Localised held-item name for an item id (null when unknown). */
  getItemName(itemId: string): string | null;
}
