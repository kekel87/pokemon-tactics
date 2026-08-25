import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createGamepadPollState,
  type GamepadSnapshot,
  pollGamepad,
  pollGamepadButtons,
  SCROLL_MODIFIER_BUTTON,
  startGamepadPolling,
  stickAction,
} from "./gamepad-source.js";
import { LogicalAction } from "./logical-action.js";

const BUTTON_COUNT = 17;

function pad(options: {
  pressed?: readonly number[];
  axes?: readonly number[];
  mapping?: string;
  id?: string;
}): GamepadSnapshot {
  const pressed = new Set(options.pressed ?? []);
  return {
    mapping: options.mapping ?? "standard",
    ...(options.id === undefined ? {} : { id: options.id }),
    buttons: Array.from({ length: BUTTON_COUNT }, (_, index) => ({
      pressed: pressed.has(index),
      value: pressed.has(index) ? 1 : 0,
    })),
    axes: options.axes ?? [0, 0, 0, 0],
  };
}

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

describe("stickAction", () => {
  it("ignores anything inside the deadzone", () => {
    expect(stickAction(0, 0)).toBeNull();
    expect(stickAction(0.3, 0.3)).toBeNull();
  });

  it("uses a CIRCULAR deadzone: sensitivity is the same in every direction", () => {
    expect(stickAction(0.35, 0.35)).toBeNull();
    expect(stickAction(0.4, 0.4)).not.toBeNull();
  });

  it("never yields two directions at once (the cursor steps one tile at a time)", () => {
    expect(stickAction(0.9, 0.8)).toBe(LogicalAction.CursorRight);
    expect(stickAction(0.8, 0.9)).toBe(LogicalAction.CursorDown);
  });

  it("maps a clear push to the matching cursor direction", () => {
    expect(stickAction(1, 0)).toBe(LogicalAction.CursorRight);
    expect(stickAction(-1, 0)).toBe(LogicalAction.CursorLeft);
    expect(stickAction(0, -1)).toBe(LogicalAction.CursorUp);
    expect(stickAction(0, 1)).toBe(LogicalAction.CursorDown);
  });
});

