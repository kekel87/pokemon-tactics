/**
 * TileInfoPanel (plan 177) — a second, narrower chrome panel sitting to the right of the Pokémon
 * InfoPanel. Reads the terrain + active modifiers of the tile under the cursor (or the active
 * Pokémon's tile). Pure view component: takes a `TileInfoData` view-model (labels already localised
 * by the view-core builder) and renders it — no `@pokemon-tactic/core` dependency.
 */

import type { TileInfoData } from "@pokemon-tactic/render-ports";
import { el } from "./dom-helpers.js";

// View-model types live in the renderer contract package; re-exported for callers.
export type { TileInfoChip, TileInfoData, TileInfoTone } from "@pokemon-tactic/render-ports";

export interface TileInfoPanel {
  readonly element: HTMLElement;
  update(data: TileInfoData): void;
  show(): void;
  hide(): void;
  destroy(): void;
}

export function createTileInfoPanel(): TileInfoPanel {
  const panel = el("div", "ti-panel", "tile-info-panel");
  panel.hidden = true;

  // Header: terrain name + altitude on the same line, left-aligned (human 2026-07-25).
  const header = el("div", "ti-header");
  const terrainEl = el("span", "ti-terrain", "tile-info-terrain");
  const heightEl = el("span", "ti-height");
  const heightGlyph = el("span", "ti-height-glyph");
  heightGlyph.textContent = "⛰"; // emoji placeholder — real icon at the icon-pack point.
  heightGlyph.setAttribute("aria-hidden", "true");
  const heightNum = el("span", "ti-height-num");
  heightEl.append(heightGlyph, heightNum);
  header.append(terrainEl, heightEl);
  const lines = el("ul", "ti-lines");
  panel.append(header, lines);

  function update(data: TileInfoData): void {
    terrainEl.textContent = data.terrainLabel;
    heightNum.textContent = String(data.height);
    lines.replaceChildren(
      ...data.lines.map((row) => {
        const item = el("li", "ti-line");
        for (const chip of row) {
          const chipEl = el("span", "ti-chip");
          if (chip.tone) {
            chipEl.dataset.tone = chip.tone;
          }
          if (chip.title) {
            chipEl.title = chip.title;
            chipEl.setAttribute("aria-label", chip.title);
          }
          // Leading slot: a duration badge (field/zone) replaces the emoji glyph; otherwise the glyph.
          if (chip.duration !== undefined) {
            const badge = el("span", "ti-duration");
            badge.textContent = String(chip.duration);
            chipEl.append(badge);
          } else if (chip.emoji) {
            const glyph = el("span", "ti-glyph");
            glyph.textContent = chip.emoji;
            glyph.setAttribute("aria-hidden", "true");
            chipEl.append(glyph);
          }
          for (const url of chip.iconUrls ?? []) {
            const icon = el("img", "ti-icon-img");
            icon.src = url;
            icon.alt = "";
            icon.decoding = "async";
            icon.loading = "lazy";
            chipEl.append(icon);
          }
          if (chip.text) {
            const text = el("span", chip.small ? "ti-text ti-text-small" : "ti-text");
            text.textContent = chip.text;
            chipEl.append(text);
          }
          item.append(chipEl);
        }
        return item;
      }),
    );
    panel.hidden = false;
  }

  return {
    element: panel,
    update,
    show: () => {
      panel.hidden = false;
    },
    hide: () => {
      panel.hidden = true;
    },
    destroy: () => {
      panel.remove();
    },
  };
}
