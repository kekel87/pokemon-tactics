import { expect, test } from "../../fixtures";
import { MainMenu } from "../../pages/MainMenu";
import { SettingsScreen } from "../../pages/screens";

// Cahier §6.7. La seule option INCONDITIONNELLE depuis le plan 198 (« Prévisualisation dégâts » est
// partie à la sélection d'équipe) ; les lignes conditionnées à la plateforme (« Plein écran »,
// « Installer l'app ») sont en §6.10 (`platform.spec`).
test("paramètres : l'option de base (libellé FR), retour au menu", async ({ page }) => {
  const menu = new MainMenu(page);
  const settings = new SettingsScreen(page);
  await menu.goto();
  await menu.settings.click();

  await expect(settings.title).toBeVisible();
  // Libellé user-facing → getByText (pas de testid nécessaire).
  await expect(page.getByText("Langue", { exact: true })).toBeVisible();
  // Partie à l'écran de sélection d'équipe (plan 198, décision #893) : elle ne doit plus être ici.
  await expect(page.getByText("Prévisualisation dégâts", { exact: true })).toHaveCount(0);

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
