import { expect, test } from "../../fixtures";
import { MainMenu } from "../../pages/MainMenu";
import { SettingsScreen } from "../../pages/screens";

// Cahier §6.7.
test("paramètres : 2 options (libellés FR), retour au menu", async ({ page }) => {
  const menu = new MainMenu(page);
  const settings = new SettingsScreen(page);
  await menu.goto();
  await menu.settings.click();

  await expect(settings.title).toBeVisible();
  // Les 2 libellés sont du texte user-facing → getByText (pas de testid nécessaire).
  await expect(page.getByText("Langue", { exact: true })).toBeVisible();
  await expect(page.getByText("Prévisualisation dégâts", { exact: true })).toBeVisible();

  await settings.back.click();
  await expect(menu.combat).toBeVisible();
});

test("paramètres : la langue persiste en localStorage et bascule les libellés", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  const settings = new SettingsScreen(page);
  await menu.goto();
  await menu.settings.click();

  await settings.languageToggle.click();

  expect(await page.evaluate(() => localStorage.getItem("pt-lang"))).toBe("en");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
});

test("paramètres : la prévisualisation des dégâts persiste en localStorage (pt-settings)", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  const settings = new SettingsScreen(page);
  await menu.goto();
  await menu.settings.click();

  await settings.damagePreviewToggle.click();

  const stored = await page.evaluate(() => localStorage.getItem("pt-settings"));
  expect(stored).toBeTruthy();
  expect(JSON.parse(stored ?? "{}")).toHaveProperty("damagePreview");
});
