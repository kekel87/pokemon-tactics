import type { Locator, Page } from "@playwright/test";

/** InfoPanel DOM chrome (edge-anchored) — since plan 175 it reflects the ACTIVE Pokemon only; the
 *  hovered/targeted readout lives on the cursor card ({@link CursorPanel}), the same component
 *  mounted a second time. Located by `data-testid` (resilient, role-agnostic) per Playwright
 *  guidance; the HP bar carries a real `role="progressbar"` so it's reached by role — but SCOPED
 *  under the panel root, because the loading overlay exposes its own `role="progressbar"` bar while
 *  fading out (a bare page-level role would match both → strict-mode violation on an early read).
 *  Every inner locator is likewise scoped under the root: the two cards share their inner testids
 *  (one component, two instances), so only the root tells them apart. */
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
  /** Generic stand-in that replaces the official icon while the fog hides the item (plan 176): a
   *  CSS-drawn dotted square carrying a lone « ? ». Reached by its user-facing text, EXACT so the
   *  « ??? » placeholder name sitting beside it doesn't match — never by class. */
  readonly itemGlyph: Locator;
  /** Localised item NAME alone (« Restes », or the fog's « ??? » placeholder). Read from its own span
   *  and not from {@link item}: under fog the line ALSO renders the glyph's « ? », so the container's
   *  text is `? ???` — only the last span carries the datum. Tag-scoped like {@link itemIcon}. */
  readonly itemName: Locator;
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
  /** Confirm-phase forecast (plan 175) — inert on the left card, filled on the cursor card. */
  readonly remaining: Locator;
  readonly verdict: Locator;
  readonly counter: Locator;
  /** Confirm-phase attack block (plan 175) — the ATTACKER's card grows a third column carrying it. */
  readonly attack: Locator;
  readonly moveName: Locator;
  readonly damage: Locator;
  /** Unit of the damage bounds — « PV », or « % » under the enemy fog (plan 176), which is the ONLY
   *  readable difference (the bounds themselves stay `min–max` either way). It carries no testid of
   *  its own, so it is reached as the span right after the testid'd figure — a structural hop like
   *  {@link itemIcon}'s tag-scoped `img`, never a CSS class. */
  readonly damageUnit: Locator;
  readonly accuracy: Locator;
  readonly crit: Locator;
  readonly modifiers: Locator;
  readonly effect: Locator;
  constructor(page: Page, testId = "info-panel") {
    this.panel = page.getByTestId(testId);
    this.name = this.panel.getByTestId("info-panel-name");
    this.level = this.panel.getByTestId("info-panel-level");
    this.hpText = this.panel.getByTestId("info-panel-hp");
    this.hpBar = this.panel.getByRole("progressbar");
    this.portrait = this.panel.getByTestId("info-panel-portrait");
    this.item = this.panel.getByTestId("info-panel-item");
    this.itemIcon = this.item.locator("img");
    this.itemGlyph = this.item.getByText("?", { exact: true });
    this.itemName = this.item.locator("span").last();
    this.types = this.panel.getByTestId("info-panel-types");
    // `li[data-type]` and not a bare `li`: since plan 175 the target counter rides this same row.
    this.typeChips = this.types.locator("li[data-type]");
    this.hpNumbers = this.hpText.locator("span").nth(0);
    this.hpPct = this.hpText.locator("span").nth(1);
    this.talent = this.panel.getByTestId("info-panel-talent");
    this.stats = this.panel.getByTestId("info-panel-stats");
    this.statRows = this.stats.locator("> div");
    this.remaining = this.panel.getByTestId("combat-preview-remaining");
    this.verdict = this.panel.getByTestId("combat-preview-verdict");
    this.counter = this.panel.getByTestId("combat-preview-counter");
    this.attack = this.panel.getByTestId("combat-preview-attack");
    this.moveName = this.panel.getByTestId("combat-preview-move");
    this.damage = this.panel.getByTestId("combat-preview-damage");
    this.damageUnit = this.damage.locator("xpath=following-sibling::span[1]");
    this.accuracy = this.panel.getByTestId("combat-preview-accuracy");
    this.crit = this.panel.getByTestId("combat-preview-crit");
    this.modifiers = this.panel.getByTestId("combat-preview-modifiers");
    this.effect = this.panel.getByTestId("combat-preview-effect");
  }
}

/** Cursor card (plan 175) — same component as {@link InfoPanel}, mounted a second time to the right
 *  of the tile panel. Shows the Pokemon under the cursor, and during a confirm the focused target of
 *  the attack footprint with its damage forecast layered on. */
export class CursorPanel extends InfoPanel {
  constructor(page: Page) {
    super(page, "cursor-panel");
  }
}

/** TileInfoPanel DOM chrome (plan 177) — the narrow terrain panel to the right of the Pokémon
 *  InfoPanel; reflects the terrain + active modifiers of the tile under the cursor (or the active
 *  Pokémon's tile by default). Located by `data-testid`; the effect chips carry no testid, so their
 *  assertions read user-facing text (`getByText` on the localised hazard/field/zone name), the resolved
 *  icon `<img src>` (tag-scoped `img[src*=…]`, resilient like `InfoPanel.itemIcon`), or the chip's
 *  accessible label (`getByLabel` on the emoji-only traversal chip) — never a CSS class. */
export class TileInfoPanel {
  readonly panel: Locator;
  /** Terrain name span (FR official, ex. « Magma » / « Neutre »). */
  readonly terrain: Locator;
  /** Effect-chip rows — each `<li>` is one line of chips. Tag-scoped under the testid'd panel. */
  readonly lines: Locator;
  /** All resolved icon `<img>` inside the panel (type + status sprites). */
  readonly icons: Locator;
  constructor(page: Page) {
    this.panel = page.getByTestId("tile-info-panel");
    this.terrain = page.getByTestId("tile-info-terrain");
    this.lines = this.panel.locator("li");
    this.icons = this.panel.locator("img");
  }

  /** A chip icon whose resolved `src` matches a known asset path fragment (ex. « types/fire »,
   *  « statuses/icon-burned ») — an attribute selector, not a fragile class. */
  icon(pathFragment: string): Locator {
    return this.panel.locator(`img[src*="${pathFragment}"]`);
  }

  /** The effect line (`<li>`) that contains the given user-facing text (hazard/field/zone name) —
   *  used to assert the duration badge sits on the same chip as the name. */
  line(text: string): Locator {
    return this.panel.locator("li", { hasText: text });
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
