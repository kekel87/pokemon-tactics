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
  /** Held-item line (official icon + localised FR name, e.g. « Restes ») — hidden when the Pokémon
   *  holds nothing. The container's text is the item name (the icon `<img>` has empty alt → no text),
   *  so `item` reads the FR name directly. */
  readonly item: Locator;
  /** Official held-item icon inside the item line (plan 168). Scoped `img` under the testid'd
   *  container: the icon has an empty `alt` (decorative → no `img` role) and carries no testid of its
   *  own, so a tag-scoped locator under the stable `info-panel-item` testid is the resilient reach. */
  readonly itemIcon: Locator;
  constructor(page: Page) {
    this.panel = page.getByTestId("info-panel");
    this.name = page.getByTestId("info-panel-name");
    this.level = page.getByTestId("info-panel-level");
    this.hpText = page.getByTestId("info-panel-hp");
    this.hpBar = page.getByRole("progressbar");
    this.portrait = page.getByTestId("info-panel-portrait");
    this.item = page.getByTestId("info-panel-item");
    this.itemIcon = this.item.locator("img");
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

/** Vent Arrière HUD (top-center, arrow mode) — shown when a global tailwind is active (plan 145). */
export class TailwindHud {
  readonly hud: Locator;
  readonly label: Locator;
  readonly turns: Locator;
  constructor(page: Page) {
    this.hud = page.getByTestId("tailwind-hud");
    this.label = page.getByTestId("tailwind-label");
    this.turns = page.getByTestId("tailwind-turns");
  }
}
