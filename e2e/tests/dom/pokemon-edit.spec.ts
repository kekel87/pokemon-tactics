import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { MainMenu } from "../../pages/MainMenu";
import {
  ItemPicker,
  MyTeamsScreen,
  PokemonEdit,
  PokemonPicker,
  TeamEditScreen,
} from "../../pages/teamBuilder";

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

test("§7.3 fiche : la Nature s'ouvre en liste et offre les 25 natures", async ({ page }) => {
  await openFlorizarreEdit(page);
  // C'était un `<select>` natif ; c'est une liste dans un `<dialog>` depuis le plan 188 (le `<select>`
  // capturait la manette sans jamais s'ouvrir). Le geste est celui des trois autres sélecteurs.
  await page.getByTestId("pokemon-edit-nature-value").click();
  await expect(page.getByTestId("nature-picker-list")).toBeVisible();
  await expect(page.getByTestId("nature-picker-row")).toHaveCount(25);

  // Choisir referme la modale et met le déclencheur à jour.
  const chosen = page.getByTestId("nature-picker-row").nth(3);
  const chosenLabel = ((await chosen.textContent()) ?? "").trim();
  await chosen.click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByTestId("pokemon-edit-nature-value")).toHaveText(chosenLabel);
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
  const edit = new PokemonEdit(page);
  const statsText = () => page.locator(".tb-stat-value").allTextContents();

  // Scopé à la rangée de presets : le chip « Reset » des sélecteurs est un `<button>` depuis le plan
  // 188 (il était un `<div>`), donc un `getByRole` global en trouve désormais deux.
  await edit.presets.getByRole("button", { name: "Reset", exact: true }).click();
  const before = (await statsText()).join("|");
  await edit.presets.getByRole("button", { name: "Sweeper Phys", exact: true }).click();
  // La répartition de points change → au moins une valeur de stat diffère.
  await expect.poll(async () => (await statsText()).join("|")).not.toBe(before);
});

test("§7.3 fiche : le picker d'objet liste un objet boost-de-type et l'assigne au slot", async ({
  page,
}) => {
  const edit = new PokemonEdit(page);
  const picker = new ItemPicker(page);
  await openFlorizarreEdit(page);

  // Slot sans objet par défaut.
  await expect(edit.itemValue).toHaveText("(aucun objet)");

  // Ouvre le picker via le champ « Objet » de la fiche.
  await edit.itemValue.click();
  await expect(picker.title).toBeVisible();

  // Un objet boost-de-type récent (Charbon = charcoal) apparaît et est sélectionnable
  // (implémenté → non grisé).
  const charcoal = picker.row("charcoal");
  await expect(charcoal).toBeVisible();
  // `not.toBeDisabled()` et non `data-state` : `ItemPickerModal` porte la désactivation sur
  // l'ATTRIBUT depuis le plan 188, donc l'ancienne assertion ne pouvait plus échouer.
  await expect(charcoal).not.toBeDisabled();
  await expect(charcoal).toContainText("Charbon");

  // Sélection → modale fermée, champ « Objet » du slot mis à jour avec le nom FR.
  await charcoal.click();
  await expect(picker.dialog).toBeHidden();
  await expect(edit.itemValue).toHaveText("Charbon");
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
