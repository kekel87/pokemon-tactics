import type { InputContext } from "@pokemon-tactic/view-core";
import { startGamepadPolling } from "./gamepad-source.js";
import {
  type BoardInputConsumer,
  createInputRouter,
  type MenuInputConsumer,
} from "./input-router.js";
import { createInputSourceTracker, InputSource, type InputSourceTracker } from "./input-source.js";
import { isClaimedByFocusedControl, resolveKeyboardAction } from "./keyboard-source.js";
import type { LogicalAction } from "./logical-action.js";

/**
 * What the active screen offers the input layer. A screen (or the combat flow) registers one of
 * these while it is mounted, and unregisters on teardown.
 */
export interface InputRegistration {
  context: () => InputContext | "screen";
  board?: BoardInputConsumer;
  menu?: MenuInputConsumer;
}

export interface InputSystem {
  /** Which device the player last used — drives prompt glyphs and script-driven focus. */
  readonly tracker: InputSourceTracker;
  /** Register the active consumers; returns the unregister to call on teardown. */
  register(registration: InputRegistration): () => void;
  /** Feed one action from a non-keyboard producer (gamepad, pointer gestures). */
  emit(action: LogicalAction, source: InputSource): boolean;
  dispose(): void;
}

/**
 * The single keyboard listener of the app (plan 184).
 *
 * It replaces five scattered `window.addEventListener("keydown")` that each tested `event.key` and
 * guessed whether they were concerned. Registrations form a stack — screens are mounted one at a
 * time, so the top of the stack is the active one — which is what makes "one consumer per (context,
 * action)" structural rather than a matter of listener order.
 */
export function createInputSystem(root: HTMLElement | null): InputSystem {
  const stack: InputRegistration[] = [];
  const active = (): InputRegistration | null => stack.at(-1) ?? null;

  const tracker = createInputSourceTracker((source) => {
    // Published on the DOM so the CSS can pick the matching prompt glyph with no re-render.
    root?.setAttribute("data-input-source", source);
  });

  const router = createInputRouter({
    context: () => active()?.context() ?? "screen",
    board: () => active()?.board ?? null,
    menu: () => active()?.menu ?? null,
  });

  const onKeyDown = (event: KeyboardEvent): void => {
    const action = resolveKeyboardAction(event);
    if (action === null) {
      return;
    }
    // The focused control owns this key (a text field owns them all, a `<select>` owns ↑ ↓, a slider
    // owns ← →): leave it to the browser, but only for the keys it really uses — treating every field
    // as "the player is typing" used to trap the focus inside it.
    if (isClaimedByFocusedControl(event.target, action)) {
      return;
    }
    tracker.note(InputSource.Keyboard);
    if (router.handle(action)) {
      // Only for an action a consumer actually took: preventing the default of an unconsumed Space
      // or Enter would swallow the browser's own activation of a focused button.
      event.preventDefault();
    }
  };

  window.addEventListener("keydown", onKeyDown);

  // The gamepad has no button events at all: the poller watches it in a `requestAnimationFrame`
  // loop, started by the first `gamepadconnected` and stopped once no pad is left.
  const gamepad = startGamepadPolling((action) => {
    tracker.note(InputSource.Gamepad);
    router.handle(action);
  });

  return {
    tracker,
    register(registration) {
      stack.push(registration);
      return () => {
        const index = stack.lastIndexOf(registration);
        if (index !== -1) {
          stack.splice(index, 1);
        }
      };
    },
    emit(action, source) {
      tracker.note(source);
      return router.handle(action);
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      gamepad.dispose();
      stack.length = 0;
    },
  };
}

let current: InputSystem | null = null;

/** Boot entry — called once, next to `initSettings()`. */
export function initInputSystem(root: HTMLElement | null): InputSystem {
  current?.dispose();
  current = createInputSystem(root);
  return current;
}

/**
 * The app-wide input system. Screens and the combat flow reach it through this rather than
 * threading it through every constructor — same shape as `getSettings()`.
 */
export function getInputSystem(): InputSystem | null {
  return current;
}
