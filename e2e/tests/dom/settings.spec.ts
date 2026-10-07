import { expect, test } from "../../fixtures";
import { focusedTestId } from "../../pages/gamepad";
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

// Cahier — plan 233. « Vitesse des combats » défile ses trois crans, s'écrit dans `pt-settings` et
// survit à une NOUVELLE NAVIGATION : une sortie/retour relirait la copie en mémoire de
// `updateSettings`, un nouveau chargement de page force `initSettings()` à repeupler depuis le
// magasin. On ressort d'abord au menu : l'écran courant est lui-même persisté, un rechargement
// depuis Paramètres rouvrirait Paramètres.
test("paramètres : la vitesse des combats défile ses trois crans et persiste au rechargement", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  const settings = new SettingsScreen(page);
  await menu.goto();
  await menu.settings.click();

  await expect(page.getByText("Vitesse des combats", { exact: true })).toBeVisible();
  await expect(settings.combatSpeedToggle).toHaveText("NORMALE");

  for (const label of ["RAPIDE", "INSTANTANÉE", "NORMALE", "RAPIDE"]) {
    await settings.combatSpeedToggle.click();
    await expect(settings.combatSpeedToggle).toHaveText(label);
  }

  await settings.back.click();
  await menu.goto();
  await menu.settings.click();
  await expect(settings.combatSpeedToggle).toHaveText("RAPIDE");
});

// Plan 233, `.claude/rules/multi-input.md` : la ligne est atteinte aux FLÈCHES depuis sa voisine
// « Contrôles » — on ne focalise jamais la cible elle-même, ce qui court-circuiterait la navigation
// spatiale qu'on veut prouver. Entrée l'active comme un clic.
test("paramètres : les flèches atteignent la vitesse des combats, Entrée la fait défiler", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  const settings = new SettingsScreen(page);
  await menu.goto();
  await menu.settings.click();

  await settings.controls.focus();
  await page.keyboard.press("ArrowUp");
  expect(await focusedTestId(page)).toBe("setting-combat-speed");

  await page.keyboard.press("Enter");
  await expect(settings.combatSpeedToggle).toHaveText("RAPIDE");
  expect(await focusedTestId(page)).toBe("setting-combat-speed");
});
