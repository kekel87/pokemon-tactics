import { expect, test } from "../../fixtures";
import { MainMenu } from "../../pages/MainMenu";
import { MyTeamsScreen, PokemonPicker, TeamEditScreen } from "../../pages/teamBuilder";

// Cahier §7.2 — Pokemon Picker. Ancres : Florizarre (Plante/Poison), Dracaufeu (Feu/Vol).
async function openPickerOnSlot1(page: import("@playwright/test").Page): Promise<PokemonPicker> {
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

test("picker : s'ouvre sur un slot vide, liste non filtrée, recherche", async ({ page }) => {
  const picker = await openPickerOnSlot1(page);

  const total = await picker.cells.count();
  expect(total).toBeGreaterThan(10); // liste complète

  await picker.search.fill("flo");
  await expect(picker.cell("Florizarre")).toBeVisible();
  await expect.poll(() => picker.cells.count()).toBeLessThan(total);
});

test("picker : filtres de type (Plante seul, union, re-clic désactive, reset)", async ({
  page,
}) => {
  const picker = await openPickerOnSlot1(page);

  // Type Plante → Florizarre présent, Dracaufeu (Feu) absent.
  await picker.typeChip("grass").click();
  await expect(picker.cell("Florizarre")).toBeVisible();
  await expect(picker.cell("Dracaufeu")).toHaveCount(0);

  // + Feu → union : les deux présents.
  await picker.typeChip("fire").click();
  await expect(picker.cell("Florizarre")).toBeVisible();
  await expect(picker.cell("Dracaufeu")).toBeVisible();

  // Re-clic Plante → désactive Plante : Florizarre (Plante pure ici) disparaît, Dracaufeu reste.
  await picker.typeChip("grass").click();
  await expect(picker.cell("Dracaufeu")).toBeVisible();
  await expect(picker.cell("Florizarre")).toHaveCount(0);

  // Reset → filtres vidés, Florizarre revient.
  await picker.reset.click();
  await expect(picker.cell("Florizarre")).toBeVisible();
});

test("picker : choisir un Pokemon, grisé dans un autre slot, fermeture", async ({ page }) => {
  const picker = await openPickerOnSlot1(page);
  const edit = new TeamEditScreen(page);

  await picker.search.fill("flo");
  await picker.cell("Florizarre").click();

  // Modale fermée, slot 1 rempli.
  await expect(picker.dialog).toBeHidden();
  await expect(edit.filledSlot("Florizarre")).toBeVisible();

  // Slot 2 → le picker rouvre, Florizarre grisé (déjà pris).
  await edit.slot(2).click();
  await expect(picker.title).toBeVisible();
  await expect(picker.cell("Florizarre")).toHaveAttribute("data-state", "disabled");

  // Fermeture via la croix.
  await picker.close.click();
  await expect(picker.dialog).toBeHidden();
});
