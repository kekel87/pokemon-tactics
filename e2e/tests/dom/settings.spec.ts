import type { Page } from "@playwright/test";
import { expect, seedSettings, test } from "../../fixtures";
import {
  connectPad,
  focusedTestId,
  holdPadUntil,
  PadButton,
  tapPadButton,
  withFakeGamepad,
} from "../../pages/gamepad";
import { MainMenu } from "../../pages/MainMenu";
import { SettingsScreen } from "../../pages/screens";

interface OpenedSettings {
  menu: MainMenu;
  settings: SettingsScreen;
}

async function openSettings(page: Page): Promise<OpenedSettings> {
  const menu = new MainMenu(page);
  const settings = new SettingsScreen(page);
  await menu.goto();
  await menu.settings.click();
  await expect(settings.title).toBeVisible();
  return { menu, settings };
}

/**
 * Ressort au menu puis recharge la page et rouvre Paramètres : une sortie/retour relirait la copie
 * en mémoire de `updateSettings`, un nouveau chargement force `initSettings()` à repeupler depuis le
 * magasin. On ressort d'abord : l'écran courant est lui-même persisté, un rechargement depuis
 * Paramètres rouvrirait Paramètres.
 */
async function reloadIntoSettings(page: Page, settings: SettingsScreen): Promise<OpenedSettings> {
  await settings.back.click();
  return openSettings(page);
}

// Cahier §6.7. La seule option INCONDITIONNELLE depuis le plan 198 (« Prévisualisation dégâts » est
// partie à la sélection d'équipe) ; les lignes conditionnées à la plateforme (« Plein écran »,
// « Installer l'app ») sont en §6.10 (`platform.spec`).
test("paramètres : l'option de base (libellé FR), retour au menu", async ({ page }) => {
  const { menu, settings } = await openSettings(page);

  await expect(page.getByText("Langue", { exact: true })).toBeVisible();
  // Partie à l'écran de sélection d'équipe (plan 198, décision #893) : elle ne doit plus être ici.
  await expect(page.getByText("Prévisualisation dégâts", { exact: true })).toHaveCount(0);

  await settings.back.click();
  await expect(menu.combat).toBeVisible();
});

test("paramètres : la langue persiste en localStorage et bascule les libellés", async ({
  page,
}) => {
  const { settings } = await openSettings(page);

  await settings.languageToggle.click();

  expect(await page.evaluate(() => localStorage.getItem("pt-lang"))).toBe("en");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
});

// Plans 233 et 238 : « Rapide » retirée au plan 238 — on ne va pas plus vite que les cris.
test("paramètres : la vitesse des combats bascule Normale ⇄ Instantanée", async ({ page }) => {
  const { settings } = await openSettings(page);

  await expect(page.getByText("Vitesse des combats", { exact: true })).toBeVisible();
  await expect(settings.combatSpeedToggle).toHaveText("NORMALE");

  for (const label of ["INSTANTANÉE", "NORMALE"]) {
    await settings.combatSpeedToggle.click();
    await expect(settings.combatSpeedToggle).toHaveText(label);
  }
});

// Plans 233 et 238, `.claude/rules/multi-input.md` : chaque ligne est atteinte aux FLÈCHES depuis sa
// voisine — on ne focalise jamais la cible elle-même, ce qui court-circuiterait la navigation
// spatiale qu'on veut prouver. Sur la ligne Volume, c'est le CURSEUR qui tient la colonne des
// commandes, en face de ses voisines : c'est lui que ↑ ↓ atteignent, la sourdine en icône restant à
// sa gauche, hors colonne. Entrée active une bascule comme un clic.
test("paramètres : les flèches traversent Vitesse, Volume, Cri de tour et Contrôles dans les deux sens", async ({
  page,
}) => {
  const { settings } = await openSettings(page);

  await settings.controls.focus();
  for (const testId of ["setting-turn-cries", "setting-volume", "setting-combat-speed"]) {
    await page.keyboard.press("ArrowUp");
    expect(await focusedTestId(page)).toBe(testId);
  }

  await page.keyboard.press("Enter");
  await expect(settings.combatSpeedToggle).toHaveText("INSTANTANÉE");
  expect(await focusedTestId(page)).toBe("setting-combat-speed");

  for (const testId of ["setting-volume", "setting-turn-cries", "setting-controls"]) {
    await page.keyboard.press("ArrowDown");
    expect(await focusedTestId(page)).toBe(testId);
  }
});

