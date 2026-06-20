import type { Locator, Page } from "@playwright/test";

/** Page Object for the boot splash (plan 135) — the gate that downloads the sprite bundle
 *  (`sprites.bin` + manifest + `portraits.png`) before any screen renders a Pokemon. Located by
 *  testid (the overlay) + the real `role="progressbar"` it carries. */
export class Splash {
  /** The full-screen boot overlay (`data-testid="splash"`). */
  readonly overlay: Locator;
  /** The download progress bar inside the splash (`role="progressbar"`). */
  readonly progressBar: Locator;
  /** The game title shown on the splash (`<h1>Pokémon Tactics</h1>`). */
  readonly title: Locator;

  constructor(page: Page) {
    this.overlay = page.getByTestId("splash");
    this.progressBar = this.overlay.getByRole("progressbar");
    this.title = this.overlay.getByRole("heading", { level: 1 });
  }
}
