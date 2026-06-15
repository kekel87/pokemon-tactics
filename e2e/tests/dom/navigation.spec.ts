import { expect, test } from "../../fixtures";
import { MainMenu } from "../../pages/MainMenu";
import { BattleModeScreen, MapSelectScreen } from "../../pages/screens";

test("menu → mode de combat → choix carte → retour", async ({ page }) => {
  const menu = new MainMenu(page);
  const battleMode = new BattleModeScreen(page);
  const mapSelect = new MapSelectScreen(page);

  await menu.goto();
  await menu.combat.click();
  await expect(battleMode.title).toBeVisible();
  await expect(battleMode.local).toBeVisible();

  await battleMode.local.click();
  await expect(mapSelect.title).toBeVisible();

  await mapSelect.back.click();
  await expect(battleMode.title).toBeVisible();

  await battleMode.back.click();
  await expect(menu.combat).toBeVisible();
});
