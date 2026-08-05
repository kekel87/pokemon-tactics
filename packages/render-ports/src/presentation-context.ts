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
  /**
   * Whether enemy information is withheld (fog, plan 176): exact HP figures, an unrevealed held item,
   * Substitute HP, and absolute damage bounds in the forecast. Hard-on in a real battle — it is a
   * rule, not a comfort setting; the sandbox studio switches it off to inspect exact figures.
   */
  isEnemyInfoHidden(): boolean;
  /** Localised held-item name for an item id (null when unknown). */
  getItemName(itemId: string): string | null;
  /** Localised ability name for an ability id (null when unknown) — ability-manip badges (plan 153). */
  getAbilityName(abilityId: string): string | null;
  /** Species base types for a Pokémon definition id (override/transform applied by the adapter, plan 174). */
  getPokemonTypes(definitionId: string): readonly string[];
  /** Type-icon sprite URL for a type id (tile-info type bonus / immunity, plan 177). */
  getTypeIconUrl(type: string): string;
  /** Status-icon sprite URL for a status kind (tile-info on-stop status, plan 177). */
  getStatusIconUrl(kind: string): string;
  /**
   * Status-LABEL sprite URL for a status kind (plan 178): the `label-<status>.png` art with the name
   * and colour baked in, as opposed to the bare `icon-<status>.png` glyph. Used wherever a status is
   * shown as a self-describing chip rather than a pictogram to decode.
   */
  getStatusLabelUrl(kind: string): string;
}
