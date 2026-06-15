import { expect, test } from "../../fixtures";
import { MainMenu } from "../../pages/MainMenu";
import { SettingsScreen } from "../../pages/screens";

// Cahier §6.7.
test("paramètres : 3 options (libellés FR), retour au menu", async ({ page }) => {
  const menu = new MainMenu(page);
  const settings = new SettingsScreen(page);
  await menu.goto();
  await menu.settings.click();

  await expect(settings.title).toBeVisible();
  // Les 3 libellés sont du texte user-facing → getByText (pas de testid nécessaire).
  await expect(page.getByText("Langue", { exact: true })).toBeVisible();
  await expect(page.getByText("Prévisualisation dégâts", { exact: true })).toBeVisible();
  await expect(page.getByText("Curseur", { exact: true })).toBeVisible();

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

// §6.7 — l'aperçu du curseur (image) change à chaque cycle.
test("§6.7 curseur : l'aperçu change au cycle + persiste (pt-settings)", async ({ page }) => {
  const menu = new MainMenu(page);
  const settings = new SettingsScreen(page);
  await menu.goto();
  await menu.settings.click();

  const cursorImg = settings.cursorToggle.locator("img");
  const before = await cursorImg.getAttribute("src");
  await settings.cursorToggle.click();
  await expect(cursorImg).not.toHaveAttribute("src", before ?? "");

  const stored = await page.evaluate(() => localStorage.getItem("pt-settings"));
  expect(JSON.parse(stored ?? "{}")).toHaveProperty("hoverCursorKey");
});
