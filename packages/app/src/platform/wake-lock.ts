/*
 * Screen Wake Lock (plan 180-b).
 *
 * Answers the human's fourth report ("the phone sleeps and the site reloads") — but only PARTLY,
 * and the limits matter more than the feature:
 *
 *  - It prevents the screen dimming from INACTIVITY while the tab is visible. During a tactical
 *    battle the player can think for a long while without touching the screen, which is exactly the
 *    case this covers.
 *  - The browser releases the lock whenever the page goes to the background, and it does NOT come
 *    back on its own — hence the `visibilitychange` re-acquisition below, which is the whole reason
 *    this module is stateful rather than a one-liner at boot.
 *  - It does NOT survive a MANUAL screen lock, and it cannot prevent the tab being discarded under
 *    memory pressure. No web API can: that is the OS/browser tab-unloader deciding. The real remedy
 *    for a lost battle is session persistence (lot 180-c).
 *
 * Supported on Firefox Android and Chrome, and on Safari since iOS 16.4 (in installed PWAs too,
 * since iOS 18.4). Absent elsewhere → every path degrades silently, never throws.
 */

let sentinel: WakeLockSentinel | null = null;
let abort: AbortController | null = null;
/**
 * Avertissement une seule fois par session. Le refus est le cas NORMAL hors téléphone (Chromium
 * desktop et headless répondent `NotAllowedError`), et l'acquisition est retentée à chaque retour
 * au premier plan : avertir chaque fois produisait des centaines de lignes par exécution de la
 * suite e2e, où le bruit finit par masquer les vrais messages.
 */
let refusalReported = false;

/**
 * Hold the screen awake for the session, re-acquiring whenever the page becomes visible again.
 * Idempotent: calling it twice does not stack listeners or locks.
 *
 * Session-lifetime by design, like the portrait overlay: called once from `babylon-boot.ts`, never
 * torn down (there is no point in the app where the screen should be allowed to dim again), so it
 * deliberately exposes no stop counterpart. The `AbortController` exists for the idempotence guard
 * and to keep the listener registration in one place, not for a teardown path.
 */
export function startWakeLock(): void {
  if (abort !== null) {
    return;
  }
  abort = new AbortController();
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.visibilityState === "visible") {
        void acquire();
      } else {
        // The browser already released it on hide; drop our stale handle so the next
        // `acquire()` does not short-circuit on a dead sentinel.
        sentinel = null;
      }
    },
    { signal: abort.signal },
  );
  void acquire();
}

async function acquire(): Promise<void> {
  // `lib.dom` types `navigator.wakeLock` as always present, but it is genuinely absent on some
  // engines — hence a runtime probe rather than a truthiness check the compiler would call dead.
  if (!("wakeLock" in navigator) || sentinel !== null || document.visibilityState !== "visible") {
    return;
  }
  try {
    const acquired = await navigator.wakeLock.request("screen");
    // Re-check AFTER the await: the guard above ran before it, and the page can have gone to the
    // background in between. Two failure modes if we skipped this — both silent:
    //  - the browser releases the lock and fires `release` before the listener below is attached,
    //    so we would store a dead sentinel and every later `acquire()` would short-circuit on
    //    `sentinel !== null`, killing re-acquisition for the rest of the session;
    //  - two concurrent `acquire()` calls both pass the guard, orphaning the first lock.
    if (acquired.released || document.visibilityState !== "visible") {
      void acquired.release().catch(() => undefined);
      return;
    }
    // The browser can release it on its own (backgrounding, manual screen lock). Clearing our
    // handle on that event keeps the next re-acquisition from being skipped.
    acquired.addEventListener("release", () => {
      if (sentinel === acquired) {
        sentinel = null;
      }
    });
    sentinel = acquired;
  } catch (error) {
    // Denied (unsupported, not visible, or a platform policy). A dimming screen is a nuisance,
    // never a failure worth surfacing — so this stays a once-per-session note.
    if (!refusalReported) {
      refusalReported = true;
      // biome-ignore lint/suspicious/noConsole: diagnostic-only — the game is fully playable without a wake lock
      console.warn("[platform] wake lock refused, screen may dim:", error);
    }
  }
}
