import { expect, test } from "../../fixtures";
import { MainMenu } from "../../pages/MainMenu";
import { BattleModeScreen, MapSelectScreen } from "../../pages/screens";

// Navigation clavier des écrans de menu (plan 184). Cahier §4.19.
//
// Chaque écran doit s'ENREGISTRER auprès de la couche d'entrée pour que les flèches trouvent un
// consommateur. Le menu principal, lui, ne l'avait pas fait : il n'a pas de « retour » à brancher,
// et il est resté sans registration — donc le premier écran du jeu ignorait le clavier (retour
// humain 2026-08-21). D'où ce parcours qui les vérifie tous plutôt qu'un écran à la fois.

test("§4.19 clavier : le menu principal répond aux flèches", async ({ page }) => {
  const menu = new MainMenu(page);
  await menu.goto();

  await page.keyboard.press("ArrowDown");

  // « Aventure » est la première entrée mais elle est DÉSACTIVÉE : un bouton désactivé n'est pas un
  // arrêt de focus, donc la flèche atterrit sur « Combat ».
  await expect(menu.combat).toBeFocused();
});

test("§4.19 clavier : les flèches bouclent dans le menu principal", async ({ page }) => {
  const menu = new MainMenu(page);
  await menu.goto();

  // Vers le haut depuis rien : on entre par la FIN de la liste, pas par le début.
  await page.keyboard.press("ArrowUp");

  await expect(menu.languageToggle).toBeFocused();
});

test("§4.19 clavier : Espace active l'entrée focalisée du menu principal", async ({ page }) => {
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);
  await menu.goto();

  // « Aventure » est désactivé, donc la première entrée FOCALISABLE est « Combat ».
  await page.keyboard.press("ArrowDown");
  await expect(menu.combat).toBeFocused();
  await page.keyboard.press("Space");

  await expect(mode.title).toBeVisible();
});

test("§4.19 clavier : chaque écran de menu répond aux flèches et à Échap", async ({ page }) => {
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);
  await menu.goto();

  // Mode de combat.
  await menu.combat.click();
  await expect(mode.title).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("button:focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(menu.title).toBeVisible();

  // Réglages.
  await menu.settings.click();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("button:focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(menu.title).toBeVisible();

  // Crédits.
  await menu.credits.click();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("button:focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(menu.title).toBeVisible();

  // Mes équipes.
  await menu.teamBuilder.click();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("button:focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(menu.title).toBeVisible();
});

test("§4.19 clavier : le choix de carte garde ses flèches pour la SÉLECTION", async ({ page }) => {
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);
  const maps = new MapSelectScreen(page);

  await menu.goto();
  await menu.combat.click();
  await mode.local.click();
  await expect(maps.detailName).toHaveText("Arène Simple");

  // Cet écran enregistre son propre consommateur : la flèche déplace la carte sélectionnée, pas le
  // focus DOM.
  await page.keyboard.press("ArrowDown");

  await expect(maps.detailName).not.toHaveText("Arène Simple");
});
