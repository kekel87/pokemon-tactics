import { el } from "./dom-helpers.js";

/**
 * Type chip (plan 178) — the ONE way to render an elemental type as a coloured badge.
 * Shared by the InfoPanel (plan 174) and the move tooltip so the two cannot drift; styled by
 * `styles/type-chip.css`, coloured from the `--type-<id>` / `--type-text-<id>` tokens via `data-type`.
 *
 * `label` is already localised by the caller (`getTypeName` from `@pokemon-tactic/data`, the single
 * source for type names) — this stays a pure render helper with no i18n of its own.
 *
 * `iconUrl` stays optional because the URL is host-resolved: a caller without an asset-path resolver
 * (or rendering a type that has no icon) still gets a correct, coloured chip. Both current callers
 * pass one.
 */
export function createTypeChip(
  typeId: string,
  label: string,
  options: { tag?: "li" | "span"; iconUrl?: string } = {},
): HTMLElement {
  const chip = el(options.tag ?? "span", "type-chip");
  chip.dataset.type = typeId;
  if (options.iconUrl !== undefined) {
    const icon = el("img", "type-chip-icon");
    icon.src = options.iconUrl;
    icon.alt = ""; // decorative: the label right next to it names the type
    icon.decoding = "async";
    icon.loading = "lazy";
    chip.append(icon);
  }
  const text = el("span");
  text.textContent = label;
  chip.append(text);
  return chip;
}
