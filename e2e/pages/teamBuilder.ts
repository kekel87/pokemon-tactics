import type { Locator, Page } from "@playwright/test";

// Locators follow the Playwright priority: getByRole for real controls, getByText for user-facing
// labels, getByTestId only where neither fits (data rows / non-semantic clickable divs).

/** Mes équipes — liste des équipes sauvegardées (`teamBuilder.*`). */
export class MyTeamsScreen {
  readonly newTeam: Locator;
  readonly generateRandom: Locator;
  readonly cards: Locator;
  constructor(page: Page) {
    this.newTeam = page.getByRole("button", { name: "+ Nouvelle équipe" });
    this.generateRandom = page.getByRole("button", { name: "Générer aléatoire" });
    this.cards = page.getByTestId("team-card");
  }

  /** A saved-team card by its (unique) name. */
  card(name: string): Locator {
    return this.cards.filter({ hasText: name });
  }
}

/** Read the persisted teams blob (`pokemon-tactics:teams`). */
export function readStoredTeams(page: Page): Promise<string | null> {
  return page.evaluate(() => localStorage.getItem("pokemon-tactics:teams"));
}

/** Édition d'une équipe (slots + topbar). */
export class TeamEditScreen {
  readonly clearAll: Locator;
  readonly nameInput: Locator;
  readonly back: Locator;
  constructor(private readonly page: Page) {
    this.clearAll = page.getByRole("button", { name: "Tout vider" });
    this.nameInput = page.getByTestId("team-name-input");
    this.back = page.getByRole("button", { name: "← Retour" });
  }

  /** Empty slot N (1-based). Accessible name is "+ Slot N" (the plus is inside the button). */
  slot(n: number): Locator {
    return this.page.getByRole("button", { name: `Slot ${n}` });
  }

  /** A filled slot by Pokemon FR name (slot card carries the species + type labels). */
  filledSlot(pokemonFr: string): Locator {
    return this.page.getByTestId("team-slot-card").filter({ hasText: pokemonFr });
  }
}

/** Fiche d'édition d'un Pokemon (§7.3) — panneaux gauche/droite affichés sous les slots une fois
 *  un Pokemon assigné au slot actif. */
export class PokemonEdit {
  readonly name: Locator;
  readonly genderToggle: Locator;
  readonly build: Locator;
  readonly statRows: Locator;
  readonly presets: Locator;
  readonly moveRows: Locator;
  readonly itemValue: Locator;
  constructor(private readonly page: Page) {
    this.name = page.getByTestId("pokemon-edit-name");
    this.genderToggle = page.getByRole("button", { name: /[♂♀]/ });
    this.build = page.getByRole("button", { name: "Build", exact: true });
    this.statRows = page.getByTestId("pokemon-edit-stat-row");
    this.presets = page.getByTestId("pokemon-edit-presets");
    this.moveRows = page.getByTestId("pokemon-edit-move-row");
    this.itemValue = page.getByTestId("pokemon-edit-item-value");
  }

  /** A section title by key — "ability" | "item" | "nature" (the label is CSS-uppercased, so we
   *  locate by testid, not by the rendered text). */
  section(key: "ability" | "item" | "nature"): Locator {
    return this.page.getByTestId(`pokemon-edit-section-${key}`);
  }
}

/** Pokemon Picker modale (`<dialog>` → rôle `dialog`). Les puces/cellules sont des divs cliquables
 *  sans rôle → `data-testid` ; titre/recherche/boutons restent user-facing (rôle/placeholder/texte). */
export class PokemonPicker {
  readonly dialog: Locator;
  readonly title: Locator;
  readonly close: Locator;
  readonly search: Locator;
  readonly reset: Locator;
  readonly cells: Locator;
  constructor(private readonly page: Page) {
    this.dialog = page.getByRole("dialog");
    this.title = page.getByRole("heading", { name: "Choisir un Pokémon" });
    this.close = page.getByRole("button", { name: "Fermer" });
    this.search = page.getByPlaceholder("Rechercher…");
    this.reset = page.getByText("Reset", { exact: true });
    this.cells = page.getByTestId("pokemon-cell");
  }

  /** A pokemon grid cell by FR name. */
  cell(pokemonFr: string): Locator {
    return this.cells.filter({ hasText: pokemonFr });
  }

  /** A type filter chip by its data-type (English type id, e.g. "grass"). */
  typeChip(type: string): Locator {
    return this.page
      .getByTestId("pokemon-type-filter")
      .and(this.page.locator(`[data-type="${type}"]`));
  }
}

/** Item Picker modale (`<dialog>` → rôle `dialog`, titre « Choisir un objet »). Les lignes d'objet
 *  sont des divs cliquables sans rôle → `data-testid` (data row) ; le nom de l'objet reste le texte
 *  user-facing de la ligne, ciblé via `data-item-id` (id EN stable, indépendant de l'i18n). */
export class ItemPicker {
  readonly dialog: Locator;
  readonly title: Locator;
  readonly close: Locator;
  readonly rows: Locator;
  constructor(private readonly page: Page) {
    this.dialog = page.getByRole("dialog");
    this.title = page.getByRole("heading", { name: "Choisir un objet" });
    this.close = page.getByRole("button", { name: "Fermer" });
    this.rows = page.getByTestId("item-picker-row");
  }

  /** An item row by its (stable EN) held-item id, e.g. "charcoal". */
  row(itemId: string): Locator {
    return this.rows.and(this.page.locator(`[data-item-id="${itemId}"]`));
  }
}
