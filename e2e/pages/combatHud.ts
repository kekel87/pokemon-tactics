import type { Locator, Page } from "@playwright/test";

/** InfoPanel DOM chrome (edge-anchored) — reflects the active/hovered Pokemon's identity and PV.
 *  Located by `data-testid` (resilient, role-agnostic) per Playwright guidance; the HP bar carries
 *  a real `role="progressbar"` so it's reached by role, not a testid. */
export class InfoPanel {
  readonly panel: Locator;
  readonly name: Locator;
  readonly level: Locator;
  readonly hpText: Locator;
  readonly hpBar: Locator;
  readonly portrait: Locator;
  /** Held-item line (« 🎒 {nom} ») — hidden when the Pokémon holds nothing. */
  readonly item: Locator;
  constructor(page: Page) {
    this.panel = page.getByTestId("info-panel");
    this.name = page.getByTestId("info-panel-name");
    this.level = page.getByTestId("info-panel-level");
    this.hpText = page.getByTestId("info-panel-hp");
    this.hpBar = page.getByRole("progressbar");
    this.portrait = page.getByTestId("info-panel-portrait");
    this.item = page.getByTestId("info-panel-item");
  }
}

/** Weather HUD (top-center) — shown when the battle has active weather. */
export class WeatherHud {
  readonly hud: Locator;
  readonly label: Locator;
  readonly turns: Locator;
  constructor(page: Page) {
    this.hud = page.getByTestId("weather-hud");
    this.label = page.getByTestId("weather-label");
    this.turns = page.getByTestId("weather-turns");
  }
}
