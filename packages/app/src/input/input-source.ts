/**
 * Active input source tracker (plan 184) — the *last-input-wins* pattern used by console-style
 * games: the active source is whichever device produced the last deliberate input, not whichever
 * happens to be plugged in. A player with a gamepad connected who is still using the mouse must
 * keep seeing mouse prompts.
 *
 * It drives two things, and nothing else: which gesture glyph the instruction line shows, and
 * whether the DOM chrome may take focus by script after a re-render.
 */
export const InputSource = {
  Pointer: "pointer",
  Touch: "touch",
  Keyboard: "keyboard",
  Gamepad: "gamepad",
} as const;

export type InputSource = (typeof InputSource)[keyof typeof InputSource];

export interface InputSourceTracker {
  current(): InputSource;
  /** A deliberate input happened on this device. */
  note(source: InputSource): void;
  /**
   * A pointer moved. Ignored unless the coordinates actually changed — see the phantom-move note
   * below; that filter is the whole reason this is not just `note("pointer")`.
   */
  notePointerMove(source: InputSource, x: number, y: number): void;
  /** True for the two sources that navigate by focus, so the chrome may focus by script. */
  isFocusDriven(): boolean;
}

/**
 * @param onChange notified only when the active source actually changes (not on every input).
 * @param initial the source assumed before anything has been observed.
 */
export function createInputSourceTracker(
  onChange?: (source: InputSource) => void,
  initial: InputSource = InputSource.Pointer,
): InputSourceTracker {
  let active = initial;
  let lastX: number | null = null;
  let lastY: number | null = null;

  const set = (source: InputSource): void => {
    if (source === active) {
      return;
    }
    active = source;
    onChange?.(source);
  };

  return {
    current: () => active,
    note: set,
    notePointerMove: (source, x, y) => {
      // Chrome fires a `pointermove` with a ZERO delta on `pointerdown` (observed on this very
      // stack — Babylon.js forum). Treating it as a deliberate move would flip the active source
      // back to the pointer right after a keyboard or gamepad input, making the prompt glyphs
      // flicker onto the wrong modality on every press. Compare against the last known position
      // rather than trusting `movementX/movementY`, whose behaviour varies with pointer lock.
      if (x === lastX && y === lastY) {
        return;
      }
      lastX = x;
      lastY = y;
      set(source);
    },
    isFocusDriven: () => active === InputSource.Keyboard || active === InputSource.Gamepad,
  };
}