// Plan 238. Le curseur revendique ← → pour régler sa valeur (pas de 5). ↑ et ↓ en sortent SANS
// toucher à la valeur — un `input[type=range]` natif, lui, la changerait aussi sur la verticale.
// Entrée dessus coupe ou remet le son : la sourdine n'est pas un arrêt du clavier.
test("paramètres : le curseur se règle aux flèches, Entrée y coupe le son, ↑ ↓ en sortent", async ({
  page,
}) => {
  await seedSettings(page, { volume: 5 });
  const { settings } = await openSettings(page);
  await expect(settings.volumeSlider).toHaveValue("5");

  await settings.turnCriesToggle.focus();
  await page.keyboard.press("ArrowUp");
  expect(await focusedTestId(page)).toBe("setting-volume");

  await page.keyboard.press("ArrowRight");
  await expect(settings.volumeSlider).toHaveValue("10");

  await page.keyboard.press("Enter");
  await expect(settings.muteToggle).toHaveAccessibleName("Remettre le son");
  await expect(settings.volumeSlider).toHaveValue("10");
  await page.keyboard.press("Enter");
  await expect(settings.muteToggle).toHaveAccessibleName("Couper le son");

  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(settings.volumeSlider).toHaveValue("0");
  expect(await focusedTestId(page)).toBe("setting-volume");

  await page.keyboard.press("ArrowDown");
  expect(await focusedTestId(page)).toBe("setting-turn-cries");
  await expect(settings.volumeSlider).toHaveValue("0");
});

// Plan 238 : la sourdine en icône, pour la souris et le doigt. Elle garde le volume ; toucher au
// curseur remet le son.
test("paramètres : la sourdine coupe le son en gardant le volume, le curseur le remet", async ({
  page,
}) => {
  const { settings } = await openSettings(page);
  await expect(settings.muteToggle).toHaveAccessibleName("Couper le son");

  await settings.muteToggle.click();
  await expect(settings.muteToggle).toHaveAccessibleName("Remettre le son");
  await expect(settings.volumeSlider).toHaveValue("75");
  await settings.muteToggle.click();
  await expect(settings.muteToggle).toHaveAccessibleName("Couper le son");

  await settings.muteToggle.click();
  await settings.volumeSlider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(settings.volumeSlider).toHaveValue("80");
  await expect(settings.muteToggle).toHaveAccessibleName("Couper le son");
});

test("paramètres : le cri au début du tour défile Mes Pokémon, Tous, Aucun", async ({ page }) => {
  const { settings } = await openSettings(page);

  await expect(page.getByText("Cri au début du tour", { exact: true })).toBeVisible();
  await expect(settings.turnCriesToggle).toHaveText("MES POKÉMON");

  for (const label of ["TOUS", "AUCUN", "MES POKÉMON"]) {
    await settings.turnCriesToggle.click();
    await expect(settings.turnCriesToggle).toHaveText(label);
  }
});

// Un seul rechargement pour les quatre réglages du lot : c'est `initSettings()` qui les relit.
test("paramètres : vitesse, volume, sourdine et cri de tour persistent au rechargement", async ({
  page,
}) => {
  const { settings } = await openSettings(page);

  await settings.combatSpeedToggle.click();
  await settings.volumeSlider.focus();
  await page.keyboard.press("ArrowLeft");
  await settings.muteToggle.click();
  await settings.turnCriesToggle.click();

  const reopened = (await reloadIntoSettings(page, settings)).settings;
  await expect(reopened.combatSpeedToggle).toHaveText("INSTANTANÉE");
  await expect(reopened.volumeSlider).toHaveValue("70");
  await expect(reopened.muteToggle).toHaveAccessibleName("Remettre le son");
  await expect(reopened.turnCriesToggle).toHaveText("TOUS");
});

// Plan 238, `.claude/rules/multi-input.md` : un curseur n'est pas un simple bouton — à la manette,
// la croix le règle (← →) au lieu de déplacer le focus, et A dessus bascule la sourdine. Un curseur
// à zéro est un silence lui aussi : le bouton le dit, et A rend un volume audible (50) plutôt que
// de « réactiver » un zéro.
test("paramètres : à la manette, la croix règle le volume et A bascule la sourdine", async ({
  page,
}) => {
  await withFakeGamepad(page);
  await seedSettings(page, { volume: 5 });
  const { settings } = await openSettings(page);
  await connectPad(page);

  await holdPadUntil(
    page,
    PadButton.DpadDown,
    async () => (await focusedTestId(page)) === "setting-combat-speed",
  );
  await tapPadButton(page, PadButton.DpadDown);
  expect(await focusedTestId(page)).toBe("setting-volume");

  await tapPadButton(page, PadButton.DpadRight);
  await expect(settings.volumeSlider).toHaveValue("10");
  await tapPadButton(page, PadButton.A);
  await expect(settings.muteToggle).toHaveAccessibleName("Remettre le son");
  await tapPadButton(page, PadButton.A);
  await expect(settings.muteToggle).toHaveAccessibleName("Couper le son");

  await tapPadButton(page, PadButton.DpadLeft);
  await tapPadButton(page, PadButton.DpadLeft);
  await expect(settings.volumeSlider).toHaveValue("0");
  await expect(settings.muteToggle).toHaveAccessibleName("Remettre le son");

  await tapPadButton(page, PadButton.A);
  await expect(settings.volumeSlider).toHaveValue("50");
  await expect(settings.muteToggle).toHaveAccessibleName("Couper le son");
});
