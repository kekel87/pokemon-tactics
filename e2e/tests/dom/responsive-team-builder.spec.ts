import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { MainMenu } from "../../pages/MainMenu";
import { Responsive, TEAM_BUILDER_ROOT, TEAM_BUILDER_SCROLLERS } from "../../pages/responsive";
import {
  ItemPicker,
  MovePicker,
  MyTeamsScreen,
  PokemonEdit,
  PokemonPicker,
  TeamEditScreen,
} from "../../pages/teamBuilder";

// Cahier §7.5 — Team Builder et ses sélecteurs sur téléphone paysage (plan 179). Ce qui est testé
// est *atteignable ou mesurable* : une modale plus haute que l'écran, une grille de résultats à 0px,
// deux chips du même composant qui ne font pas la même taille. L'esthétique reste 👁.
//
// Les assertions sont regroupées par ÉTAT (un boot = app + bundle de sprites), pas une par test :
// le projet `dom` tourne en parallèle et chaque boot de trop rapproche les autres specs de leur
// budget de temps.

/** Téléphone en paysage (l'orientation que le jeu impose). */
const PHONE_LANDSCAPE = { width: 851, height: 393 };

/** Menu → Constructeur d'équipe → nouvelle équipe (6 slots vides, slot 1 actif). */
const openNewTeam = async (page: Page): Promise<TeamEditScreen> => {
  const menu = new MainMenu(page);
  const teams = new MyTeamsScreen(page);
  const slots = new TeamEditScreen(page);
  await menu.goto();
  await menu.teamBuilder.click();
  await teams.newTeam.click();
  await expect(slots.slot(1)).toBeVisible();
  return slots;
};

/** …puis assigne un Pokemon au slot 1, ce qui ouvre sa fiche d'édition sous la rangée de slots. */
const fillSlot1 = async (page: Page, search: string, nameFr: string): Promise<TeamEditScreen> => {
  const slots = await openNewTeam(page);
  const picker = new PokemonPicker(page);
  await slots.slot(1).click();
  await picker.search.fill(search);
  await picker.cell(nameFr).click();
  await expect(slots.filledSlot(nameFr)).toBeVisible();
  return slots;
};

test.describe("§7.5 Team Builder sur téléphone paysage", () => {
  test.use({ viewport: PHONE_LANDSCAPE });

  // Ancre : Ectoplasma (SPECTRE + POISON), le cas qui a révélé les trois défauts ci-dessous.
  test("§7.5 slots à largeur égale, chips de type unifiées, rien hors viewport", async ({
    page,
  }) => {
    const slots = await fillSlot1(page, "ecto", "Ectoplasma");
    const responsive = new Responsive(page);

    // Régression du plan : `repeat(6, 1fr)` vaut `minmax(auto, 1fr)`, dont le minimum est la largeur
    // min-content de la carte — deux types longs élargissaient donc leur colonne, les 6 slots
    // n'avaient plus la même largeur et le 6e sortait de l'écran.
    const cards = await page.getByTestId("team-slot-card").all();
    expect(cards).toHaveLength(6);
    const widths: number[] = [];
    for (const card of cards) {
      widths.push((await card.boundingBox())?.width ?? Number.NaN);
    }
    for (const width of widths) {
      expect(width).toBeCloseTo(widths[0] ?? Number.NaN, 0);
    }
    await expect(page.getByTestId("team-slot-card").nth(5)).toBeInViewport({ ratio: 1 });
    await expect(slots.filledSlot("Ectoplasma")).toBeInViewport({ ratio: 1 });

    // Le Team Builder rend ses types via le composant partagé `type-chip` depuis le 2026-08-06
    // (`.tb-type-badge` supprimé). Deux hôtes distincts (carte de slot, panneau d'édition) → deux
    // occasions de dériver : elles faisaient 22px contre 28px de haut. Assertion purement relative.
    const cardChip = await responsive.metrics(".tb-slot-card .type-chip");
    const editChip = await responsive.metrics(".tb-edit-sub .type-chip");
    expect(cardChip?.height).toBeCloseTo(editChip?.height ?? Number.NaN, 0);
    expect(cardChip?.fontSize).toBeCloseTo(editChip?.fontSize ?? Number.NaN, 0);

    // Hors de `#game-stage` il n'y a pas de `--ui-scale` : sans le fallback `1`, `--type-chip-px`
    // devient invalide, l'icône retombe sur `inline-size: auto` et s'affiche à sa taille native (le
    // symptôme rapporté : « chips énormes »). Le contrat homothétique du composant est
    // `icône = 16 × --type-chip-px` pour `police = 20 × --type-chip-px`, soit un rapport de 0,8 —
    // un invariant sans nombre magique, qui casse dès que l'unité ne résout plus.
    const icon = await responsive.metrics(".tb-edit-sub .type-chip-icon");
    expect(icon?.width).toBeCloseTo(0.8 * (editChip?.fontSize ?? Number.NaN), 1);

    await expect
      .poll(() => responsive.elementsOutsideViewport(TEAM_BUILDER_ROOT, TEAM_BUILDER_SCROLLERS))
      .toEqual([]);
  });
});

