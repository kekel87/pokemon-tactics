import { loadSpriteBundle } from "@pokemon-tactic/view-core";
import "../styles/splash.css";
import { prepareItemIconSheet } from "../team/item-icon-sheet.js";
import { preparePortraitSheet } from "../team/portrait-sheet.js";

const FADE_MS = 320;

/**
 * Initial splash screen (plan 135). Shown over `#game-root` at the very start of boot,
 * BEFORE any screen that renders a Pokemon. Downloads the sprite bundle (`sprites.bin`,
 * ~33 MB for the full Gen 1 roster) with a real progress bar, decodes the portrait sheet, then fades out
 * and resolves. Every boot path (menu / combat / preview / sandbox) awaits this once, so
 * sprites are guaranteed in memory before the first frame. The browser caches the bundle,
 * making later loads instant. On failure it surfaces a retry button (no game without sprites).
 *
 * Distinct from `LoadingOverlay` (combat transitions + tips) by design (decision #2):
 * the splash owns the game title + entrance fade.
 */
export function runSplash(host: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "splash";
    overlay.dataset.testid = "splash";

    const title = document.createElement("h1");
    title.className = "splash__title";
    title.textContent = "Pokémon Tactics";

    const barOuter = document.createElement("div");
    barOuter.className = "splash__bar";
    barOuter.setAttribute("role", "progressbar");
    barOuter.setAttribute("aria-valuemin", "0");
    barOuter.setAttribute("aria-valuemax", "100");
    barOuter.setAttribute("aria-valuenow", "0");
    const barFill = document.createElement("div");
    barFill.className = "splash__bar-fill";
    barOuter.append(barFill);

    const status = document.createElement("div");
    status.className = "splash__status";
    status.setAttribute("aria-live", "polite");

    overlay.append(title, barOuter, status);
    host.appendChild(overlay);
    // Trigger the entrance fade on the next frame (class added post-attach).
    requestAnimationFrame(() => overlay.classList.add("splash--visible"));

    const setProgress = (fraction: number): void => {
      const percent = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
      barFill.style.inlineSize = `${percent}%`;
      barOuter.setAttribute("aria-valuenow", String(percent));
    };

    const fadeOutAndResolve = (): void => {
      overlay.classList.remove("splash--visible");
      window.setTimeout(() => {
        overlay.remove();
        resolve();
      }, FADE_MS);
    };

    const attempt = (): void => {
      status.textContent = "";
      barOuter.hidden = false;
      Promise.resolve()
        .then(() => loadSpriteBundle({ onProgress: setProgress }))
        .then(() => Promise.all([preparePortraitSheet(), prepareItemIconSheet()]))
        .then(fadeOutAndResolve)
        .catch(() => {
          barOuter.hidden = true;
          status.textContent = "Échec du chargement des ressources.";
          const retry = document.createElement("button");
          retry.type = "button";
          retry.className = "splash__retry";
          retry.textContent = "Réessayer";
          retry.addEventListener("click", () => {
            retry.remove();
            attempt();
          });
          status.append(retry);
        });
    };

    attempt();
  });
}
