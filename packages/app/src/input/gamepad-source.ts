import { LogicalAction } from "./logical-action.js";

/**
 * Gamepad support (plan 184, étape D).
 *
 * Four things about the Gamepad API shape this module, and none of them are optional:
 *
 * 1. **There are no button events** — only `gamepadconnected`/`disconnected`. State has to be polled
 *    and edges (pressed now, not pressed before) computed by hand, or one press would fire an action
 *    per frame.
 * 2. 🔴 **Chrome mutates the `Gamepad` / `GamepadButton` objects in place** on every frame. Keeping a
 *    reference to last frame's object and comparing `pressed` compares it with itself: edge detection
 *    silently never fires. Only primitive values may be kept — which is what `GamepadPollState.pressed`
 *    holds: a set of button INDICES, never a browser object.
 * 3. **`navigator.getGamepads()` stays empty until the first gamepad gesture** on a focused page (a
 *    W3C anti-fingerprinting requirement), so "a gamepad is connected" cannot be shown before the
 *    player presses something. That suits *last-input-wins* exactly: the source becomes `gamepad` on
 *    the first press, never before.
 * 4. **`mapping === "standard"`** is the only guarantee the button indices mean what we think. ⚠️
 *    Firefox returns an EMPTY string for any controller missing from its internal table, even a
 *    physically standard one (Bugzilla #952773, #1542893), so a real pad can be invisible there —
 *    a known limitation, not something this lot fixes (no remapping screen yet).
 */

/** Standard-mapping button indices (W3C). */
const Button = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LeftBumper: 4,
  RightBumper: 5,
  LeftTrigger: 6,
  RightTrigger: 7,
  DpadUp: 12,
  DpadDown: 13,
  DpadLeft: 14,
  DpadRight: 15,
} as const;

/**
 * Manette de constructeur Nintendo ? (retour humain 2026-08-21, manette Switch Pro)
 *
 * Le *standard mapping* du W3C indexe les boutons par POSITION : index 0 = bouton du bas, index 1 =
 * bouton de droite. Sur une manette Nintendo, le bas porte **B** et la droite **A** — l'inverse de la
 * disposition Xbox sur laquelle la convention « 0 = confirmer » a été bâtie. Le joueur appuie donc sur
 * A et obtient Annuler.
 *
 * On échange les deux paires (0↔1 et 2↔3) quand l'identifiant annonce Nintendo : identifiant plutôt
 * que réglage, parce que ce n'est pas une préférence mais un fait matériel. `057e` est l'identifiant
 * de fabricant Nintendo, présent dans l'`id` exposé par Chrome comme par Firefox.
 */
export function isNintendoLayout(id: string | undefined): boolean {
  if (id === undefined) {
    return false;
  }
  return /057e|nintendo|switch pro|joy-?con|pro controller/i.test(id);
}

/** Paires de boutons échangées sur une disposition Nintendo (bas↔droite, gauche↔haut). */
const NINTENDO_SWAPPED_BUTTONS: Readonly<Record<number, number>> = {
  0: 1,
  1: 0,
  2: 3,
  3: 2,
};

/** Buttons that map straight to an action, with no modifier involved. */
const BUTTON_ACTIONS: Readonly<Record<number, LogicalAction>> = {
  [Button.A]: LogicalAction.Confirm,
  [Button.B]: LogicalAction.Cancel,
  [Button.X]: LogicalAction.CycleTargetNext,
  [Button.LeftBumper]: LogicalAction.RotateCameraLeft,
  [Button.RightBumper]: LogicalAction.RotateCameraRight,
  [Button.LeftTrigger]: LogicalAction.ZoomOut,
  [Button.RightTrigger]: LogicalAction.ZoomIn,
};

/** D-pad → cursor, unless Y is held (then it scrolls the panels — see `SCROLL_BY_CURSOR_ACTION`). */
const DPAD_ACTIONS: Readonly<Record<number, LogicalAction>> = {
  [Button.DpadUp]: LogicalAction.CursorUp,
  [Button.DpadDown]: LogicalAction.CursorDown,
  [Button.DpadLeft]: LogicalAction.CursorLeft,
  [Button.DpadRight]: LogicalAction.CursorRight,
};

