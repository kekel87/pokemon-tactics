/**
 * Held-item icon sheet helper (plan 168) — mirror of `portrait-sheet.ts`.
 *
 * Item icons ship as a single `item-icons.png` grid inside the sprite bundle (one
 * file, not one per item). To keep a simple `getItemIconUrl(id) => string` seam
 * (consumed by `<img src>` in the InfoPanel), this crops an item's 24x24 cell out of
 * the sheet into a cached data URL — so callers stay unchanged.
 *
 * The sheet is decoded once at boot (`prepareItemIconSheet`, behind the splash). Crops
 * are lazy + cached per id. DOM/canvas lives here (app layer), keeping the bundle loader
 * engine-agnostic.
 */

import { getItemIconCell, getItemIconSheetUrl } from "@pokemon-tactic/view-core";

let sheet: HTMLImageElement | null = null;
const iconUrlCache = new Map<string, string>();
/** 1x1 transparent PNG — fallback for items with no icon in the sheet. */
const TRANSPARENT_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

/** Decode the item-icon sheet once at boot (after the sprite bundle is loaded). */
export async function prepareItemIconSheet(): Promise<void> {
  if (sheet) {
    return;
  }
  const image = new Image();
  image.src = getItemIconSheetUrl();
  await image.decode();
  sheet = image;
}

/**
 * URL for `itemId`'s icon — a cached data URL cropped from the sheet. Returns a
 * transparent pixel if the sheet isn't ready or the item has no icon.
 */
export function getItemIconUrl(itemId: string): string {
  const cached = iconUrlCache.get(itemId);
  if (cached) {
    return cached;
  }
  const cell = sheet ? getItemIconCell(itemId) : null;
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
  iconUrlCache.set(itemId, url);
  return url;
}
