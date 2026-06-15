import { LOADING_FADE_OUT_MS, LOADING_TIP_ROTATION_MS_DEFAULT } from "../constants";
import { t } from "../i18n/index";
import { createTipProvider } from "../i18n/loading-tips";
import "../styles/loading-overlay.css";

export interface LoadingOverlayHandle {
  /** Progress 0..1 (clamped). */
  setProgress(fraction: number): void;
  /** Fade out then remove from the DOM; resolves once gone. Idempotent. */
  finish(): Promise<void>;
  /** Synchronous teardown (clear timer + remove now), for an aborted mount/replay. Idempotent. */
  cancel(): void;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/**
 * Full-screen DOM loading overlay (port of the Phaser LoadingScene, plan 097 → 127). Shown over
 * the canvas while the combat scene loads its map + sprite atlases, then faded out, so the player
 * never sees a half-loaded scene (FOUC). Rotating gameplay tips + a progress bar. Styling lives in
 * `styles/loading-overlay.css`; only the runtime bar width is set inline.
 */
export function showLoadingOverlay(host: HTMLElement): LoadingOverlayHandle {
  const overlay = document.createElement("div");
  overlay.className = "loading-overlay";
  overlay.dataset.testid = "loading-overlay";

  const label = document.createElement("div");
  label.className = "loading-overlay__label";
  label.textContent = t("loading.battle");

  const bar = document.createElement("div");
  bar.className = "loading-overlay__bar";
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "100");
  bar.setAttribute("aria-valuenow", "0");
  const barFill = document.createElement("div");
  barFill.className = "loading-overlay__bar-fill";
  bar.appendChild(barFill);

  const tip = document.createElement("div");
  tip.className = "loading-overlay__tip";
  tip.setAttribute("aria-live", "polite");
  const tipProvider = createTipProvider(() => Math.random());
  tip.textContent = tipProvider();
  const tipTimer = setInterval(() => {
    tip.textContent = tipProvider();
  }, LOADING_TIP_ROTATION_MS_DEFAULT);

  overlay.append(label, bar, tip);
  host.appendChild(overlay);

  let done = false;

  return {
    setProgress(fraction) {
      const percent = Math.round(clamp01(fraction) * 100);
      // Runtime value (a fixed CSS rule can't express live progress).
      barFill.style.inlineSize = `${percent}%`;
      bar.setAttribute("aria-valuenow", String(percent));
    },
    finish() {
      if (done) {
        return Promise.resolve();
      }
      done = true;
      clearInterval(tipTimer);
      overlay.classList.add("is-hidden");
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          overlay.remove();
          resolve();
        }, LOADING_FADE_OUT_MS);
      });
    },
    cancel() {
      if (done) {
        return;
      }
      done = true;
      clearInterval(tipTimer);
      overlay.remove();
    },
  };
}
