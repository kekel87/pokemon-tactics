/**
 * Portrait sheet helper (plan 135). Portraits ship as a single `portraits.png` grid
 * inside the sprite bundle (one file, not one per Pokemon). To keep the existing
 * `getPortraitUrl(id) => string` seam (consumed by `<img src>` in the InfoPanel AND by
 * `background-image: url(...)` divs in the Team Builder), this crops a Pokemon's 40x40
 * cell out of the sheet into a cached data URL — so callers stay unchanged.
 *
 * The sheet is decoded once at boot (`preparePortraitSheet`, behind the splash). Crops
 * are lazy + cached per id. DOM/canvas lives here (app layer), keeping the bundle loader
 * engine-agnostic.
 */

import { getPortraitCell, getPortraitSheetUrl } from "@pokemon-tactic/view-core";

let sheet: HTMLImageElement | null = null;
const portraitUrlCache = new Map<string, string>();
/** 1x1 transparent PNG — fallback for Pokemon with no portrait in the sheet. */
const TRANSPARENT_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

/** Decode the portrait sheet once at boot (after the sprite bundle is loaded). */
export async function preparePortraitSheet(): Promise<void> {
  if (sheet) {
    return;
  }
  const image = new Image();
  image.src = getPortraitSheetUrl();
  await image.decode();
  sheet = image;
}

/**
 * URL for `id`'s portrait — a cached data URL cropped from the sheet. Returns a
 * transparent pixel if the sheet isn't ready or the Pokemon has no portrait.
 */
export function getPortraitUrl(pokemonId: string): string {
  const cached = portraitUrlCache.get(pokemonId);
  if (cached) {
    return cached;
  }
  const cell = sheet ? getPortraitCell(pokemonId) : null;
  if (!(sheet && cell)) {
    return TRANSPARENT_PIXEL;
  }
  const canvas = document.createElement("canvas");
  canvas.width = cell.cell;
  canvas.height = cell.cell;
  const context = canvas.getContext("2d");
  if (!context) {
    return TRANSPARENT_PIXEL;
  }
  context.drawImage(
    sheet,
    cell.col * cell.cell,
    cell.row * cell.cell,
    cell.cell,
    cell.cell,
    0,
    0,
    cell.cell,
    cell.cell,
  );
  const url = canvas.toDataURL("image/png");
  portraitUrlCache.set(pokemonId, url);
  return url;
}
