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
  /** The 9 selectable map rows (left list). */
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

/**
 * Écran de sélection d'équipe, refondu au plan 188 : un camp par carte en une colonne, le format en
 * rangée de segments (#830), Humain / IA en segment à deux états (#831), et l'équipe choisie dans une
 * modale ouverte par la carte (#832).
 *
 * ⚠️ Le segment a changé la SÉMANTIQUE du geste, pas seulement le DOM. Avant, un bouton unique
 * basculait : cliquer « Humain » **donnait le camp à l'IA**. Maintenant chaque bouton désigne un
 * état, donc « Humain » sur un camp déjà humain ne fait rien — d'où {@link giveSlotToAi}, qui vise
 * « IA ». Un test qui aurait gardé l'ancien clic serait passé au vert en ne testant plus rien.
 */
export class TeamSelectScreen {
  readonly title: Locator;
  /** Rangée de segments de format (« 2J × 6 », « 3J × 4 »…). */
  readonly formatSegments: Locator;
  /**
   * Les segments un par un, dans l'ordre du DOM. Visés par leur RÔLE dans la rangée, et non par
   * `data-testid="format-segment"` : ce testid est justement ce que le correctif ajoute (il est la
   * clé de restauration du focus), donc s'en servir ici rendrait aveugle le test qui le vérifie.
   */
  readonly formatSegmentButtons: Locator;
  /**
   * Le segment du format RETENU — `data-state="active"` n'est posé que sur lui. C'est la lecture du
   * format courant qui ne dépend ni de l'i18n ni du `text-transform` du libellé.
   */
  readonly activeFormatSegment: Locator;
  /**
   * Case « Placement auto », **cochée par défaut**. La décocher est le seul moyen d'atteindre la
   * phase de placement interactive : cochée, tout est posé d'un coup avant que la phase ne s'affiche
   * (`placement-flow.ts`), donc rien de ce qui vit pendant le placement — son menu de combat compris
   * (plan 189) — n'est atteignable.
   */
  readonly autoPlacement: Locator;
  readonly launch: Locator;
  constructor(private readonly page: Page) {
    this.title = page.getByText("Sélection d'équipe", { exact: false });
    this.formatSegments = page.getByTestId("format-segments");
    this.formatSegmentButtons = this.formatSegments.getByRole("button");
    this.activeFormatSegment = this.formatSegmentButtons.and(page.locator('[data-state="active"]'));
    this.autoPlacement = page.getByRole("checkbox");
    this.launch = page.getByRole("button", { name: "Lancer ▶", exact: true });
  }

  /** Bouton d'équipe d'un camp (0-indexé) — l'ouvre sur son sélecteur. */
  teamButton(slotIndex = 0): Locator {
    return this.page
      .getByTestId("player-team-button")
      .and(this.page.locator(`[data-slot-index="${slotIndex}"]`));
  }

  /**
   * Donne un camp à l'IA, ce qui lui assigne une équipe aléatoire — donc rend le combat lançable
   * sans passer par le sélecteur. Le chemin le plus court vers un combat, mais il ne laisse aucun
   * tour humain à jouer : pour un combat que le test PILOTE, voir {@link pickRandomTeam}.
   */
  async giveSlotToAi(slotIndex = 0): Promise<void> {
    await this.page
      .getByTestId("player-controller")
      .and(this.page.locator(`[data-slot-index="${slotIndex}"][data-controller="ai"]`))
      .click();
  }

  /**
   * Assigne une équipe aléatoire à un camp **en gardant son contrôleur** : ouvre le sélecteur du
   * camp, prend « 🎲 Aléatoire », la modale se referme. C'est la façon de lancer un combat que le
   * test peut jouer, le camp 1 restant humain.
   */
  async pickRandomTeam(slotIndex = 0): Promise<void> {
    await this.teamButton(slotIndex).click();
    // Scopé au `<dialog>`, sans quoi le locator est ambigu : les camps IA portent « 🎲 Aléatoire »
    // comme NOM D'ÉQUIPE sur leur propre bouton, donc le même libellé existe des deux côtés.
    await this.page
      .getByRole("dialog")
      .getByRole("button", { name: "🎲 Aléatoire", exact: true })
      .click();
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