const DPAD_INDEXES = [Button.DpadUp, Button.DpadDown, Button.DpadLeft, Button.DpadRight] as const;

/**
 * Y HELD turns a direction into a scroll (décision humaine 2026-08-20): d-pad or stick up/down
 * scrolls the battle log, left/right the CT timeline. A held modifier rather than a toggle — there
 * is no mode to get stuck in.
 */
const SCROLL_BY_CURSOR_ACTION: Readonly<Record<string, LogicalAction>> = {
  [LogicalAction.CursorUp]: LogicalAction.ScrollLogUp,
  [LogicalAction.CursorDown]: LogicalAction.ScrollLogDown,
  [LogicalAction.CursorLeft]: LogicalAction.ScrollTimelineUp,
  [LogicalAction.CursorRight]: LogicalAction.ScrollTimelineDown,
};

/**
 * Circular deadzone — `hypot`, not per-axis. Per-axis clamping lets a diagonal push cross two
 * thresholds and walk the cursor in a staircase.
 */
const STICK_DEADZONE = 0.5;
/** A pressed analog trigger; the same threshold reads the d-pad when it reports as an axis. */
const BUTTON_PRESS_THRESHOLD = 0.5;

/** Analog-stick direction, as one of the four cursor actions, or null inside the deadzone. */
export function stickAction(axisX: number, axisY: number): LogicalAction | null {
  if (Math.hypot(axisX, axisY) < STICK_DEADZONE) {
    return null;
  }
  // The dominant axis wins: a stick is never perfectly cardinal, and the cursor moves one tile at a
  // time — there is no diagonal step to give it.
  if (Math.abs(axisX) > Math.abs(axisY)) {
    return axisX > 0 ? LogicalAction.CursorRight : LogicalAction.CursorLeft;
  }
  return axisY > 0 ? LogicalAction.CursorDown : LogicalAction.CursorUp;
}

/** Minimal shape this module reads off a `Gamepad` — the whole API surface it depends on. */
export interface GamepadSnapshot {
  readonly mapping: string;
  /** Identification string (`Gamepad.id`) — porte le constructeur, cf. `isNintendoLayout`. */
  readonly id?: string;
  readonly buttons: readonly { readonly pressed: boolean; readonly value: number }[];
  readonly axes: readonly number[];
}

export interface GamepadPollState {
  /**
   * Buttons held on the previous frame, as PRIMITIVES (see gotcha 2). A `Set` of indices, never a
   * reference to the browser's own objects.
   */
  pressed: Set<number>;
  /** Frames until the held direction repeats again (initial delay, then a faster cadence). */
  repeatFramesLeft: number;
  /** Direction currently held, so releasing it resets the repeat. */
  repeatAction: LogicalAction | null;
}

export function createGamepadPollState(): GamepadPollState {
  return { pressed: new Set(), repeatFramesLeft: 0, repeatAction: null };
}

/**
 * Frames a held direction waits before it starts repeating, then between repeats. At 60fps: ~380ms
 * then ~90ms — long enough that a single tap never doubles, short enough to cross a board.
 */
const REPEAT_DELAY_FRAMES = 23;
const REPEAT_INTERVAL_FRAMES = 6;

function isPressed(button: { pressed: boolean; value: number } | undefined): boolean {
  if (!button) {
    return false;
  }
  return button.pressed || button.value >= BUTTON_PRESS_THRESHOLD;
}

/**
 * Actions produced by one poll of one gamepad, mutating `state` in place.
 *
 * Pure apart from that mutation, so the whole edge/repeat/deadzone behaviour is unit-testable
 * without a browser — which matters here, because Playwright cannot drive `navigator.getGamepads()`
 * at all: this function IS the test surface for the gamepad.
 */
