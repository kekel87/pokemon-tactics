import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { MainMenu } from "../../pages/MainMenu";
import {
  ItemPicker,
  MovePicker,
  MyTeamsScreen,
  PokemonEdit,
  PokemonPicker,
  TeamEditScreen,
} from "../../pages/teamBuilder";

// Cahier §7.2 — recherche bilingue tolérante aux accents/séparateurs (`team/search-index.ts`).
// En UI française, un nom anglais, sans accent ou sans espace/tiret doit matcher le résultat FR.

/** New team → open the Pokemon picker on slot 1. */
async function openPokemonPicker(page: Page): Promise<PokemonPicker> {
  const menu = new MainMenu(page);
  const teams = new MyTeamsScreen(page);
  const edit = new TeamEditScreen(page);
  const picker = new PokemonPicker(page);
  await menu.goto();
  await menu.teamBuilder.click();
  await teams.newTeam.click();
  await edit.slot(1).click();
  await expect(picker.title).toBeVisible();
  return picker;
}

/** New team → assign Florizarre to slot 1, leaving its edit sheet open. */
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

test("§7.2 recherche Pokemon : sans accent et nom EN matchent le résultat FR (Léviator)", async ({
  page,
}) => {
  const picker = await openPokemonPicker(page);
  const total = await picker.cells.count();

  // Sans accent : "leviator" → Léviator (é normalisé).
  await picker.search.fill("leviator");
  await expect(picker.cell("Léviator")).toBeVisible();
  await expect.poll(() => picker.cells.count()).toBeLessThan(total);

  // Nom anglais : "gyarados" → Léviator (haystack bilingue FR+EN+id).
  await picker.search.fill("gyarados");
  await expect(picker.cell("Léviator")).toBeVisible();
});

test("§7.2 recherche capacité : nom EN matche le résultat FR (vinewhip → Fouet Lianes)", async ({
  page,
}) => {
  await openFlorizarreEdit(page);
  const move = new MovePicker(page);

  // Ouvre le picker de capacité via la 1re ligne de move de la fiche.
  await page.getByTestId("pokemon-edit-move-row").first().click();
  await expect(move.title).toBeVisible();

  await move.search.fill("vinewhip");
  await expect(move.entry("Fouet Lianes")).toBeVisible();
});

test("§7.2 recherche objet : nom EN matche le résultat FR (charcoal → Charbon)", async ({
  page,
}) => {
  const edit = new PokemonEdit(page);
  const item = new ItemPicker(page);
  await openFlorizarreEdit(page);

  // Ouvre le picker d'objet via le champ « Objet » de la fiche.
  await edit.itemValue.click();
  await expect(item.title).toBeVisible();

  await item.search.fill("charcoal");
  await expect(item.row("charcoal")).toBeVisible();
  await expect(item.row("charcoal")).toContainText("Charbon");
});
