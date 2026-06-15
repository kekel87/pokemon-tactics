/**
 * Host-injected localisation deps shared by every renderer-facing config (plan
 * 125 polish). `PresentationContext` and `UiDomConfig` both extend this so the
 * app-shell wires `translate` / `getLanguage` / `getPortraitUrl` once instead of
 * duplicating their shape. `translate` is loosened to `string` keys here (the
 * concrete `t` validates against the locale union at the injection site).
 */
export interface I18nContext {
  /** Localise a message key (the host wires the renderer's `t`). */
  translate(key: string, params?: Record<string, string | number>): string;
  /** Current UI language code, passed to data name lookups (`getMoveName`, …). */
  getLanguage(): string;
  /** Portrait image URL for a Pokémon definition id. */
  getPortraitUrl(definitionId: string): string;
}
