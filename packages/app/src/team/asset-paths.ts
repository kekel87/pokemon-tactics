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