describe("pollGamepad", () => {
  it("fires ONE action per press, not one per frame", () => {
    const state = createGamepadPollState();
    const held = pad({ pressed: [Button.A] });

    expect(pollGamepad(held, state)).toEqual([LogicalAction.Confirm]);
    expect(pollGamepad(held, state)).toEqual([]);
    expect(pollGamepad(held, state)).toEqual([]);
  });

  it("fires again after a release (edge detection, not a latch)", () => {
    const state = createGamepadPollState();
    pollGamepad(pad({ pressed: [Button.A] }), state);
    pollGamepad(pad({}), state);

    expect(pollGamepad(pad({ pressed: [Button.A] }), state)).toEqual([LogicalAction.Confirm]);
  });

  it("keeps only PRIMITIVES between frames, so a mutated pad object still edges correctly", () => {
    const state = createGamepadPollState();
    const mutating = {
      mapping: "standard",
      buttons: Array.from({ length: BUTTON_COUNT }, () => ({ pressed: false, value: 0 })),
      axes: [0, 0, 0, 0],
    };

    const press = (index: number, down: boolean): void => {
      const button = mutating.buttons[index];
      if (button) {
        button.pressed = down;
        button.value = down ? 1 : 0;
      }
    };

    press(Button.A, true);
    expect(pollGamepad(mutating, state)).toEqual([LogicalAction.Confirm]);
    expect(pollGamepad(mutating, state)).toEqual([]);
    press(Button.A, false);
    pollGamepad(mutating, state);
    press(Button.A, true);
    expect(pollGamepad(mutating, state)).toEqual([LogicalAction.Confirm]);
  });

  it("maps the standard buttons to their actions", () => {
    const press = (index: number): LogicalAction[] =>
      pollGamepad(pad({ pressed: [index] }), createGamepadPollState());

    expect(press(Button.A)).toEqual([LogicalAction.Confirm]);
    expect(press(Button.B)).toEqual([LogicalAction.Cancel]);
    expect(press(Button.X)).toEqual([LogicalAction.CycleTargetNext]);
    expect(press(Button.LeftBumper)).toEqual([LogicalAction.RotateCameraLeft]);
    expect(press(Button.RightBumper)).toEqual([LogicalAction.RotateCameraRight]);
    expect(press(Button.LeftTrigger)).toEqual([LogicalAction.ZoomOut]);
    expect(press(Button.RightTrigger)).toEqual([LogicalAction.ZoomIn]);
  });

  it("échange A/B et X/Y sur une disposition Nintendo", () => {
    const nintendo = { id: "Pro Controller (Vendor: 057e Product: 2009)" };
    const press = (index: number): LogicalAction[] =>
      pollGamepad(pad({ pressed: [index], ...nintendo }), createGamepadPollState());

    expect(press(0)).toEqual([LogicalAction.Cancel]);
    expect(press(1)).toEqual([LogicalAction.Confirm]);
    expect(press(3)).toEqual([LogicalAction.CycleTargetNext]);
  });

  it("laisse le modificateur de défilement hors de l'échange Nintendo", () => {
    const state = createGamepadPollState();
    const held = pad({
      pressed: [SCROLL_MODIFIER_BUTTON, 13],
      id: "Nintendo Switch Pro Controller",
    });

    expect(pollGamepad(held, state)).toEqual([LogicalAction.ScrollLogDown]);
  });

  it("ne touche à rien quand l'identifiant n'annonce pas Nintendo", () => {
    expect(
      pollGamepad(pad({ pressed: [0], id: "Xbox Wireless Controller" }), createGamepadPollState()),
    ).toEqual([LogicalAction.Confirm]);
  });

  it("le modificateur de défilement n a pas d action propre", () => {
    const state = createGamepadPollState();
    expect(pollGamepad(pad({ pressed: [SCROLL_MODIFIER_BUTTON] }), state)).toEqual([]);
  });

  it("moves the cursor with the d-pad", () => {
    const state = createGamepadPollState();
    expect(pollGamepad(pad({ pressed: [Button.DpadUp] }), state)).toEqual([LogicalAction.CursorUp]);
  });

  it("repeats a HELD direction after an initial delay, and only then", () => {
    const state = createGamepadPollState();
    const held = pad({ pressed: [Button.DpadRight] });

    expect(pollGamepad(held, state)).toEqual([LogicalAction.CursorRight]);
    let repeats = 0;
    for (let frame = 0; frame < 23; frame++) {
      repeats += pollGamepad(held, state).length;
    }
    expect(repeats).toBe(0);

    expect(pollGamepad(held, state)).toEqual([LogicalAction.CursorRight]);
  });

  it("resets the repeat when the direction is released", () => {
    const state = createGamepadPollState();
    pollGamepad(pad({ pressed: [Button.DpadRight] }), state);
    pollGamepad(pad({}), state);

    expect(pollGamepad(pad({ pressed: [Button.DpadRight] }), state)).toEqual([
      LogicalAction.CursorRight,
    ]);
  });

  it("re-arms immediately when the direction CHANGES while held", () => {
    const state = createGamepadPollState();
    pollGamepad(pad({ pressed: [Button.DpadRight] }), state);

    expect(pollGamepad(pad({ pressed: [Button.DpadUp] }), state)).toEqual([LogicalAction.CursorUp]);
  });

  it("transforme une direction en défilement tant que le modificateur est maintenu", () => {
    const state = createGamepadPollState();

    expect(pollGamepad(pad({ pressed: [SCROLL_MODIFIER_BUTTON, Button.DpadDown] }), state)).toEqual(
      [LogicalAction.ScrollLogDown],
    );
    pollGamepad(pad({}), state);
    expect(pollGamepad(pad({ pressed: [SCROLL_MODIFIER_BUTTON, Button.DpadLeft] }), state)).toEqual(
      [LogicalAction.ScrollTimelineUp],
    );
    pollGamepad(pad({}), state);
    expect(
      pollGamepad(pad({ pressed: [SCROLL_MODIFIER_BUTTON], axes: [0, 1, 0, 0] }), state),
    ).toEqual([LogicalAction.ScrollLogDown]);
  });

  it("pans continuously with the RIGHT stick, without edge detection", () => {
    const state = createGamepadPollState();
    const pushed = pad({ axes: [0, 0, 1, -1] });

    expect(pollGamepad(pushed, state)).toEqual([
      LogicalAction.PanCameraRight,
      LogicalAction.PanCameraUp,
    ]);
    expect(pollGamepad(pushed, state)).toEqual([
      LogicalAction.PanCameraRight,
      LogicalAction.PanCameraUp,
    ]);
  });

  it("ignores the right stick inside the deadzone", () => {
    const state = createGamepadPollState();
    expect(pollGamepad(pad({ axes: [0, 0, 0.2, 0.2] }), state)).toEqual([]);
  });

  it("lets the d-pad win over the stick when both are pushed", () => {
    const state = createGamepadPollState();
    const both = pad({ pressed: [Button.DpadUp], axes: [1, 0, 0, 0] });

    expect(pollGamepad(both, state)).toEqual([LogicalAction.CursorUp]);
  });

  it("reports a button press and a direction in the same frame", () => {
    const state = createGamepadPollState();
    const actions = pollGamepad(pad({ pressed: [Button.A, Button.DpadUp] }), state);

    expect(actions).toEqual([LogicalAction.Confirm, LogicalAction.CursorUp]);
  });
});

