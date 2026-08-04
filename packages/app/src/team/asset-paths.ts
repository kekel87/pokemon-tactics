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
