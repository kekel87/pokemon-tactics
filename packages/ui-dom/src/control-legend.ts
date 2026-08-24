import type { ChromeInsetProbe } from "./chrome-insets.js";
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
 * Placed from the SAME measurement as the compass: `chrome-insets.ts` reports the timeline's first
 * portrait (right edge, top, side) and the renderer pins the compass to it — so the legend reads
 * those numbers too and lands exactly beside and under the needle, at any stage size.
 *
 * Two earlier attempts are worth not repeating:
 *   - hanging the legend off the active slot in the DOM (`position: absolute` inside it): the slot
 *     EMPTIES during a move-CT preview (no entry is `isActive` then), its box collapsed to 0×0 and
 *     the legend piled onto the compass;
 *   - reserving that box in CSS with `min-inline-size`: the compass measures the very same box, so
 *     the reserve moved the compass by the ~1px the reconstruction was off.
 *
 * Hence the probe is passed IN, never created here: the measurement has one owner (the host, which
 * also disposes it) and both consumers read it rather than recomputing it.
 *
 * Positions are written only when the measurement changes (`subscribe`), never per frame.
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
 *
 * The names are the keys of `CameraKeyLabels`: the host resolves each control's key from ITS binding
 * table, so no `KeyboardEvent.code` is ever written here — the remapping screen will have a single
 * table to rewrite, and this legend cannot drift from it in silence.
 */
const Role = {
  RotateLeft: "rotateLeft",
  RotateRight: "rotateRight",
  ZoomIn: "zoomIn",
  ZoomOut: "zoomOut",
} as const;
type Role = (typeof Role)[keyof typeof Role];

/**
 * Role → the kebab-case form the DOM uses (`data-cl-role`, `data-testid`). The role itself is
 * camelCase because it doubles as a `CameraKeyLabels` key; the DOM convention is kebab-case, so one
 * conversion beats a second hand-written table that could disagree with the first.
 */
const dashed = (role: Role): string =>
  role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** The drawing each control gets: an entry cannot be paired with the wrong one. */
const ROLE_DRAWING: Readonly<Record<Role, string>> = {
  [Role.RotateLeft]: "cl-glyph-rotate-left",
  [Role.RotateRight]: "cl-glyph-rotate-right",
  [Role.ZoomIn]: "cl-glyph-zoom-in",
  [Role.ZoomOut]: "cl-glyph-zoom-out",
};

/** The touch gesture that takes the key cap's place, on the two zoom entries. */
const ROLE_GESTURE: Readonly<Record<"zoomIn" | "zoomOut", string>> = {
  [Role.ZoomIn]: "cl-glyph-spread",
  [Role.ZoomOut]: "cl-glyph-pinch",
};

/**
 * A drawing: a masked square whose tile the CSS resolves from its class.
 *
 * Every drawing carries a `data-testid`, decorative though it is: the legend has no role and no text
 * for a test to grab, and the e2e rules forbid reaching for a CSS class. The tile itself is readable
 * from the computed custom properties, so a test asserts a VALUE rather than a screenshot.
 */
function glyph(sheet: Sheet, modifier: string, testId: string): HTMLElement {
  return el("span", `cl-glyph ${sheet} ${modifier}`, testId);
}

/**
 * A key cap. The tile is published as `--cl-cap-col/row`, which the CSS forwards into the mask
 * offset — and which the CSS *overrides* for the gamepad, whose caps (LB/RB/LT/RT) are fixed. The
 * indirection matters: an inline `--cl-col` would beat every stylesheet rule, so the layout-derived
 * value gets its own property name and the CSS decides which one wins.
 */
function keyCap(character: string, role: Role): HTMLElement {
  const cap = glyph(Sheet.Prompts, "cl-cap", `legend-cap-${dashed(role)}`);
  const [column, line] = CHARACTER_TILE[character] ?? GENERIC_KEY_TILE;
  cap.style.setProperty("--cl-cap-col", String(column));
  cap.style.setProperty("--cl-cap-row", String(line));
  return cap;
}

