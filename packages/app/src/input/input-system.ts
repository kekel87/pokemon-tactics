import type { InputContext } from "@pokemon-tactic/view-core";
import type { CapturedInput } from "./bindings-store.js";
import { applyToFocusedControl } from "./focus-navigation.js";
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
  /**
   * Lit la PROCHAINE entrée brute au lieu de la router (écran de contrôles, plan 186).
   *
   * Le récepteur reçoit `null` quand la capture a été annulée — par `Échap`, par B, ou par le bouton
   * « Annuler » de l'écran via la fonction retournée. Une seule capture à la fois : en ouvrir une
   * seconde annule la première, plutôt que d'empiler deux écrans en attente de la même frappe.
   */
  beginCapture(sink: (captured: CapturedInput | null) => void): () => void;
  /** Register the active consumers; returns the unregister to call on teardown. */
  register(registration: InputRegistration): () => void;
  /** Feed one action from a non-keyboard producer (gamepad, pointer gestures). */
  emit(action: LogicalAction, source: InputSource): boolean;
  dispose(): void;
}

/** Index logique du bouton B — l'annulation de capture à la manette (plan 186, décision 8). */
const CAPTURE_CANCEL_BUTTON = 1;

/**
 * The single keyboard listener of the app (plan 184).
 *
 * It replaces five scattered `window.addEventListener("keydown")` that each tested `event.key` and
 * guessed whether they were concerned. Registrations form a stack — screens are mounted one at a
 * time, so the top of the stack is the active one — which is what makes "one consumer per (context,
 * action)" structural rather than a matter of listener order.
 */
export function createInputSystem(): InputSystem {
  const stack: InputRegistration[] = [];
  const active = (): InputRegistration | null => stack.at(-1) ?? null;

  const tracker = createInputSourceTracker((source) => {
    // Publié sur `<html>` et non sur `#game-root` (plan 188, retour humain 2026-08-25) : la règle
    // d'anneau de focus est `[data-input-source="gamepad"] :focus`, et un `<dialog>` ouvert par
    // `showModal()` vit sur `<body>` — donc HORS de `#game-root`. Le focus se déplaçait bien dans une
    // modale à la manette, mais rien ne le dessinait : « la dialog n'est pas navigable à la manette »,
    // alors qu'elle l'était et qu'on ne le voyait pas. La racine du document couvre les deux arbres.
    // Optionnel plutôt que garanti : la suite unitaire tourne en environnement node, sans DOM du
    // tout. Publier une info d'affichage ne doit pas décider si la couche d'entrée peut exister.
    globalThis.document?.documentElement?.setAttribute("data-input-source", source);
  });

  const router = createInputRouter({
    context: () => active()?.context() ?? "screen",
    board: () => active()?.board ?? null,
    menu: () => active()?.menu ?? null,
  });

  let captureSink: ((captured: CapturedInput | null) => void) | null = null;
  const endCapture = (): void => {
    captureSink = null;
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (captureSink !== null) {
      // Rien ne part au routeur pendant une capture : configurer une touche ne doit pas jouer le
      // coup qu'elle déclenche aujourd'hui.
      event.preventDefault();
      tracker.note(InputSource.Keyboard);
      if (event.ctrlKey || event.altKey || event.metaKey) {
        // Ctrl / Alt / Meta appartiennent au navigateur et à l'OS (plan 184) : on ne les assigne pas,
        // et une frappe qui les porte ne clôt pas la capture pour autant.
        return;
      }
      const sink = captureSink;
      endCapture();
      // `Échap` est la sortie inconditionnelle (décision 8) — donc jamais assignable.
      sink(
        event.code === "Escape" ? null : { kind: "key", code: event.code, shift: event.shiftKey },
      );
      return;
    }
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
  const gamepad = startGamepadPolling(
    (action) => {
      tracker.note(InputSource.Gamepad);
      // Le contrôle focalisé passe AVANT le routeur, comme au clavier (`isClaimedByFocusedControl`
      // plus haut) — mais en appliquant l'effet au lieu de se retirer : un appui de pad ne produit
      // aucun événement clavier, donc personne ne le ferait derrière nous (plan 188).
      if (applyToFocusedControl(action)) {
        return;
      }
      router.handle(action);
    },
    () =>
      captureSink === null
        ? null
        : (index) => {
            tracker.note(InputSource.Gamepad);
            const sink = captureSink;
            endCapture();
            // B annule, comme `Échap` au clavier — même raison, même conséquence : non assignable.
            sink?.(index === CAPTURE_CANCEL_BUTTON ? null : { kind: "pad", index });
          },
  );

  return {
    tracker,
    beginCapture(sink) {
      captureSink?.(null);
      captureSink = sink;
      return () => {
        if (captureSink === sink) {
          endCapture();
          sink(null);
        }
      };
    },
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
      captureSink?.(null);
      endCapture();
      window.removeEventListener("keydown", onKeyDown);
      gamepad.dispose();
      stack.length = 0;
    },
  };
}

let current: InputSystem | null = null;

/** Boot entry — called once, next to `initSettings()`. */
export function initInputSystem(): InputSystem {
  current?.dispose();
  current = createInputSystem();
  return current;
}

/**
 * The app-wide input system. Screens and the combat flow reach it through this rather than
 * threading it through every constructor — same shape as `getSettings()`.
 */
export function getInputSystem(): InputSystem | null {
  return current;
}
