export function getTypeIconUrl(type: string): string {
  return `assets/ui/types/${type}.png`;
}

export function getCategoryIconUrl(category: string): string {
  return `assets/ui/categories/${category}.png`;
}

export function getWeatherIconUrl(kind: string): string {
  return `/assets/ui/weather/weather-${kind}.png`;
}