export function pollGamepad(pad: GamepadSnapshot, state: GamepadPollState): LogicalAction[] {
  // Non-standard mapping: the indices above would be guesses. Such a pad belongs to the future
  // remapping screen, not to a heuristic here.
  if (pad.mapping !== "standard") {
    return [];
  }

  const actions: LogicalAction[] = [];
  const nintendo = isNintendoLayout(pad.id);
  /** Index logique d'un bouton physique : identité, sauf disposition Nintendo (voir plus haut). */
  const logicalIndex = (index: number): number =>
    nintendo ? (NINTENDO_SWAPPED_BUTTONS[index] ?? index) : index;
  const heldModifier = isPressed(pad.buttons[logicalIndex(Button.Y)]);
  const held = new Set<number>();

  // Plain buttons: one action per PRESS, from the edge against last frame's primitives.
  for (let index = 0; index < pad.buttons.length; index++) {
    if (!isPressed(pad.buttons[index])) {
      continue;
    }
    held.add(index);
    const action = BUTTON_ACTIONS[logicalIndex(index)];
    if (action !== undefined && !state.pressed.has(index)) {
      actions.push(action);
    }
  }
  state.pressed = held;

  // Stick DROIT : pan continu. Émis à chaque frame tant qu'il est poussé, sans front ni répétition —
  // un pan est analogique, l'accumulation frame par frame EST le geste.
  const panX = pad.axes[2] ?? 0;
  const panY = pad.axes[3] ?? 0;
  if (Math.hypot(panX, panY) >= STICK_DEADZONE) {
    if (Math.abs(panX) >= STICK_DEADZONE) {
      actions.push(panX > 0 ? LogicalAction.PanCameraRight : LogicalAction.PanCameraLeft);
    }
    if (Math.abs(panY) >= STICK_DEADZONE) {
      actions.push(panY > 0 ? LogicalAction.PanCameraDown : LogicalAction.PanCameraUp);
    }
  }

  // Directions repeat while held (d-pad and stick alike), so crossing a board doesn't take one
  // press per tile. The d-pad wins over the stick when both are pushed.
  const dpadIndex = DPAD_INDEXES.find((index) => isPressed(pad.buttons[index]));
  const direction =
    dpadIndex === undefined
      ? stickAction(pad.axes[0] ?? 0, pad.axes[1] ?? 0)
      : (DPAD_ACTIONS[dpadIndex] ?? null);
  const resolved =
    direction !== null && heldModifier
      ? (SCROLL_BY_CURSOR_ACTION[direction] ?? direction)
      : direction;

  if (resolved === null) {
    state.repeatAction = null;
    state.repeatFramesLeft = 0;
    return actions;
  }
  if (state.repeatAction !== resolved) {
    // First frame of a new direction: act now, then wait out the initial delay.
    actions.push(resolved);
    state.repeatAction = resolved;
    state.repeatFramesLeft = REPEAT_DELAY_FRAMES;
  } else if (state.repeatFramesLeft <= 0) {
    actions.push(resolved);
    state.repeatFramesLeft = REPEAT_INTERVAL_FRAMES;
  } else {
    state.repeatFramesLeft -= 1;
  }
  return actions;
}

export interface GamepadPoller {
  dispose(): void;
}

/**
 * Poll every connected gamepad on each animation frame and emit the resulting actions.
 *
 * The loop only runs while at least one pad is connected: no permanent `requestAnimationFrame` on
 * top of Babylon's own render loop when nobody is playing on a pad.
 */
export function startGamepadPolling(emit: (action: LogicalAction) => void): GamepadPoller {
  const states = new Map<number, GamepadPollState>();
  let frame: number | null = null;

  const poll = (): void => {
    const pads = navigator.getGamepads?.() ?? [];
    let connected = 0;
    for (const pad of pads) {
      if (!pad) {
        continue;
      }
      connected += 1;
      let state = states.get(pad.index);
      if (!state) {
        state = createGamepadPollState();
        states.set(pad.index, state);
      }
      for (const action of pollGamepad(pad, state)) {
        emit(action);
      }
    }
    if (connected === 0) {
      frame = null;
      states.clear();
      return;
    }
    frame = requestAnimationFrame(poll);
  };

  const start = (): void => {
    if (frame === null) {
      frame = requestAnimationFrame(poll);
    }
  };

  // `getGamepads()` is empty until the first gesture (gotcha 3), so the connect event is what tells
  // us to start looking at all.
  window.addEventListener("gamepadconnected", start);

  return {
    dispose: () => {
      window.removeEventListener("gamepadconnected", start);
      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
      states.clear();
    },
  };
}
