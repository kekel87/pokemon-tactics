import { LogicalAction } from "./logical-action.js";

/**
 * Keyboard bindings, by PHYSICAL KEY POSITION (plan 184).
 *
 * The table is keyed on `KeyboardEvent.code`, not `.key`: `code` names the physical key and ignores
 * the layout, the locale and the modifiers. The names read as QWERTY legends but designate
 * positions, so ONE table serves both layouts — `KeyW/KeyA/KeyS/KeyD` is ZQSD on AZERTY and WASD on
 * QWERTY, `KeyQ`/`KeyE` is A/E on AZERTY and Q/E on QWERTY.
 *
 * The digits are the clearest illustration of why: on AZERTY the top row only yields digits with
 * Shift (a bare press gives `& é " '`), so `event.key === "1"` would demand `Maj+&` while
 * `code === "Digit1"` is the bare press in both layouts.
 *
 * ⚠️ `+` / `−` were deliberately NOT used for zoom: the `Minus` position carries `)` on AZERTY, so
 * binding it by position would mean "zoom with the closing parenthesis". Reading those two by
 * character would have worked, but for one pair of bindings it would have introduced a second way
 * of reading a key. Hence: the whole table is `code`, without exception, and no `key` path exists.
 *
 * The general rule, for a future binding: position for movement and actions, character for a
 * symbol key whose *meaning* is the symbol.
 */
export const KEYBOARD_BINDINGS: Readonly<Record<string, LogicalAction>> = {
  // Cursor / focus — arrows and the movement pad, both.
  ArrowUp: LogicalAction.CursorUp,
  ArrowDown: LogicalAction.CursorDown,
  ArrowLeft: LogicalAction.CursorLeft,
  ArrowRight: LogicalAction.CursorRight,
  KeyW: LogicalAction.CursorUp,
  KeyA: LogicalAction.CursorLeft,
  KeyS: LogicalAction.CursorDown,
  KeyD: LogicalAction.CursorRight,

  // Actions.
  Space: LogicalAction.Confirm,
  Enter: LogicalAction.Confirm,
  NumpadEnter: LogicalAction.Confirm,
  Escape: LogicalAction.Cancel,

  // Camera — one quarter turn each way (4 iso azimuths).
  KeyQ: LogicalAction.RotateCameraLeft,
  KeyE: LogicalAction.RotateCameraRight,

  // Zoom: 3 notches, so 3 absolute keys, plus a relative pair.
  Digit1: LogicalAction.ZoomLevel1,
  Digit2: LogicalAction.ZoomLevel2,
  Digit3: LogicalAction.ZoomLevel3,
  Numpad1: LogicalAction.ZoomLevel1,
  Numpad2: LogicalAction.ZoomLevel2,
  Numpad3: LogicalAction.ZoomLevel3,
  KeyR: LogicalAction.ZoomIn,
  KeyF: LogicalAction.ZoomOut,
};

/**
 * Bindings that need a modifier to disambiguate. Kept apart from the flat table so the table stays
 * a plain `Record<code, action>` — the shape the future remapping screen will rewrite.
 */
const SHIFTED_BINDINGS: Readonly<Record<string, LogicalAction>> = {
  Tab: LogicalAction.CycleTargetPrevious,
  PageUp: LogicalAction.ScrollTimelineUp,
  PageDown: LogicalAction.ScrollTimelineDown,
};

const UNSHIFTED_BINDINGS: Readonly<Record<string, LogicalAction>> = {
  Tab: LogicalAction.CycleTargetNext,
  PageUp: LogicalAction.ScrollLogUp,
  PageDown: LogicalAction.ScrollLogDown,
};

/** What this event means, or null when the key is not bound. */
export function resolveKeyboardAction(event: {
  code: string;
  shiftKey: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}): LogicalAction | null {
  // Ctrl / Alt / Meta belong to the browser and the OS (Ctrl+R reloads, Alt+Tab switches app):
  // the game binds none of them, and stealing one would break a shortcut the player relies on.
  if (event.ctrlKey === true || event.altKey === true || event.metaKey === true) {
    return null;
  }
  const modified = event.shiftKey ? SHIFTED_BINDINGS[event.code] : UNSHIFTED_BINDINGS[event.code];
  if (modified !== undefined) {
    return modified;
  }
  // Shift on anything else is not a binding of ours either — only the three keys above pair with it.
  if (event.shiftKey) {
    return null;
  }
  return KEYBOARD_BINDINGS[event.code] ?? null;
}

/**
 * Does the FOCUSED control legitimately own this key press? (plan 184, retour humain 2026-08-21)
 *
 * The first rule was "any field means the player is typing, stay out of the way", which trapped the
 * focus: a checkbox does nothing with the arrows, so nothing happened at all and only `Tab` could
 * leave it — and a gamepad has no `Tab`.
 *
 * The rule that works: **a control keeps the axis it actually uses, the layer takes the other.**
 *   - a text field uses everything → the layer stays out entirely (the arrows move the caret);
 *   - a `<select>` uses the VERTICAL axis (its options are a column) → ← → still move the focus out;
 *   - a slider uses the HORIZONTAL axis → ↑ ↓ move the focus out;
 *   - a checkbox or a radio use neither → the arrows move the focus, Space toggles natively.
 * There is therefore always a way out of a control without reaching for `Tab`.
 */
export function isClaimedByFocusedControl(
  target: EventTarget | null,
  action: LogicalAction,
): boolean {
  // Duck-typed rather than `instanceof HTMLElement`: the unit suite runs on the node environment
  // (no DOM globals), where `instanceof` against `HTMLElement` throws outright.
  const element = target as {
    tagName?: unknown;
    type?: unknown;
    isContentEditable?: unknown;
  } | null;
  if (element === null || typeof element.tagName !== "string") {
    return false;
  }
  const horizontal = action === LogicalAction.CursorLeft || action === LogicalAction.CursorRight;

  if (element.isContentEditable === true) {
    return true;
  }
  const tag = element.tagName.toUpperCase();
  if (tag === "TEXTAREA") {
    return true;
  }
  if (tag === "SELECT") {
    // Only the key that OPENS it. Once open, the native popup receives the arrows directly and the
    // page never sees them, so choosing an option still works — while a closed select stays a
    // navigable stop like any other.
    return action === LogicalAction.Confirm;
  }
  if (tag === "INPUT") {
    const type = typeof element.type === "string" ? element.type.toLowerCase() : "text";
    if (type === "range") {
      return horizontal;
    }
    // Toggles and buttons: the browser only wants Space/Enter, which it gets because the layer
    // reports Confirm as unconsumed when the focus is not on a menu button.
    if (
      type === "checkbox" ||
      type === "radio" ||
      type === "button" ||
      type === "submit" ||
      type === "reset" ||
      type === "color" ||
      type === "file"
    ) {
      return false;
    }
    // Anything else is text-like (text, search, number, date…): it owns the whole keyboard.
    return true;
  }
  return false;
}
