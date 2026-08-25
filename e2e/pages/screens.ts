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
  /**
   * « 🎲 Aléatoire » row of the team list — assigns a random team to the ACTIVE slot, which is slot 1
   * on arrival. The way to launch a battle the test can PLAY: {@link humanToggle} also makes it
   * launchable, but by handing slot 1 to the AI, leaving no human turn to drive.
   */
  readonly randomTeam: Locator;
  readonly launch: Locator;
  constructor(page: Page) {
    this.title = page.getByText("Sélection d'équipe", { exact: false });
    this.humanToggle = page.getByRole("button", { name: "Humain", exact: true });
    this.randomTeam = page.getByRole("button", { name: "🎲 Aléatoire", exact: true });
    this.launch = page.getByRole("button", { name: "Lancer ▶", exact: true });
  }
}

export class SettingsScreen {
  readonly title: Locator;
  readonly back: Locator;
  /** Each setting's control carries a dedicated `data-testid` (resilient to label/i18n changes). */
  readonly languageToggle: Locator;
  readonly damagePreviewToggle: Locator;
  /** Fullscreen row (plan 180-a) — the row is ABSENT (not disabled) where the API is missing. */
  readonly fullscreenToggle: Locator;
  /** iOS-only « add to home screen » instruction (plan 180-a) — absent everywhere else. */
  readonly installHint: Locator;
  /** Ligne « Contrôles » → écran de remapping (plan 186). */
  readonly controls: Locator;
  constructor(page: Page) {
    this.title = page.getByRole("heading", { name: "Paramètres" });
    this.back = page.getByRole("button", { name: "Retour" });
    this.languageToggle = page.getByTestId("setting-language");
    this.damagePreviewToggle = page.getByTestId("setting-damage-preview");
    this.fullscreenToggle = page.getByTestId("setting-fullscreen");
    this.installHint = page.getByTestId("setting-install-hint");
    this.controls = page.getByTestId("setting-controls");
  }
}

export class ControlsScreen {
  readonly title: Locator;
  /** Bandeau de capture — masqué tant qu'aucune case n'attend une touche. */
  readonly captureCancel: Locator;
  /** Message d'échange (« X a quitté « Action » »), vide au repos. */
  readonly message: Locator;
  readonly resetAll: Locator;
  constructor(private readonly page: Page) {
    this.title = page.getByRole("heading", { name: "Contrôles" });
    this.captureCancel = page.getByTestId("controls-capture-cancel");
    this.message = page.getByTestId("controls-message");
    this.resetAll = page.getByTestId("controls-reset-all");
  }

  /**
   * Case de la table : `action` est la valeur de `LogicalAction`, `cell` vaut 0 (principal),
   * 1 (secondaire) ou `"pad"` (colonne manette).
   */
  cell(action: string, cell: 0 | 1 | "pad"): Locator {
    return this.page.getByTestId(`control-${action}-${cell}`);
  }

  storedBindings(): Promise<string | null> {
    return this.page.evaluate(() => localStorage.getItem("pt-bindings"));
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
