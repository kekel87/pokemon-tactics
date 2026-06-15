import { expect, test } from "../../fixtures";
import { MainMenu } from "../../pages/MainMenu";
import { CreditsScreen } from "../../pages/screens";

// Cahier §6.8.
test("crédits : titre + contenu (disclaimer) + retour", async ({ page }) => {
  const menu = new MainMenu(page);
  const credits = new CreditsScreen(page);
  await menu.goto();
  await menu.credits.click();

  await expect(credits.title).toBeVisible();
  await expect(credits.disclaimer).toBeVisible();

  await credits.back.click();
  await expect(menu.combat).toBeVisible();
});

test("crédits : titre en anglais après bascule de langue", async ({ page }) => {
  const menu = new MainMenu(page);
  await menu.goto();
  await menu.languageToggle.click(); // FR → EN

  await page.getByRole("button", { name: "Credits", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Credits" })).toBeVisible();
});
