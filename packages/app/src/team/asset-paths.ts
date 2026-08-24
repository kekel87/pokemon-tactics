export function getTypeIconUrl(type: string): string {
  return `assets/ui/types/${type}.png`;
}

export function getCategoryIconUrl(category: string): string {
  return `assets/ui/categories/${category}.png`;
}

export function getStatusIconUrl(kind: string): string {
  return `assets/ui/statuses/icon-${kind.replace(/_/g, "-")}.png`;
}

/** Status chip art (plan 178): `label-*` bakes in the name + colour, unlike the bare `icon-*` glyph. */
export function getStatusLabelUrl(kind: string): string {
  return `assets/ui/statuses/label-${kind.replace(/_/g, "-")}.png`;
}

export function getWeatherIconUrl(kind: string): string {
  return `assets/ui/weather/weather-${kind}.svg`;
}

/**
 * Kenney `input-prompts-pixel-1-bit` tilesheet (CC0), 34×24 tiles of 16px, no gutter — mask source
 * for the instruction-line gesture glyph. One sheet rather than extracted tiles: the Lot 2
 * keyboard/gamepad prompts will draw dozens more glyphes from the same file.
 */
export function getInputPromptSheetUrl(): string {
  return "assets/ui/input-prompts/tilemap-1bit.png";
}

/**
 * Kenney `cursor-pixel-pack` tilesheet (CC0), 20×11 tiles of 16px, no gutter — the drawings the
 * input-prompts sheet lacks: magnifiers, pinch/spread, a rotation pair, and a nicer pointing hand
 * (plan 185, choix humain 2026-08-24).
 *
 * ⚠️ Committed as a MASK variant, not the pack file: the original draws white lines inside a black
 * outline, both fully opaque, so a CSS mask would have turned every icon into a filled blob. The
 * committed sheet keeps the non-black pixels only, painted white — same contract as the
 * input-prompts sheet. See `docs/references/kenney-input-prompts-tileset.md`.
 */
export function getCursorSheetUrl(): string {
  return "assets/ui/cursors/tilemap-1bit.png";
}
