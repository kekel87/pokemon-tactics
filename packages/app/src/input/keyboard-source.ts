import { getBindings, keyLookupKey } from "./bindings-store.js";
import { LogicalAction } from "./logical-action.js";

/**
 * Résolution d'une frappe en action logique.
 *
 * Les bindings eux-mêmes ne sont plus ici : ils vivent dans `bindings-store.ts` depuis le plan 186,
 * parce que l'écran de contrôles les réécrit. Ce qui reste, c'est la LECTURE d'un événement — les
 * règles qui, elles, ne se remappent pas : les positions physiques plutôt que les caractères
 * (`KeyboardEvent.code`, plan 184), le refus des combinaisons du navigateur et de l'OS, et l'arbitrage
 * avec le contrôle qui a le focus.
 *
 * Rappel de la règle du plan 184, toujours vraie pour un binding futur : position pour les
 * déplacements et les actions, caractère pour une touche dont le SENS est le symbole. Le magasin ne
 * connaît que des positions — `+` / `−` restent hors-jeu, la position `Minus` portant `)` sur AZERTY.
 */

/** What this event means, or null when the key is not bound. */
export function resolveKeyboardAction(
  event: {
    code: string;
    shiftKey: boolean;
    ctrlKey?: boolean;
    altKey?: boolean;
    metaKey?: boolean;
  },
  lookup: ReadonlyMap<string, LogicalAction> = getBindings().keyboardLookup(),
): LogicalAction | null {
  // Ctrl / Alt / Meta belong to the browser and the OS (Ctrl+R reloads, Alt+Tab switches app):
  // the game binds none of them, and stealing one would break a shortcut the player relies on.
  if (event.ctrlKey === true || event.altKey === true || event.metaKey === true) {
    return null;
  }
  // Une position et son homologue à Maj sont deux bindings DIFFÉRENTS (`Tab` / `Maj+Tab`), donc deux
  // clés distinctes dans la table — pas une table par état de Maj comme au plan 184.
  return lookup.get(keyLookupKey(event.code, event.shiftKey)) ?? null;
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
