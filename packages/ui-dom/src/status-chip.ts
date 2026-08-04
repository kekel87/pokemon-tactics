import { el } from "./dom-helpers.js";

/**
 * Status chip (plan 178) — the ONE way to render a major status as a badge, mirroring
 * `createTypeChip`. Draws the `label-<status>.png` art (name + colour baked in) rather than the bare
 * `icon-<status>.png` glyph, so the player reads the status instead of decoding a pictogram.
 *
 * `labelUrl` is resolved by the host (`getStatusLabelUrl`); `text` is an optional trailing figure
 * such as a probability. `alt` carries the localised status name for screen readers, since the name
 * itself lives inside the image.
 */
export function createStatusChip(labelUrl: string, alt: string, text?: string): HTMLElement {
  const chip = el("span", "status-chip");
  // Figure FIRST, then the status art (human 2026-08-03): reads as "10 % BRÛLÉ", the probability
  // qualifying the status, rather than a badge trailed by a loose number.
  if (text !== undefined) {
    const value = el("span");
    value.textContent = text;
    chip.append(value);
  }
  const label = el("img", "status-chip-label");
  label.src = labelUrl;
  label.alt = alt;
  label.decoding = "async";
  label.loading = "lazy";
  chip.append(label);
  return chip;
}
