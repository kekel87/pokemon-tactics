import { expect, test } from "../../fixtures";
import { MainMenu } from "../../pages/MainMenu";
import { AdventureScreen } from "../../pages/screens";

// Cahier §6.1 / §6.2 — verrou du mode Aventure (plan 251) : fermé sans `?aventure=1`, ouvert avec.

test("§6.1 Aventure : désactivée sans paramètre, nom accessible « Aventure Bientôt »", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  await menu.goto();

  await expect(menu.adventure).toBeDisabled();
  await expect(menu.adventure).toHaveAccessibleName("Aventure Bientôt");
});

test("§6.1 Aventure : ouverte par ?aventure=1, écran dédié, Retour au menu, pas de restauration", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  const adventure = new AdventureScreen(page);
  await menu.goto("?aventure=1");

  await expect(menu.adventure).toBeEnabled();
  await expect(menu.adventure).toHaveAccessibleName("Aventure");

  await menu.adventure.click();
  await expect(adventure.title).toBeVisible();
  await expect(adventure.newAdventure).toBeDisabled();

  await adventure.back.click();
  await expect(menu.title).toBeVisible();

  // Rouvert, puis rechargé : l'écran Aventure n'est jamais restauré (il contournerait le verrou).
  await menu.adventure.click();
  await expect(adventure.title).toBeVisible();
  await page.reload();
  await page.getByTestId("splash").waitFor({ state: "detached" });
  await expect(menu.title).toBeVisible();
  await expect(adventure.title).toHaveCount(0);
});

test("§4.19 clavier : avec ?aventure=1, la première flèche focalise Aventure", async ({ page }) => {
  const menu = new MainMenu(page);
  await menu.goto("?aventure=1");

  await page.keyboard.press("ArrowDown");

  await expect(menu.adventure).toBeFocused();
});
