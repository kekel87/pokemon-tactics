/*
 * Platform probes for the PWA install state (plan 180-a).
 *
 * Kept free of any DOM building so the settings screen can ask "should I even offer this row?"
 * without importing UI concerns. Every probe is defensive: these APIs are the ones that differ
 * the most across engines, and a missing one must degrade to "not installed / not supported",
 * never throw at boot.
 */

/** Safari exposes the legacy standalone flag on `navigator`, outside the DOM lib types. */
interface SafariNavigator extends Navigator {
  readonly standalone?: boolean;
}

/**
 * True when the app runs as an installed PWA rather than inside a browser tab.
 *
 * Tests BOTH signals on purpose: `display-mode: standalone` does not match when the manifest asked
 * for `fullscreen`/`minimal-ui`, and iOS historically only ever exposed `navigator.standalone`.
 * Checking one alone misreports on at least one platform.
 */
function isStandalone(): boolean {
  const iosStandalone = (navigator as SafariNavigator).standalone === true;
  const displayMode =
    window.matchMedia?.("(display-mode: standalone), (display-mode: fullscreen)").matches === true;
  return iosStandalone || displayMode;
}

/**
 * True on iPhone/iPad — the platforms where installing to the home screen is the only route to a
 * chrome-less window, and where it can never be triggered from script.
 *
 * User-agent sniffing is a last resort, but there is no feature to detect here: the question is
 * "does this user have to use the Share menu?", which is a platform fact, not a capability. iPadOS
 * reports itself as a Mac, hence the touch-point probe.
 */
function isIosLike(): boolean {
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    return true;
  }
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

/**
 * True when we should walk the user through a manual install (the iOS-only case).
 * Android gets real fullscreen from a button instead, so it never needs the instructions.
 */
export function shouldOfferIosInstall(): boolean {
  return isIosLike() && !isStandalone();
}
