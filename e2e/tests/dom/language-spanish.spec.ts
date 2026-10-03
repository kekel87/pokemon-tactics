import { expect, test } from "../../fixtures";
import { MainMenu } from "../../pages/MainMenu";
import { SettingsScreen } from "../../pages/screens";

// Cahier §6.1 / §6.7 — l'espagnol, troisième langue (plan 222). Le bouton de langue fait le tour
// FR → EN → ES → FR ; chaque tour retraduit les libellés et persiste `pt-lang`. L'ordre exact du
// tour et la détection par langue du navigateur sont couverts en unitaire (`i18n/index.test.ts`) :
// ici, seul le câblage de bout en bout.

test("menu principal : l'espagnol se choisit, persiste au rechargement, et le tour revient au français", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  await menu.goto();

  await menu.selectLanguage("ES");
  await expect(page.getByRole("button", { name: "Combate", exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("pt-lang"))).toBe("es");
  // `<html lang>` suit la langue du jeu (lecteurs d'écran, traduction automatique du navigateur).
  await expect(page.locator("html")).toHaveAttribute("lang", "es");

  await menu.goto();
  await expect(menu.languageToggle).toHaveText("ES");

  await menu.languageToggle.click();
  await expect(menu.languageToggle).toHaveText("FR");
  await expect(menu.combat).toBeVisible();
});

test("paramètres : le réglage de langue passe à l'espagnol puis revient au français", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  const settings = new SettingsScreen(page);
  await menu.goto();
  await menu.settings.click();

  await settings.languageToggle.click(); // FR → EN
  await settings.languageToggle.click(); // EN → ES
  await expect(settings.languageToggle).toHaveText("ES");
  await expect(page.getByRole("heading", { name: "Ajustes" })).toBeVisible();

  await settings.languageToggle.click(); // ES → FR
  await expect(settings.title).toBeVisible();
});

test.describe("première visite, navigateur en espagnol", () => {
  test.use({ locale: "es-ES" });

  test("le jeu s'ouvre directement en espagnol", async ({ page }) => {
    const menu = new MainMenu(page);
    await menu.goto();

    await expect(menu.languageToggle).toHaveText("ES");
  });
});
