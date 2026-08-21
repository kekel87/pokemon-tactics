import {
  activateFocusedControl,
  focusableControls,
  focusInDirection,
} from "../../../input/focus-navigation";
import { InputSource } from "../../../input/input-source";
import { getInputSystem } from "../../../input/input-system";

/**
 * Shared DOM helpers for FSM menu screens (plan 120 step 2).
 * Screens are plain full-viewport DOM (no Babylon canvas); buttons reuse the
 * `.tb-btn` component with the `.mn-btn` size override (menu-screens.css).
 */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  testId?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (testId) {
    node.dataset.testid = testId;
  }
  return node;
}

export function menuButton(label: string, action?: () => void): HTMLButtonElement {
  const button = el("button", "tb-btn mn-btn");
  button.type = "button";
  button.textContent = label;
  if (action) {
    button.addEventListener("click", action);
  } else {
    button.disabled = true;
  }
  return button;
}

/**
 * Registers a menu screen with the input layer (plan 184): the arrows walk the focus through the
 * screen's controls (navigation SPATIALE, cf. `focus-navigation.ts`), and Escape (or B on a gamepad)
 * goes back. Returns the unregister to call from `dispose()`.
 *
 * Replaces the per-screen `window.addEventListener("keydown")` this used to be — six screens each
 * binding their own listener, with no notion of who else was listening.
 *
 * `onBack` is optional because the MAIN MENU has nowhere to go back to. It was left unregistered for
 * that reason at first, which meant the arrows had no consumer there at all: the whole first screen
 * of the game ignored the keyboard (retour humain 2026-08-21).
 */
export function bindScreenInput(onBack?: () => void): () => void {
  const system = getInputSystem();
  if (!system) {
    return () => undefined;
  }
  // Écran monté alors que le joueur navigue au clavier / à la manette : on lui donne un point de
  // départ (retour humain 2026-08-21). Sans ça il devait presser une flèche « pour rien » à chaque
  // changement d'écran avant que quoi que ce soit ne réagisse.
  if (system.tracker.isFocusDriven()) {
    focusableControls()[0]?.focus();
  }

  return system.register({
    context: () => "screen",
    menu: {
      focusMove: (direction) => focusInDirection(direction),
      confirm: () => {
        // À la MANETTE il faut activer soi-même : un appui de pad n'est pas un événement clavier,
        // donc aucune activation native ne suit et A ne faisait rien du tout (retour humain
        // 2026-08-21). Au clavier au contraire, le navigateur active le bouton focalisé, et réclamer
        // la touche ici l'en empêcherait.
        if (system.tracker.current() !== InputSource.Gamepad) {
          return false;
        }
        return activateFocusedControl();
      },
      cancel: () => {
        // A modal dialog owns Escape: it must close, not navigate the screen away underneath it.
        if (onBack === undefined || document.querySelector("dialog[open]") !== null) {
          return false;
        }
        onBack();
        return true;
      },
    },
  });
}