/** `[drawing][key]`, in that order on every line (retour humain 2026-08-24: one reading order). */
function entry(role: Role, character: string): HTMLElement {
  const group = el("span", "cl-entry", `legend-${dashed(role)}`);
  group.dataset.clRole = dashed(role);
  group.append(
    glyph(Sheet.Cursors, ROLE_DRAWING[role], `legend-glyph-${dashed(role)}`),
    keyCap(character, role),
  );
  return group;
}

/**
 * A touch entry, same shape as a key entry: `[what it does][how]`. The gesture drawing takes the key
 * cap's place — so the magnifier still says WHICH way the zoom goes, and the hand says the gesture
 * that gets there (retour humain 2026-08-24). `pointer: coarse` only.
 */
function gestureEntry(role: "zoomIn" | "zoomOut"): HTMLElement {
  const group = el("span", "cl-entry cl-entry-gesture", `legend-${dashed(role)}-gesture`);
  group.append(
    glyph(Sheet.Cursors, ROLE_DRAWING[role], `legend-gesture-glyph-${dashed(role)}`),
    glyph(Sheet.Cursors, ROLE_GESTURE[role], `legend-gesture-hand-${dashed(role)}`),
  );
  return group;
}

export function createControlLegend(config: UiDomConfig, insets: ChromeInsetProbe): HTMLElement {
  const element = el("div", "cl-root", "control-legend");
  // Decorative: the board is a canvas and screen-reader support is out of scope (décision #752).
  element.setAttribute("aria-hidden", "true");
  element.style.setProperty("--cl-prompt-sheet", `url("${config.getInputPromptSheetUrl()}")`);
  element.style.setProperty("--cl-cursor-sheet", `url("${config.getCursorSheetUrl()}")`);

  /*
   * The compass' own box, in stage pixels. `rightPx` already includes the clearance the renderer
   * leaves beside the timeline, so it IS the compass' left edge; the needle is square, side =
   * `sizePx`. Hidden until the first measurement lands (the scene mounts before the chrome), so the
   * legend never flashes in a corner.
   */
  element.hidden = true;
  insets.subscribe((cell) => {
    element.hidden = false;
    element.style.setProperty("--cl-compass-left", `${cell.rightPx}px`);
    element.style.setProperty("--cl-compass-top", `${cell.topPx}px`);
    element.style.setProperty("--cl-compass-side", `${cell.sizePx}px`);
  });

  // Invisible stand-in for the compass square: everything positions against it rather than against
  // the stage, so "to its right" and "under it" are each one offset away.
  const compassBox = el("div", "cl-compass-box");

  // "The compass is clickable / tappable" — to its right, vertically centred (retour humain). Both
  // drawings exist; the CSS shows the one matching the active source, and neither on a gamepad.
  const tapHint = el("div", "cl-tap", "control-legend-tap");
  tapHint.append(
    glyph(Sheet.Prompts, "cl-glyph-mouse", "legend-glyph-mouse"),
    glyph(Sheet.Cursors, "cl-glyph-hand", "legend-glyph-hand"),
  );
  compassBox.append(tapHint);

  const rows = el("div", "cl-rows");

  // Rotation: one entry per direction. Hidden on touch — the compass itself turns the view there,
  // and there is no key to press.
  const keys = config.getCameraKeyLabels();
  const rotateRow = el("div", "cl-row cl-row-rotate", "control-legend-rotate");
  rotateRow.append(
    entry(Role.RotateLeft, keys.rotateLeft),
    entry(Role.RotateRight, keys.rotateRight),
  );

  // Zoom: magnifiers, which carry their own sign — the input-prompts sheet has no magnifier at all,
  // and a `+` KEY CAP would have read as "press the + key", which is not a binding (plan 184). The
  // touch entries keep the SAME magnifiers and swap the key cap for the hand gesture, so the two
  // devices read as one legend rather than two vocabularies.
  const zoomRow = el("div", "cl-row cl-row-zoom", "control-legend-zoom");
  zoomRow.append(
    entry(Role.ZoomIn, keys.zoomIn),
    entry(Role.ZoomOut, keys.zoomOut),
    gestureEntry(Role.ZoomIn),
    gestureEntry(Role.ZoomOut),
  );

  rows.append(rotateRow, zoomRow);
  element.append(compassBox, rows);
  return element;
}
