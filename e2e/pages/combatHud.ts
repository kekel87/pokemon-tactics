import type { Locator, Page } from "@playwright/test";

/** InfoPanel DOM chrome (edge-anchored) — reflects the active/hovered Pokemon's identity and PV.
 *  Located by `data-testid` (resilient, role-agnostic) per Playwright guidance; the HP bar carries
 *  a real `role="progressbar"` so it's reached by role — but SCOPED under the `info-panel` testid,
 *  because the loading overlay exposes its own `role="progressbar"` bar while fading out (a bare
 *  page-level role would match both → strict-mode violation on an early read). */
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
  /** Enriched ally readout (plan 174). Type chips list — each `<li>` carries `data-type="<id>"`
   *  (the label is CSS-uppercased so its `textContent` stays « Plante » → we assert the id attribute). */
  readonly types: Locator;
  readonly typeChips: Locator;
  /** HP line inner spans: exact numbers (« 155 / 155 ») then percentage (« (NN%) »). Since plan 174
   *  the `info-panel-hp` span wraps BOTH, so read the numbers from the 1st child, not the container. */
  readonly hpNumbers: Locator;
  readonly hpPct: Locator;
  /** Localised talent name, pushed to the right of the HP row (ally only → hidden for enemies). */
  readonly talent: Locator;
  /** Battle-stats block (ally only). Each `.ip-stat` row is a direct `<div>` child; a row's cells
   *  are ordered `<span>`s: label, value, crans, arrow, modified — tag-scoped like `itemIcon`. */
  readonly stats: Locator;
  readonly statRows: Locator;
  constructor(page: Page) {
    this.panel = page.getByTestId("info-panel");
    this.name = page.getByTestId("info-panel-name");
    this.level = page.getByTestId("info-panel-level");
    this.hpText = page.getByTestId("info-panel-hp");
    this.hpBar = this.panel.getByRole("progressbar");
    this.portrait = page.getByTestId("info-panel-portrait");
    this.item = page.getByTestId("info-panel-item");
    this.itemIcon = this.item.locator("img");
    this.types = page.getByTestId("info-panel-types");
    this.typeChips = this.types.locator("li");
    this.hpNumbers = this.hpText.locator("span").nth(0);
    this.hpPct = this.hpText.locator("span").nth(1);
    this.talent = page.getByTestId("info-panel-talent");
    this.stats = page.getByTestId("info-panel-stats");
    this.statRows = this.stats.locator("> div");
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
