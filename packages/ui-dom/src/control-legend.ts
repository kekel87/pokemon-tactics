import { CHROME_CLEARANCE_PX } from "./chrome-insets.js";
import type { UiDomConfig } from "./config.js";
import { el } from "./dom-helpers.js";

/**
 * Camera control legend, pinned around the compass (plan 185).
 *
 * Nothing on screen announced a single camera shortcut: rotation (`A`/`E`) and zoom (`R`/`F`) had
 * existed since plan 184 and a player who reads no manual would never find them. The compass'
 * ring-arrow mesh said "this is tappable" and nothing more — it is replaced by this legend, which
 * says what the *keys* do too, and lives in the DOM where stacking lines is trivial.
 *
 * Layout (retours humains 2026-08-24):
 *   - the "it clicks" drawing sits to the RIGHT of the compass, vertically centred on it;
 *   - two lines sit UNDER the compass, one per control, each entry reading `[drawing][key]` — one
 *     entry per DIRECTION rather than one shared drawing, and the same order on both lines.
 *
 * Anchored off the timeline's active slot: the compass is pinned to that slot's right edge, at its
 * top, with a side equal to its height (`chrome-insets.ts`). An invisible square of the slot's
 * height (`aspect-ratio: 1`) therefore covers exactly the compass, and everything else hangs off
 * that square — exact by construction, with no pixel measurement mirrored from the renderer and no
 * DOM write per frame. Absolute is not a detail: a static child would change the slot's box, which
 * the compass measures, and the compass would resize because of its own legend.
 *
 * Which device the lines describe is a pure CSS decision (`data-input-source`, with
 * `@media (pointer: coarse)` as the "nothing observed yet" default) — same precedence as the
 * instruction-line glyph.
 */

/**
 * Which sheet a drawing comes from. Two are in play and their geometries differ, so the tile-offset
 * maths has to know: `input-prompts` is 34×24 tiles, `cursors` is 20×11.
 */
const Sheet = {
  /** Kenney `input-prompts-pixel-1-bit`: the mouse and every key cap. */
  Prompts: "cl-sheet-prompts",
  /** Kenney `cursor-pixel-pack`: magnifiers, pinch/spread, the rotation pair, the pointing hand. */
  Cursors: "cl-sheet-cursors",
} as const;
type Sheet = (typeof Sheet)[keyof typeof Sheet];

/**
 * Character → tile, on the input-prompts sheet. That sheet lays its key caps out in PHYSICAL QWERTY
 * order, so this table maps the DRAWN character, never the `code`: on AZERTY the `KeyQ` binding must
 * be drawn with the `A` cap. `key-legend.ts` (app side) turns a position into a character.
 */
const CHARACTER_TILE: Readonly<Record<string, readonly [number, number]>> = {
  ...tileRun("1234567890", 17, 1),
  ...tileRun("QWERTYUIOP", 17, 2),
  ...tileRun("ASDFGHJKL", 18, 3),
  ...tileRun("ZXCVBNM", 19, 4),
};

/** Space bar "small" cap: the stand-in for "press a key" when we cannot name the character. */
const GENERIC_KEY_TILE = [17, 4] as const;

/** One contiguous run of caps: `characters[i]` sits at column `firstColumn + i` of `line`. */
function tileRun(
  characters: string,
  firstColumn: number,
  line: number,
): Record<string, readonly [number, number]> {
  const tiles: Record<string, readonly [number, number]> = {};
  for (const [index, character] of [...characters].entries()) {
    tiles[character] = [firstColumn + index, line];
  }
  return tiles;
}

/**
 * What an entry stands for. Published as `data-cl-role` so the CSS can name the cap it overrides for
 * the gamepad: positional selectors could not — every child of a line is a `<span>`, so
 * `:nth-of-type` counts the drawing too and shifted every gamepad cap by one (caught at self-check,
 * 2026-08-24).
 */
const Role = {
  RotateLeft: "rotate-left",
  RotateRight: "rotate-right",
  ZoomIn: "zoom-in",
  ZoomOut: "zoom-out",
} as const;
type Role = (typeof Role)[keyof typeof Role];

/** A drawing: a masked square whose tile the CSS resolves from its class. */
function glyph(sheet: Sheet, modifier: string): HTMLElement {
  return el("span", `cl-glyph ${sheet} ${modifier}`);
}

