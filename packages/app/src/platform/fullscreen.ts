/*
 * Fullscreen + landscape lock (plan 180-a).
 *
 * Answers the human's first report: on a phone, the browser URL bar eats a band of an already
 * cramped landscape viewport. `requestFullscreen()` removes it — on Android only. Safari on iPhone
 * does not implement the Fullscreen API at all (iPad only), so there the row is hidden and the only
 * route is installing to the home screen (see `pwa.ts`).
 *
 * Two sequencing rules govern this file, both learned the hard way and both easy to break by
 * "tidying" the code:
 *
 *  1. `requestFullscreen()` MUST be called synchronously inside the click handler. Any `await`
 *     before it consumes the user activation and the request is rejected.
 *  2. `screen.orientation.lock()` requires an ACTIVE fullscreen document, so it must run only after
 *     the fullscreen promise resolves. Locking first throws `SecurityError` on Firefox Android
 *     (Bugzilla #1610745 — a sequencing rule, not missing support).
 *
 * The lock is best-effort by design: it is absent on iOS, and it fails on iPad ("Apps supporting
 * multiple scenes cannot lock their orientation"). The portrait overlay (`OrientationPrompt`) stays
 * the universal fallback, so a rejected lock is never surfaced as an error.
 */

/** True when the Fullscreen API is usable at all — false on iPhone Safari. */
export function isFullscreenSupported(): boolean {
  return typeof document.documentElement.requestFullscreen === "function";
}

/**
 * True while the document is displayed fullscreen.
 * `!= null` and not `!== null`: where the API is missing the property is `undefined`, and a strict
 * comparison would answer "yes, fullscreen" on precisely the platform this file exists to handle.
 */
export function isFullscreen(): boolean {
  return document.fullscreenElement != null;
}

/**
 * Enter or leave fullscreen, locking to landscape on the way in.
 *
 * MUST be called directly from a user gesture handler (see rule 1 above). Returns once the
 * transition settled, so callers can refresh their UI from `isFullscreen()`.
 */
export async function toggleFullscreen(): Promise<void> {
  // Self-contained contract: both call sites gate on `isFullscreenSupported()` before showing their
  // control, but without this guard a future caller would get a synchronous TypeError on a platform
  // without the API — the exact platform this module is about.
  if (!isFullscreenSupported()) {
    return;
  }
  if (isFullscreen()) {
    // Leaving fullscreen drops the orientation lock implicitly — no explicit unlock needed.
    await document.exitFullscreen().catch(reportPlatformRefusal);
    return;
  }
  // Not awaited before the call itself: `requestFullscreen` is invoked synchronously here so the
  // user activation still stands.
  const request = document.documentElement.requestFullscreen();
  try {
    await request;
  } catch (error) {
    // Refused (no activation left, or an embedding policy blocks it). Nothing else to attempt.
    reportPlatformRefusal(error);
    return;
  }
  await lockLandscape();
}

/**
 * Best-effort landscape lock. Only meaningful once fullscreen is active.
 * Resolves even on failure: the portrait overlay already covers every rejection path.
 */
async function lockLandscape(): Promise<void> {
  const orientation = screen.orientation as ScreenOrientation | undefined;
  if (typeof orientation?.lock !== "function") {
    return;
  }
  try {
    await orientation.lock("landscape");
  } catch (error) {
    reportPlatformRefusal(error);
  }
}

/**
 * Subscribe to fullscreen entry/exit — including exits we did not trigger (Escape, gestures).
 *
 * Pass a `signal` to tie the subscription to an existing lifetime (the combat screen's
 * `AbortController`); otherwise use the returned unsubscribe. Both callers go through here so the
 * event name lives in exactly one place.
 */
export function onFullscreenChange(
  listener: () => void,
  options?: { signal?: AbortSignal },
): () => void {
  document.addEventListener("fullscreenchange", listener, { signal: options?.signal });
  return () => document.removeEventListener("fullscreenchange", listener);
}

function reportPlatformRefusal(error: unknown): void {
  // biome-ignore lint/suspicious/noConsole: a refused platform request is diagnostic-only — never an error the player should see
  console.warn("[platform] fullscreen/orientation request refused:", error);
}