test.describe("§7.5 sélecteur de Pokemon sur écran court", () => {
  test.use({ viewport: PHONE_LANDSCAPE });

  test("§7.5 grille atteignable, puces sur une ligne en FR, modale dans l'écran", async ({
    page,
  }) => {
    const slots = await openNewTeam(page);
    const picker = new PokemonPicker(page);
    await slots.slot(1).click();
    await expect(picker.title).toBeVisible();

    // Le bug du plan : les filtres passaient sur ~5 lignes et écrasaient la grille de résultats à
    // 0px de haut — aucune cellule atteignable, sélecteur inutilisable.
    await expect(picker.cells.first()).toBeInViewport({ ratio: 1 });

    // Correctif retenu : une seule ligne défilable horizontalement plutôt que des puces rétrécies.
    // Signal indépendant du CSS : toutes les puces de type partagent la même ordonnée.
    const chips = await picker.typeChips.all();
    expect(chips.length).toBeGreaterThan(1);
    const tops = new Set<number>();
    for (const chip of chips) {
      tops.add(Math.round((await chip.boundingBox())?.y ?? Number.NaN));
    }
    expect([...tops]).toHaveLength(1);

    // Ces puces étaient le dernier endroit de l'UI à afficher les ids anglais (« Grass », « Dark »).
    await expect(picker.typeChip("grass")).toHaveText("Plante");
    await expect(picker.typeChip("dark")).toHaveText("Ténèbres");

    // La dialog est plafonnée à `100dvh` et son en-tête est collant : le bouton de fermeture reste
    // atteignable quoi qu'il arrive, sinon la modale est un cul-de-sac.
    await expect(picker.dialog).toBeInViewport({ ratio: 1 });
    await expect(picker.close).toBeInViewport({ ratio: 1 });

    // Confort clavier-souris conservé : le champ de recherche prend le focus à l'ouverture. La
    // contre-épreuve au doigt est le test suivant.
    await expect(picker.search).toBeFocused();
  });
});

test.describe("§7.5 sélecteur de Pokemon au doigt", () => {
  test.use({ viewport: PHONE_LANDSCAPE, hasTouch: true });

  // Le clavier virtuel recouvrait la quasi-totalité de la modale, donc la liste qu'on venait
  // consulter. Le critère du focus automatique est le **pointeur**, pas la taille de l'écran.
  test("§7.5 sur pointeur grossier, le champ de recherche ne prend PAS le focus", async ({
    page,
  }) => {
    const slots = await openNewTeam(page);
    const picker = new PokemonPicker(page);
    await slots.slot(1).click();
    await expect(picker.title).toBeVisible();

    await expect(picker.search).not.toBeFocused();
  });
});

test.describe("§7.5 sélecteur de capacité sur écran court", () => {
  test.use({ viewport: PHONE_LANDSCAPE });

  test("§7.5 les puces de type du sélecteur de capacité portent leur nom FR sur une ligne", async ({
    page,
  }) => {
    await fillSlot1(page, "flo", "Florizarre");
    const edit = new PokemonEdit(page);
    const movePicker = new MovePicker(page);
    await edit.moveRows.first().click();
    await expect(movePicker.title).toBeVisible();

    // Florizarre a des capacités Plante → la puce existe, en FR.
    await expect(movePicker.typeChip("grass")).toHaveText("Plante");

    const chips = await movePicker.typeChips.all();
    expect(chips.length).toBeGreaterThan(1);
    const tops = new Set<number>();
    for (const chip of chips) {
      tops.add(Math.round((await chip.boundingBox())?.y ?? Number.NaN));
    }
    expect([...tops]).toHaveLength(1);
  });
});

test.describe("§7.5 sélecteur d'objet sur écran court", () => {
  test.use({ viewport: PHONE_LANDSCAPE });

  // Icône officielle demandée dans les lignes du sélecteur ET dans le champ « objet tenu ». Signal
  // sémantique plutôt que pixel : le crop de la planche fait 24px de large, et l'objet sans icône
  // retombe sur un pixel transparent 1×1 — `naturalWidth` distingue les deux sans lire l'image.
  test("§7.5 les lignes du sélecteur et le champ « objet tenu » montrent l'icône de l'objet", async ({
    page,
  }) => {
    await fillSlot1(page, "flo", "Florizarre");
    const edit = new PokemonEdit(page);
    const picker = new ItemPicker(page);
    await edit.itemValue.click();
    await expect(picker.title).toBeVisible();

    const rowIcon = picker.row("charcoal").locator("img");
    await expect.poll(() => rowIcon.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(24);

    await picker.row("charcoal").click();
    await expect(picker.dialog).toBeHidden();
    const fieldIcon = edit.itemValue.locator("img");
    await expect
      .poll(() => fieldIcon.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBe(24);
  });
});

test.describe("§7.5 modale Showdown sur écran court", () => {
  test.use({ viewport: PHONE_LANDSCAPE });

  // La dernière modale à déborder : le plancher de 240px de son `<textarea>` suffisait à la pousser
  // hors écran, emportant son en-tête — donc son bouton de fermeture — sur un écran de 393px.
  test("§7.5 la modale d'import/export tient dans l'écran, fermeture atteignable", async ({
    page,
  }) => {
    await openNewTeam(page);
    await page.getByRole("button", { name: "⇄ Showdown" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await expect(dialog).toBeInViewport({ ratio: 1 });
    await expect(dialog.getByRole("button", { name: "Fermer" })).toBeInViewport({ ratio: 1 });
  });
});