describe("capture et pads non standard (plan 186)", () => {
  it("lit les boutons bruts quel que soit le `mapping` — c'est le seul moyen de configurer un pad que Firefox ne reconnaît pas", () => {
    const state = createGamepadPollState();
    expect(pollGamepadButtons(pad({ pressed: [Button.X], mapping: "" }), state)).toEqual([
      Button.X,
    ]);
  });

  it("ne rend un bouton qu'au front, pas à chaque frame", () => {
    const state = createGamepadPollState();
    const held = pad({ pressed: [Button.A] });
    expect(pollGamepadButtons(held, state)).toEqual([Button.A]);
    expect(pollGamepadButtons(held, state)).toEqual([]);
  });

  it("applique l'échange Nintendo à la capture : le bouton du BAS s'enregistre comme le bouton du bas", () => {
    const state = createGamepadPollState();
    const captured = pollGamepadButtons(
      pad({ pressed: [Button.B], id: "057e-2009-Pro Controller" }),
      state,
    );
    expect(captured).toEqual([Button.A]);
  });

  it("route un pad au `mapping` vide, celui que Firefox renvoie pour une manette pourtant standard", () => {
    const buttonActions = new Map([[Button.A, LogicalAction.Confirm]]);

    expect(
      pollGamepad(pad({ pressed: [Button.A], mapping: "" }), createGamepadPollState(), {
        buttonActions,
      }),
    ).toEqual([LogicalAction.Confirm]);
  });
});

describe("cycle de vie du poller (plan 186)", () => {
  function stubEnvironment(pads: (GamepadSnapshot | null)[]): {
    listeners: Map<string, () => void>;
    runFrames: (count: number) => void;
  } {
    const listeners = new Map<string, () => void>();
    const pending: (() => void)[] = [];
    vi.stubGlobal("window", {
      addEventListener: (type: string, handler: () => void) => listeners.set(type, handler),
      removeEventListener: (type: string) => listeners.delete(type),
    });
    vi.stubGlobal("navigator", { getGamepads: () => pads });
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) => {
      pending.push(callback);
      return pending.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    return {
      listeners,
      runFrames: (count) => {
        for (let index = 0; index < count; index++) {
          pending.shift()?.();
        }
      },
    };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("survit à une connexion annoncée avant que le pad ne soit publié", () => {
    const pads: (GamepadSnapshot | null)[] = [null];
    const emitted: LogicalAction[] = [];
    const { listeners, runFrames } = stubEnvironment(pads);

    const poller = startGamepadPolling((action) => emitted.push(action));
    listeners.get("gamepadconnected")?.();
    runFrames(3);

    pads[0] = pad({ pressed: [Button.A] });
    runFrames(1);

    expect(emitted).toEqual([LogicalAction.Confirm]);
    poller.dispose();
  });

  it("rattrape un pad déjà publié dont l'événement de connexion a été manqué", () => {
    const emitted: LogicalAction[] = [];
    const { runFrames } = stubEnvironment([pad({ pressed: [Button.A] })]);

    const poller = startGamepadPolling((action) => emitted.push(action));
    runFrames(1);

    expect(emitted).toEqual([LogicalAction.Confirm]);
    poller.dispose();
  });

  it("finit par rendre la main quand aucune manette ne répond", () => {
    const emitted: LogicalAction[] = [];
    const { listeners, runFrames } = stubEnvironment([null]);

    const poller = startGamepadPolling((action) => emitted.push(action));
    listeners.get("gamepadconnected")?.();
    runFrames(400);

    expect(emitted).toEqual([]);
    poller.dispose();
  });
});