/**
 * A key cap. The tile is published as `--cl-cap-col/row`, which the CSS forwards into the mask
 * offset — and which the CSS *overrides* for the gamepad, whose caps (LB/RB/LT/RT) are fixed. The
 * indirection matters: an inline `--cl-col` would beat every stylesheet rule, so the layout-derived
 * value gets its own property name and the CSS decides which one wins.
 */
function keyCap(config: UiDomConfig, code: string): HTMLElement {
  const cap = glyph(Sheet.Prompts, "cl-cap");
  const [column, line] = CHARACTER_TILE[config.getKeyLabel(code)] ?? GENERIC_KEY_TILE;
  cap.style.setProperty("--cl-cap-col", String(column));
  cap.style.setProperty("--cl-cap-row", String(line));
  return cap;
}

/** `[drawing][key]`, in that order on every line (retour humain 2026-08-24: one reading order). */
function entry(config: UiDomConfig, role: Role, drawing: string, code: string): HTMLElement {
  const group = el("span", "cl-entry");
  group.dataset.clRole = role;
  group.append(glyph(Sheet.Cursors, drawing), keyCap(config, code));
  return group;
}

/**
 * A touch entry, same shape as a key entry: `[what it does][how]`. The gesture drawing takes the key
 * cap's place — so the magnifier still says WHICH way the zoom goes, and the hand says the gesture
 * that gets there (retour humain 2026-08-24). `pointer: coarse` only.
 */
function gestureEntry(drawing: string, gesture: string): HTMLElement {
  const group = el("span", "cl-entry cl-entry-gesture");
  group.append(glyph(Sheet.Cursors, drawing), glyph(Sheet.Cursors, gesture));
  return group;
}

export interface ControlLegend {
  element: HTMLElement;
}

export function createControlLegend(config: UiDomConfig): ControlLegend {
  const element = el("div", "cl-root", "control-legend");
  // Decorative: the board is a canvas and screen-reader support is out of scope (décision #752).
  element.setAttribute("aria-hidden", "true");
  element.style.setProperty("--cl-prompt-sheet", `url("${config.getInputPromptSheetUrl()}")`);
  element.style.setProperty("--cl-cursor-sheet", `url("${config.getCursorSheetUrl()}")`);
  // One constant for the gap the renderer leaves beside the timeline and the gaps the legend leaves
  // around the compass: they cannot drift apart.
  element.style.setProperty("--cl-clearance", `${CHROME_CLEARANCE_PX}px`);

  // Invisible stand-in for the compass square: everything positions against it rather than against
  // the slot, so "to its right" and "under it" are each one offset away.
  const compassBox = el("div", "cl-compass-box");

  // "The compass is clickable / tappable" — to its right, vertically centred (retour humain). Both
  // drawings exist; the CSS shows the one matching the active source, and neither on a gamepad.
  const tapHint = el("div", "cl-tap", "control-legend-tap");
  tapHint.append(glyph(Sheet.Prompts, "cl-glyph-mouse"), glyph(Sheet.Cursors, "cl-glyph-hand"));
  compassBox.append(tapHint);

  const rows = el("div", "cl-rows");

  // Rotation: one entry per direction. Hidden on touch — the compass itself turns the view there,
  // and there is no key to press.
  const rotateRow = el("div", "cl-row", "control-legend-rotate");
  rotateRow.append(
    entry(config, Role.RotateLeft, "cl-glyph-rotate-left", "KeyQ"),
    entry(config, Role.RotateRight, "cl-glyph-rotate-right", "KeyE"),
  );

  // Zoom: magnifiers, which carry their own sign — the input-prompts sheet has no magnifier at all,
  // and a `+` KEY CAP would have read as "press the + key", which is not a binding (plan 184). The
  // touch entries keep the SAME magnifiers and swap the key cap for the hand gesture, so the two
  // devices read as one legend rather than two vocabularies.
  const zoomRow = el("div", "cl-row", "control-legend-zoom");
  zoomRow.append(
    entry(config, Role.ZoomIn, "cl-glyph-zoom-in", "KeyR"),
    entry(config, Role.ZoomOut, "cl-glyph-zoom-out", "KeyF"),
    gestureEntry("cl-glyph-zoom-in", "cl-glyph-spread"),
    gestureEntry("cl-glyph-zoom-out", "cl-glyph-pinch"),
  );

  rows.append(rotateRow, zoomRow);
  element.append(compassBox, rows);
  return { element };
}
