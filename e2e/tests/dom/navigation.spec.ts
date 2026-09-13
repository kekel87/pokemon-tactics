import { expect, test } from "../../fixtures";
import { MainMenu } from "../../pages/MainMenu";
import { BattleModeScreen, TeamSelectScreen } from "../../pages/screens";

test("menu → mode de combat → sélection d'équipe → retour", async ({ page }) => {
  const menu = new MainMenu(page);
  const battleMode = new BattleModeScreen(page);
  const teamSelect = new TeamSelectScreen(page);

  await menu.goto();
  await menu.combat.click();
  await expect(battleMode.title).toBeVisible();
  await expect(battleMode.local).toBeVisible();

  // 🔴 Plus d'escale sur le choix du terrain (plan 208) : « Jeu en solo » entre droit dans la
  // sélection d'équipe, et son « Retour » rend directement au mode de combat — un cran d'historique
  // de moins, ce que le geste de retour du téléphone doit suivre (plan 205).
  await battleMode.local.click();
  await expect(teamSelect.title).toBeVisible();

  await teamSelect.back.click();
  await expect(battleMode.title).toBeVisible();

  await battleMode.back.click();
  await expect(menu.combat).toBeVisible();
});
