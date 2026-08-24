import type { CameraKeyLabels } from "@pokemon-tactic/ui-dom";
import { getLanguage } from "../i18n/index.js";
import { Language } from "../i18n/types.js";
import { KEYBOARD_BINDINGS } from "./keyboard-source.js";
import { LogicalAction } from "./logical-action.js";

/**
 * Which CHARACTER to draw for a bound key position (plan 185).
 *
 * The bindings are by physical position (`KeyboardEvent.code`, plan 184) — one table for AZERTY and
 * QWERTY. But a legend has to draw a *legend*: `KeyQ` is labelled Q on QWERTY and **A** on AZERTY,
 * and showing the wrong one is worse than showing nothing.
 *
 * Two sources, in that order:
 *   1. the Keyboard Map API, which reports the real layout — Chromium only, secure context only,
 *      and it can throw when a permission policy blocks it;
 *   2. otherwise the game's own language, which is the best guess available (FR → AZERTY).
 *
 * Of everything the legend draws, `KeyQ` is the ONLY position whose character differs between the
 * two layouts: `KeyE`, `KeyR`, `KeyF` and the digit row all land on the same character. The whole
 * API dance exists for that one key — and for the layouts (QWERTZ, Dvorak…) where it stops being
 * the only one.
 */

/** Characters the tilesheet can draw (`docs/references/kenney-input-prompts-tileset.md`). */
const DRAWABLE = /^[A-Z0-9]$/;

/**
 * Fallback per language. Covers exactly the positions the legend draws — a position absent from
 * here falls back to the generic key cap, which is the honest answer for "we don't know".
 */
const FALLBACK: Readonly<Record<Language, Readonly<Record<string, string>>>> = {
  [Language.French]: {
    KeyQ: "A",
    KeyE: "E",
    KeyR: "R",
    KeyF: "F",
    Digit1: "1",
    Digit2: "2",
    Digit3: "3",
  },
  [Language.English]: {
    KeyQ: "Q",
    KeyE: "E",
    KeyR: "R",
    KeyF: "F",
    Digit1: "1",
    Digit2: "2",
    Digit3: "3",
  },
};

/** Codes worth asking the layout map about — the ones any legend or prompt can draw. */
const QUERIED_CODES = ["KeyQ", "KeyE", "KeyR", "KeyF", "Digit1", "Digit2", "Digit3"] as const;

/** Layout-reported characters, empty until (and unless) the API answers. */
let resolved: Record<string, string> = {};

/**
 * Keep only what the sheet can draw. The API returns the character the key PRODUCES, which on some
 * layouts is a dead key, a multi-character string, or a letter outside the Latin alphabet (Cyrillic,
 * Greek) — none of which has a tile.
 */
function drawable(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const upper = value.toUpperCase();
  return DRAWABLE.test(upper) ? upper : null;
}

/**
 * Ask the browser for the real layout. Called once at boot; failure is not an error, it is the
 * common case (Firefox and Safari have no `navigator.keyboard` at all).
 */
export async function resolveKeyLabels(): Promise<void> {
  try {
    const keyboard = (
      navigator as Navigator & {
        keyboard?: { getLayoutMap(): Promise<Map<string, string>> };
      }
    ).keyboard;
    if (!keyboard) {
      resolved = {};
      return;
    }
    const layout = await keyboard.getLayoutMap();
    const labels: Record<string, string> = {};
    for (const code of QUERIED_CODES) {
      const character = drawable(layout.get(code));
      if (character !== null) {
        labels[code] = character;
      }
    }
    resolved = labels;
  } catch {
    // `SecurityError` under a permission policy, or an engine that exposes `keyboard` without the
    // method. Either way the language fallback covers it — nothing to report.
    resolved = {};
  }
}

/**
 * Character to draw for a key position. Synchronous on purpose: the legend is built once, and the
 * boot-time resolution has long landed by the time any combat mounts. Returns an empty string for a
 * position nobody mapped, which the caller draws as the generic key cap.
 */
function keyLabel(code: string): string {
  return resolved[code] ?? FALLBACK[getLanguage()][code] ?? "";
}

/**
 * Which physical key each camera control is bound to — read back from the BINDING TABLE, never
 * retyped. The legend would otherwise drift from the bindings in silence, and the remapping screen
 * (plan dédié) is going to rewrite exactly that table.
 */
function boundCode(action: LogicalAction): string | undefined {
  return Object.keys(KEYBOARD_BINDINGS).find((code) => KEYBOARD_BINDINGS[code] === action);
}

/**
 * Characters the control legend draws, one per camera control (plan 185). A control whose binding
 * disappeared resolves to an empty label, which the legend draws as the generic key cap — honest
 * about not knowing rather than showing a stale letter.
 */
export function cameraKeyLabels(): CameraKeyLabels {
  const label = (action: LogicalAction): string => {
    const code = boundCode(action);
    return code === undefined ? "" : keyLabel(code);
  };
  return {
    rotateLeft: label(LogicalAction.RotateCameraLeft),
    rotateRight: label(LogicalAction.RotateCameraRight),
    zoomIn: label(LogicalAction.ZoomIn),
    zoomOut: label(LogicalAction.ZoomOut),
  };
}
