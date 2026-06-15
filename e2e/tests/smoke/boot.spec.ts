import { expect, test } from "../../fixtures";
import { MainMenu } from "../../pages/MainMenu";

test("boote sur le menu principal", async ({ page }) => {
  const menu = new MainMenu(page);
  await menu.goto();

  await expect(menu.combat).toBeVisible();
  await expect(menu.teamBuilder).toBeVisible();
  await expect(menu.settings).toBeVisible();
});
