import type { Locator, Page } from "@playwright/test";

// Lightweight Page Objects for the DOM screens. One screen is mounted at a time
// (ScreenManager dispose-then-mount), so labels like "Retour" are unambiguous.

export class BattleModeScreen {
  readonly title: Locator;
  readonly local: Locator;
  /** Unimplemented modes — always disabled. */
  readonly online: Locator;
  readonly tutorial: Locator;
  readonly back: Locator;
  constructor(page: Page) {
    this.title = page.getByText("Mode de combat", { exact: true });
    this.local = page.getByRole("button", { name: "Local", exact: true });
    this.online = page.getByRole("button", { name: "En ligne", exact: true });
    this.tutorial = page.getByRole("button", { name: "Tutoriel", exact: true });
    this.back = page.getByRole("button", { name: "Retour" });
  }
}

export class MapSelectScreen {
  readonly title: Locator;
  readonly confirm: Locator;
  readonly back: Locator;
  /** The 8 selectable map rows (left list). */
  readonly listItems: Locator;
  /** Right-hand detail panel of the currently-selected map. */
  readonly detailName: Locator;
  readonly detailMeta: Locator;
  readonly detailDescription: Locator;
  constructor(page: Page) {
    this.title = page.getByText("Choix de la carte");
    this.confirm = page.getByRole("button", { name: "Choisir cette carte", exact: true });
    this.back = page.getByRole("button", { name: "Retour" });
    this.listItems = page.getByTestId("map-list-item");
    this.detailName = page.getByTestId("map-detail-name");
    this.detailMeta = page.getByTestId("map-detail-meta");
    this.detailDescription = page.getByTestId("map-detail-description");
  }
}

export class TeamSelectScreen {
  readonly title: Locator;
  /** Toggle the Player 1 slot from Human → AI (assigns it a random team → launchable). */
  readonly humanToggle: Locator;
  readonly launch: Locator;
  constructor(page: Page) {
    this.title = page.getByText("Sélection d'équipe", { exact: false });
    this.humanToggle = page.getByRole("button", { name: "Humain", exact: true });
    this.launch = page.getByRole("button", { name: "Lancer ▶", exact: true });
  }
}

export class SettingsScreen {
  readonly title: Locator;
  readonly back: Locator;
  /** Each setting's control carries a dedicated `data-testid` (resilient to label/i18n changes). */
  readonly languageToggle: Locator;
  readonly damagePreviewToggle: Locator;
  readonly cursorToggle: Locator;
  constructor(page: Page) {
    this.title = page.getByRole("heading", { name: "Paramètres" });
    this.back = page.getByRole("button", { name: "Retour" });
    this.languageToggle = page.getByTestId("setting-language");
    this.damagePreviewToggle = page.getByTestId("setting-damage-preview");
    this.cursorToggle = page.getByTestId("setting-cursor");
  }
}

export class CreditsScreen {
  readonly title: Locator;
  /** A line of the fan-project disclaimer (proves content rendered, not just the title). */
  readonly disclaimer: Locator;
  readonly back: Locator;
  constructor(page: Page) {
    this.title = page.getByRole("heading", { name: "Crédits" });
    this.disclaimer = page.getByText(/projet de fan/i);
    this.back = page.getByRole("button", { name: "Retour" });
  }
}
