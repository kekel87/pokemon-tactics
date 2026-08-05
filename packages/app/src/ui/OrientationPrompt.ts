/*
 * Portrait prompt (plan 179 §A) — obstructs the game while a touch device is held upright.
 *
 * Deliberately NOT an orientation *lock*: `screen.orientation.lock()` requires a fullscreen
 * document and iOS Safari does not implement the Screen Orientation API at all (Fullscreen API
 * itself is iPad-only), so no web API can actually prevent rotation on a large part of the
 * install base. Obstructing the view in portrait is the practice web games converged on, and it
 * needs no permission, no gesture and no API support.
 *
 * Visibility is driven entirely by CSS — `@media (orientation: portrait) and (pointer: coarse) and
 * (max-width: 599px)`. The third clause is the tablet carve-out: an upright tablet has room to play,
 * so only phones get obstructed (see `orientation-prompt.css`). This module only builds the markup
 * and keeps its text in sync with the language.
 *
 * No teardown: the overlay and its language subscription are session-lifetime by design. It is
 * mounted once from `babylon-boot.ts`, outside the screen FSM, so it covers every boot path
 * (sandbox and direct-combat routes included) and never needs removing.
 */

import { onLanguageChange, t } from "../i18n/index.js";

/** Build the portrait prompt inside `root` and keep its copy in sync with the language. */
export function mountOrientationPrompt(root: HTMLElement): void {
  const overlay = document.createElement("div");
  overlay.className = "or-overlay";
  // Test contract: `aria-hidden` (below) keeps it out of the a11y tree, so no role/name is
  // reachable — a testid is the only stable handle for the e2e visibility checks.
  overlay.dataset.testid = "orientation-prompt";
  // Hidden from assistive tech: it is a purely visual affordance about how to hold the device,
  // and the game underneath stays the real content.
  overlay.setAttribute("aria-hidden", "true");

  const glyph = document.createElement("div");
  glyph.className = "or-glyph";

  const title = document.createElement("p");
  title.className = "or-title";

  const hint = document.createElement("p");
  hint.className = "or-hint";

  const applyCopy = (): void => {
    title.textContent = t("orientation.title");
    hint.textContent = t("orientation.hint");
  };
  applyCopy();

  overlay.append(glyph, title, hint);
  root.append(overlay);

  onLanguageChange(applyCopy);
}
