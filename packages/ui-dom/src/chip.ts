import type { TileInfoChip } from "@pokemon-tactic/render-ports";
import { el } from "./dom-helpers.js";
import { createStatusChip } from "./status-chip.js";

/**
 * The ONE renderer for a `TileInfoChip` (plan 178). Every field of the view-model is handled here, so
 * a chip looks the same wherever it is shown: tile-info panel, InfoPanel, combat forecast, move
 * tooltip.
 *
 * Why it exists: the InfoPanel and the move tooltip each had their own partial renderer. The panel's
 * ignored `statusLabelUrl` (so the forecast lost the status art the moment `buildSecondaryEffectChip`
 * started emitting it) and the tooltip's ignored `tone` and `emoji` (so a stat-drop chip lost its
 * red/green). Sharing the BUILDER was not enough — the renderers have to agree too.
 *
 * `classPrefix` lets a host keep its own metrics (`ip-chip*` in the panel, `mt-chip*` in the
 * tooltip) while the structure and the field coverage stay identical.
 */
export function createChip(chip: TileInfoChip, classPrefix: string): HTMLElement {
  // A status with dedicated `label-*` art is a chip in its own right: the art carries the name and
  // the colour, so it replaces the glyph/icon/text assembly below.
  if (chip.statusLabelUrl !== undefined) {
    const node = createStatusChip(chip.statusLabelUrl, chip.statusLabelAlt ?? "", chip.text);
    if (chip.tone) {
      node.dataset.tone = chip.tone;
    }
    if (chip.title) {
      node.title = chip.title;
      node.setAttribute("aria-label", chip.title);
    }
    return node;
  }

  const node = el("span", `${classPrefix}-chip`);
  if (chip.tone) {
    node.dataset.tone = chip.tone;
  }
  if (chip.title) {
    node.title = chip.title;
    node.setAttribute("aria-label", chip.title);
  }
  if (chip.duration !== undefined) {
    const badge = el("span", `${classPrefix}-chip-duration`);
    badge.textContent = String(chip.duration);
    node.append(badge);
  } else if (chip.emoji) {
    const glyph = el("span", `${classPrefix}-chip-glyph`);
    glyph.textContent = chip.emoji;
    glyph.setAttribute("aria-hidden", "true");
    node.append(glyph);
  }
  for (const url of chip.iconUrls ?? []) {
    const icon = el("img", `${classPrefix}-chip-icon`);
    icon.src = url;
    icon.alt = "";
    icon.decoding = "async";
    icon.loading = "lazy";
    node.append(icon);
  }
  if (chip.text) {
    const text = el("span", `${classPrefix}-chip-text`);
    text.textContent = chip.text;
    node.append(text);
  }
  return node;
}
