import type { Locator, Page } from "@playwright/test";

/**
 * Page Object for the app SHELL — everything that lives outside any single screen: the document
 * head's platform metadata (PWA manifest, Apple touch icon, theme colour) and the boot-level
 * behaviours that survive a reload (plan 180).
 *
 * Head elements carry neither role nor text, so they are reached by attribute selector
 * (`link[rel="manifest"]`) — the same structural reach `responsive-screens.spec` already uses for
 * the viewport meta, and NOT a style-coupled CSS class.
 */
export class AppShell {
  /** localStorage key holding the resume point (`{ id, savedAt }`) — a test contract, plan 180-b. */
  private static readonly LAST_SCREEN_KEY = "pt-last-screen";

  readonly manifestLink: Locator;
  readonly appleTouchIcon: Locator;
  readonly themeColor: Locator;

  constructor(private readonly page: Page) {
    this.manifestLink = page.locator('link[rel="manifest"]');
    this.appleTouchIcon = page.locator('link[rel="apple-touch-icon"]');
    this.themeColor = page.locator('meta[name="theme-color"]');
  }

  /**
   * Reload the way a discarded tab comes back: a fresh document that has to re-cross the boot
   * splash before any screen mounts (same gate as {@link MainMenu.goto}). Resolves once the splash
   * is gone, so screen locators resolve instead of racing the sprite-bundle download.
   */
  async reload(): Promise<void> {
    await this.page.reload();
    await this.page.getByTestId("splash").waitFor({ state: "detached" });
  }

  /**
   * Whether the document is displayed fullscreen — the same signal the app reads
   * (`document.fullscreenElement`), so the assertion judges the real platform state and not a UI
   * label. Poll it: `requestFullscreen()` settles asynchronously.
   */
  isFullscreen(): Promise<boolean> {
    return this.page.evaluate(() => document.fullscreenElement != null);
  }

  /**
   * Leave fullscreen WITHOUT going through the app's own control — the "exit we did not trigger"
   * path (Escape, system gesture) that the chrome must react to. Programmatic exit needs no user
   * activation, unlike entering. Also the cleanup lever for a test that entered fullscreen.
   */
  async exitFullscreen(): Promise<void> {
    await this.page.evaluate(() => document.exitFullscreen());
  }

  /**
   * The persisted resume point's screen id, or `null` when there is none — which is the case both
   * before anything was recorded and after a parameter-carrying screen (team-select, combat) wiped
   * it. Reads the datum, not the raw JSON, so the shape stays the source's business.
   */
  async persistedScreenId(): Promise<string | null> {
    const stored = await this.page.evaluate(
      (key) => localStorage.getItem(key),
      AppShell.LAST_SCREEN_KEY,
    );
    if (stored === null) {
      return null;
    }
    return (JSON.parse(stored) as { id?: string }).id ?? null;
  }
}
