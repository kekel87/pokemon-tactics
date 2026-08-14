/*
 * Fullscreen toggle sitting next to the battle log (plan 180-a, human request 2026-08-14).
 *
 * The settings screen already carries a fullscreen row, but reaching it mid-battle means leaving
 * the fight — on a phone, where the URL bar costs the most, that is exactly when the player wants
 * it. So this is a second entry point, not a replacement.
 *
 * Shown ONLY while not fullscreen: once the bar is gone the button has nothing left to offer, and
 * leaving is already covered by Escape and the system gesture. It also stays hidden where the API
 * is missing (iPhone), rather than sitting there inert.
 *
 * Engine- and platform-agnostic on purpose: the caller injects the platform probes, so this file
 * never imports `packages/app`.
 */

import { el } from "./dom-helpers.js";

export interface FullscreenButtonOptions {
  /** Accessible name — the control is icon-only. */
  readonly label: string;
  /** False when the Fullscreen API is unavailable (iPhone): the button never mounts visibly. */
  readonly isSupported: () => boolean;
  /** Current document state, re-read on every refresh rather than cached. */
  readonly isFullscreen: () => boolean;
  /**
   * Invoked straight from the click handler. MUST call `requestFullscreen()` synchronously —
   * awaiting anything first loses the user activation and the request is refused.
   */
  readonly onToggle: () => void;
}

export interface FullscreenButton {
  readonly element: HTMLButtonElement;
  /** Re-evaluate visibility — call on `fullscreenchange`. */
  refresh(): void;
}

/** Icon-only expand glyph, styled to match the battle log surface it sits beside. */
export function createFullscreenButton(options: FullscreenButtonOptions): FullscreenButton {
  const button = el("button", "fs-btn", "fullscreen-button");
  button.type = "button";
  // Icon-only control: the arrows carry no text, so the name has to come from `aria-label`.
  button.setAttribute("aria-label", options.label);
  button.title = options.label;

  const glyph = el("span", "fs-btn-glyph");
  // Glyphe texte, comme le burger du journal (`.bl-burger` = "☰") : même famille visuelle et aucun
  // asset à charger. Rejoint le chantier « pack d'icônes cohérent » noté au plan 177, qui remplacera
  // d'un coup les glyphes/émoji placeholder de l'UI.
  glyph.textContent = "⛶";
  // Décoratif : le bouton est déjà nommé par son `aria-label`, le glyphe ne doit pas être annoncé
  // une seconde fois.
  glyph.setAttribute("aria-hidden", "true");
  button.append(glyph);

  button.addEventListener("click", () => {
    options.onToggle();
    // Visibility also refreshes from `fullscreenchange`; doing it here too keeps the button from
    // lingering for a frame between the click and the event.
    refresh();
  });

  function refresh(): void {
    button.hidden = !options.isSupported() || options.isFullscreen();
  }
  refresh();

  return { element: button, refresh };
}
