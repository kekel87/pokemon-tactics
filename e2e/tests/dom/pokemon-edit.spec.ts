import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { MainMenu } from "../../pages/MainMenu";
import { MyTeamsScreen, PokemonEdit, PokemonPicker, TeamEditScreen } from "../../pages/teamBuilder";

// Cahier §7.1 / §7.3 — édition d'équipe + fiche d'un Pokemon.

/** Nouvelle équipe → assigne Florizarre au slot 1 → laisse la fiche d'édition ouverte. */
async function openFlorizarreEdit(page: Page): Promise<void> {
  const menu = new MainMenu(page);
  const teams = new MyTeamsScreen(page);
  const slots = new TeamEditScreen(page);
  const picker = new PokemonPicker(page);
  await menu.goto();
  await menu.teamBuilder.click();
  await teams.newTeam.click();
  await slots.slot(1).click();
  await picker.search.fill("flo");
  await picker.cell("Florizarre").click();
  await expect(slots.filledSlot("Florizarre")).toBeVisible();
}

test("§7.3 fiche : Florizarre assigné affiche identité, sections et stats", async ({ page }) => {
  const edit = new PokemonEdit(page);
  await openFlorizarreEdit(page);

  // En-tête : nom FR officiel + genre + bouton Build (set OP).
  await expect(edit.name).toHaveText("Florizarre");
  await expect(edit.genderToggle.first()).toBeVisible();
  await expect(edit.build).toBeVisible();

  // Sections présentes (Talent / Objet / Nature).
  await expect(edit.section("ability")).toBeVisible();
  await expect(edit.section("item")).toBeVisible();
  await expect(edit.section("nature")).toBeVisible();

  // Stats en barres (≥ 6 lignes : PV/Atq/Déf/AtqSpé/DéfSpé/Vit) + presets + 4 moves.
  expect(await edit.statRows.count()).toBeGreaterThanOrEqual(6);
  await expect(edit.presets).toBeVisible();
  await expect(edit.moveRows).toHaveCount(4);
});

test("§7.3 fiche : la Nature offre les 25 natures (select)", async ({ page }) => {
  await openFlorizarreEdit(page);
  const natureSelect = page
    .locator(".tb-edit-section")
    .filter({ has: page.getByTestId("pokemon-edit-section-nature") })
    .locator("select");
  await expect(natureSelect).toBeVisible();
  expect(await natureSelect.locator("option").count()).toBe(25);
});

test("§7.3 fiche : cliquer une capacité ouvre le picker de move", async ({ page }) => {
  await openFlorizarreEdit(page);
  await page.getByTestId("pokemon-edit-move-row").first().click();
  // Modale <dialog> de choix de capacité.
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Choisir la capacité/ })).toBeVisible();
});

test("§7.3 fiche : un preset de stats modifie la répartition", async ({ page }) => {
  await openFlorizarreEdit(page);
  const statsText = () => page.locator(".tb-stat-value").allTextContents();

  await page.getByRole("button", { name: "Reset", exact: true }).click();
  const before = (await statsText()).join("|");
  await page.getByRole("button", { name: "Sweeper Phys", exact: true }).click();
  // La répartition de points change → au moins une valeur de stat diffère.
  await expect.poll(async () => (await statsText()).join("|")).not.toBe(before);
});

test("§7.1 édition : compteur N/6 + « Vider ce slot » remet le slot à vide", async ({ page }) => {
  const slots = new TeamEditScreen(page);
  await openFlorizarreEdit(page);

  await expect(page.locator(".tb-topbar-count")).toHaveText("1/6 Pokémon");

  // Croix « Vider ce slot » du slot rempli (le bouton est frère de la carte, dans `.tb-slot`).
  await page
    .locator(".tb-slot")
    .filter({ hasText: "Florizarre" })
    .getByRole("button", { name: "Vider ce slot" })
    .click();
  await expect(slots.filledSlot("Florizarre")).toHaveCount(0);
  await expect(page.locator(".tb-topbar-count")).toHaveText("0/6 Pokémon");
});
