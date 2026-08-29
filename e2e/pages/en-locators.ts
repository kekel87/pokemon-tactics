import type { Locator, Page } from "@playwright/test";

/*
 * Localisateurs ANGLAIS des écrans, écrits pour la séquence d'intro (plan 194) puis partagés avec
 * les specs qui vérifient l'i18n des écrans de préparation — d'où sa place ici et non dans
 * `e2e/capture/`.
 *
 * Les autres POMs de `e2e/pages/` codent les libellés en **français** — c'est leur contrat : le
 * projet est FR-first et la suite e2e tourne en `fr-FR`. La vidéo et les captures, elles, visent
 * itch.io et le README, donc l'anglais (demande de l'humain 2026-08-27).
 *
 * D'où ce module plutôt qu'une modification des POMs partagés : les toucher ferait basculer 519 tests
 * dans une langue qu'ils n'attendent pas. Les libellés ci-dessous sont **relevés dans
 * `packages/app/src/i18n/locales/en.ts`**, jamais traduits au jugé — « Select this map » et non
 * « Choose this map », « Start ▶ » et non « Launch ».
 *
 * ⚠️ Les AJOUTS doivent être des localisateurs par libellé : c'est la raison d'être du fichier.
 * Les localisateurs par `data-testid` qu'on y trouve encore (`mapDetailName`, `formatSegments`,
 * les cartes d'équipe…) sont un reliquat de la capture d'intro, et deux doublonnent des POMs de
 * `screens.ts` — indépendants de la langue, ils auraient leur place là-bas.
 */
export class EnglishScreens {
  constructor(private readonly page: Page) {}

  // --- Menu principal (clés `menu.*`)
  get battle(): Locator {
    return this.page.getByRole("button", { name: "Battle", exact: true });
  }

  // --- Mode de combat (`battleMode.*`)
  get local(): Locator {
    return this.page.getByRole("button", { name: "Local", exact: true });
  }

  // --- Choix de la carte (`mapSelect.confirm`)
  get confirmMap(): Locator {
    return this.page.getByRole("button", { name: "Select this map", exact: true });
  }
  get mapDetailName(): Locator {
    return this.page.getByTestId("map-detail-name");
  }

  // --- Sélection d'équipe (`teamSelect.actions.launch`)
  get launch(): Locator {
    return this.page.getByRole("button", { name: "Start ▶", exact: true });
  }
  get formatSegments(): Locator {
    return this.page.getByTestId("format-segments");
  }

  // --- Éditeur d'équipe
  teamCard(name: string): Locator {
    return this.page.getByTestId("team-card").filter({ hasText: name });
  }
  filledSlot(pokemonEn: string): Locator {
    return this.page.getByTestId("team-slot-card").filter({ hasText: pokemonEn });
  }
  get pokemonName(): Locator {
    return this.page.getByTestId("pokemon-edit-name");
  }
  get statRows(): Locator {
    return this.page.getByTestId("pokemon-edit-stat-row");
  }
  get moveRows(): Locator {
    return this.page.getByTestId("pokemon-edit-move-row");
  }

  /** Les sélecteurs sont des `<dialog>` ; leur titre varie, on s'appuie sur le rôle. */
  get dialog(): Locator {
    return this.page.getByRole("dialog");
  }
  get dialogSearch(): Locator {
    return this.dialog.getByPlaceholder("Search…");
  }
  get pokemonCells(): Locator {
    return this.page.getByTestId("pokemon-cell");
  }
}
