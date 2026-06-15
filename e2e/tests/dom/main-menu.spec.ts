import { expect, test } from "../../fixtures";
import { MainMenu } from "../../pages/MainMenu";

// Cahier §6.1.
test("menu principal : titre, 5 entrées FR, Aventure désactivée, version", async ({ page }) => {
  const menu = new MainMenu(page);
  await menu.goto();

  await expect(menu.title).toBeVisible();
  await expect(menu.adventure).toBeVisible();
  await expect(menu.combat).toBeVisible();
  await expect(menu.teamBuilder).toBeVisible();
  await expect(menu.settings).toBeVisible();
  await expect(menu.credits).toBeVisible();

  await expect(menu.adventure).toBeDisabled();
  await expect(menu.version).toBeVisible();
});

test("menu principal : bascule FR → EN (libellés + localStorage pt-lang)", async ({ page }) => {
  const menu = new MainMenu(page);
  await menu.goto();

  await expect(menu.languageToggle).toHaveText("FR");
  await menu.languageToggle.click();

  await expect(menu.languageToggle).toHaveText("EN");
  await expect(page.getByRole("button", { name: "Adventure", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Battle", exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("pt-lang"))).toBe("en");
});
