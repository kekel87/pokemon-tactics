import type { Page } from "@playwright/test";
import { expect, readStoredSettings, seedSettings, test } from "../../fixtures";
import {
  connectPad,
  focusedDataValue,
  focusedTestId,
  holdPadUntil,
  PadButton,
  tapPadButton,
  withFakeGamepad,
} from "../../pages/gamepad";
import { MainMenu } from "../../pages/MainMenu";
import { MenuThemePicker, SettingsScreen } from "../../pages/screens";

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
  for (const testId of [
    "setting-turn-cries",
    "setting-menu-theme",
    "setting-interface-volume",
    "setting-menu-music-volume",
    "setting-music-volume",
    "setting-effects-volume",
    "setting-volume",
    "setting-combat-speed",
  ]) {
    await page.keyboard.press("ArrowUp");
    expect(await focusedTestId(page)).toBe(testId);
  }

  await page.keyboard.press("Enter");
  await expect(settings.combatSpeedToggle).toHaveText("INSTANTANÉE");
  expect(await focusedTestId(page)).toBe("setting-combat-speed");

  for (const testId of [
    "setting-volume",
    "setting-effects-volume",
    "setting-music-volume",
    "setting-menu-music-volume",
    "setting-interface-volume",
    "setting-menu-theme",
    "setting-turn-cries",
    "setting-controls",
  ]) {
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

  await settings.combatSpeedToggle.focus();
  await page.keyboard.press("ArrowDown");
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
  expect(await focusedTestId(page)).toBe("setting-effects-volume");
  await expect(settings.volumeSlider).toHaveValue("0");
});

// Plan 239 : une sourdine et un curseur par type de son, sous le volume général. Entrée sur le
// curseur Musique de combat ne coupe QUE cette musique — ni les effets, ni le son général, ni la
// musique de menu (plan 240) — et garde son volume.
test("paramètres : Entrée sur le curseur Musique de combat ne coupe que cette musique, et le choix est relu", async ({
  page,
}) => {
  await seedSettings(page, { musicVolume: 40, effectsVolume: 80 });
  const { settings } = await openSettings(page);
  await expect(page.getByText("Effets", { exact: true })).toBeVisible();
  await expect(page.getByText("Musique de combat", { exact: true })).toBeVisible();
  await expect(page.getByText("Musique", { exact: true })).toHaveCount(0);
  await expect(settings.musicMuteToggle).toHaveAccessibleName("Couper le son — Musique de combat");
  await expect(settings.effectsMuteToggle).toHaveAccessibleName("Couper le son — Effets");

  await settings.menuMusicVolumeSlider.focus();
  await page.keyboard.press("ArrowUp");
  expect(await focusedTestId(page)).toBe("setting-music-volume");

  await page.keyboard.press("Enter");
  await expect(settings.musicMuteToggle).toHaveAccessibleName(
    "Remettre le son — Musique de combat",
  );
  await expect(settings.effectsMuteToggle).toHaveAccessibleName("Couper le son — Effets");
  await expect(settings.menuMusicMuteToggle).toHaveAccessibleName(
    "Couper le son — Musique de menu",
  );
  await expect(settings.musicVolumeSlider).toHaveValue("40");
  expect(await focusedTestId(page)).toBe("setting-music-volume");
  expect(await readStoredSettings(page)).toMatchObject({
    muted: false,
    effectsMuted: false,
    musicMuted: true,
    menuMusicMuted: false,
    musicVolume: 40,
    effectsVolume: 80,
  });

  const reopened = (await reloadIntoSettings(page, settings)).settings;
  await expect(reopened.musicMuteToggle).toHaveAccessibleName(
    "Remettre le son — Musique de combat",
  );
  await expect(reopened.effectsMuteToggle).toHaveAccessibleName("Couper le son — Effets");
  await expect(reopened.menuMusicMuteToggle).toHaveAccessibleName(
    "Couper le son — Musique de menu",
  );
  await expect(reopened.musicVolumeSlider).toHaveValue("40");
  await expect(reopened.effectsVolumeSlider).toHaveValue("80");
});

// Plan 239 : chaque curseur règle SON volume aux flèches, et y toucher lève sa seule sourdine ; la
// sourdine d'un type, à la souris, garde le volume de sa ligne et ne touche pas aux autres.
test("paramètres : Effets et Musique de combat se règlent et se coupent indépendamment", async ({
  page,
}) => {
  await seedSettings(page, { musicVolume: 40, musicMuted: true, effectsVolume: 80 });
  const { settings } = await openSettings(page);

  await settings.volumeSlider.focus();
  await page.keyboard.press("ArrowDown");
  expect(await focusedTestId(page)).toBe("setting-effects-volume");
  await page.keyboard.press("ArrowLeft");
  await expect(settings.effectsVolumeSlider).toHaveValue("75");
  await expect(settings.musicVolumeSlider).toHaveValue("40");
  await expect(settings.musicMuteToggle).toHaveAccessibleName(
    "Remettre le son — Musique de combat",
  );

  await page.keyboard.press("ArrowDown");
  expect(await focusedTestId(page)).toBe("setting-music-volume");
  await page.keyboard.press("ArrowRight");
  await expect(settings.musicVolumeSlider).toHaveValue("45");
  await expect(settings.musicMuteToggle).toHaveAccessibleName("Couper le son — Musique de combat");
  await expect(settings.effectsVolumeSlider).toHaveValue("75");
  await expect(settings.volumeSlider).toHaveValue("75");

  expect(await readStoredSettings(page)).toMatchObject({
    volume: 75,
    effectsVolume: 75,
    effectsMuted: false,
    musicVolume: 45,
    musicMuted: false,
  });

  await settings.effectsMuteToggle.click();

  await expect(settings.effectsMuteToggle).toHaveAccessibleName("Remettre le son — Effets");
  await expect(settings.effectsVolumeSlider).toHaveValue("75");
  await expect(settings.musicMuteToggle).toHaveAccessibleName("Couper le son — Musique de combat");
  expect(await readStoredSettings(page)).toMatchObject({
    muted: false,
    effectsMuted: true,
    musicMuted: false,
  });
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

// Plan 239, `.claude/rules/multi-input.md` : les deux curseurs ajoutés se joignent à la croix depuis
// le curseur Volume, et A sur le curseur Musique de combat ne bascule que la sourdine de cette
// musique.
test("paramètres : à la manette, la croix atteint Effets puis Musique de combat et A coupe cette musique seule", async ({
  page,
}) => {
  await withFakeGamepad(page);
  await seedSettings(page, { musicVolume: 40 });
  const { settings } = await openSettings(page);
  await connectPad(page);

  await holdPadUntil(
    page,
    PadButton.DpadDown,
    async () => (await focusedTestId(page)) === "setting-combat-speed",
  );
  for (const testId of ["setting-volume", "setting-effects-volume", "setting-music-volume"]) {
    await tapPadButton(page, PadButton.DpadDown);
    expect(await focusedTestId(page)).toBe(testId);
  }

  await tapPadButton(page, PadButton.DpadRight);
  await expect(settings.musicVolumeSlider).toHaveValue("45");
  expect(await focusedTestId(page)).toBe("setting-music-volume");

  await tapPadButton(page, PadButton.A);
  await expect(settings.musicMuteToggle).toHaveAccessibleName(
    "Remettre le son — Musique de combat",
  );
  await expect(settings.effectsMuteToggle).toHaveAccessibleName("Couper le son — Effets");
  await expect(settings.musicVolumeSlider).toHaveValue("45");

  await tapPadButton(page, PadButton.A);
  await expect(settings.musicMuteToggle).toHaveAccessibleName("Couper le son — Musique de combat");
});

const MUTE_LINES = {
  overall: { toggle: "muteToggle", suffix: "" },
  effects: { toggle: "effectsMuteToggle", suffix: " — Effets" },
  battleMusic: { toggle: "musicMuteToggle", suffix: " — Musique de combat" },
  menuMusic: { toggle: "menuMusicMuteToggle", suffix: " — Musique de menu" },
  interface: { toggle: "interfaceMuteToggle", suffix: " — Interface" },
} as const;
type MuteLine = keyof typeof MUTE_LINES;

/** Les cinq sourdines d'un coup : celles de `muted` proposent de remettre le son, les autres de le couper. */
async function expectMuted(settings: SettingsScreen, muted: readonly MuteLine[]): Promise<void> {
  for (const [line, { toggle, suffix }] of Object.entries(MUTE_LINES)) {
    const action = muted.some((mutedLine) => mutedLine === line)
      ? "Remettre le son"
      : "Couper le son";
    await expect(settings[toggle]).toHaveAccessibleName(`${action}${suffix}`);
  }
}

// Plan 240 : deux lignes de son de plus, « Musique de menu » et « Interface », chacune sa sourdine
// et son curseur. Une sourdine ne coupe QUE sa ligne et garde son volume. Le seul scénario qui lit
// les défauts du produit (musique de menu 55, interface 40) : le harnais ne sème rien pour le son.
test("paramètres : Musique de menu et Interface ont chacune leur sourdine, qui ne coupe que sa ligne", async ({
  page,
}) => {
  const { settings } = await openSettings(page);
  await expect(page.getByText("Musique de menu", { exact: true })).toBeVisible();
  await expect(page.getByText("Interface", { exact: true })).toBeVisible();
  await expect(settings.menuMusicVolumeSlider).toHaveValue("55");
  await expect(settings.interfaceVolumeSlider).toHaveValue("40");
  await expectMuted(settings, []);

  await settings.menuMusicMuteToggle.click();
  await expectMuted(settings, ["menuMusic"]);
  await expect(settings.menuMusicVolumeSlider).toHaveValue("55");

  await settings.interfaceMuteToggle.click();
  await expectMuted(settings, ["menuMusic", "interface"]);
  await expect(settings.interfaceVolumeSlider).toHaveValue("40");
  expect(await readStoredSettings(page)).toMatchObject({
    muted: false,
    effectsMuted: false,
    musicMuted: false,
    menuMusicMuted: true,
    menuMusicVolume: 55,
    interfaceMuted: true,
    interfaceVolume: 40,
  });
});

// Plan 240, `.claude/rules/multi-input.md` : les deux curseurs ajoutés se règlent aux flèches depuis
// leur voisine, et y toucher lève leur seule sourdine. Entrée sur le curseur coupe sa ligne.
test("paramètres : Musique de menu et Interface se règlent aux flèches et se coupent à Entrée", async ({
  page,
}) => {
  await seedSettings(page, {
    menuMusicVolume: 30,
    menuMusicMuted: true,
    interfaceVolume: 60,
    interfaceMuted: true,
  });
  const { settings } = await openSettings(page);
  await expectMuted(settings, ["menuMusic", "interface"]);

  await settings.musicVolumeSlider.focus();
  await page.keyboard.press("ArrowDown");
  expect(await focusedTestId(page)).toBe("setting-menu-music-volume");
  await page.keyboard.press("ArrowRight");
  await expect(settings.menuMusicVolumeSlider).toHaveValue("35");
  await expectMuted(settings, ["interface"]);

  await page.keyboard.press("ArrowDown");
  expect(await focusedTestId(page)).toBe("setting-interface-volume");
  await page.keyboard.press("ArrowLeft");
  await expect(settings.interfaceVolumeSlider).toHaveValue("55");
  await expectMuted(settings, []);

  await page.keyboard.press("Enter");
  await expectMuted(settings, ["interface"]);
  await expect(settings.interfaceVolumeSlider).toHaveValue("55");
  expect(await focusedTestId(page)).toBe("setting-interface-volume");
  expect(await readStoredSettings(page)).toMatchObject({
    menuMusicVolume: 35,
    menuMusicMuted: false,
    interfaceVolume: 55,
    interfaceMuted: true,
    musicMuted: false,
  });
});

// Plan 240, `.claude/rules/multi-input.md` : à la manette, la croix descend de la Musique de combat
// aux deux curseurs ajoutés, les règle (← →), et A sur le curseur Interface ne coupe que l'interface.
test("paramètres : à la manette, la croix atteint Musique de menu puis Interface et A coupe l'interface seule", async ({
  page,
}) => {
  await withFakeGamepad(page);
  await seedSettings(page, { menuMusicVolume: 30, interfaceVolume: 60 });
  const { settings } = await openSettings(page);
  await connectPad(page);

  await holdPadUntil(
    page,
    PadButton.DpadDown,
    async () => (await focusedTestId(page)) === "setting-music-volume",
  );
  await tapPadButton(page, PadButton.DpadDown);
  expect(await focusedTestId(page)).toBe("setting-menu-music-volume");
  await tapPadButton(page, PadButton.DpadLeft);
  await expect(settings.menuMusicVolumeSlider).toHaveValue("25");

  await tapPadButton(page, PadButton.DpadDown);
  expect(await focusedTestId(page)).toBe("setting-interface-volume");
  await tapPadButton(page, PadButton.DpadRight);
  await expect(settings.interfaceVolumeSlider).toHaveValue("65");

  await tapPadButton(page, PadButton.A);
  await expectMuted(settings, ["interface"]);
  await expect(settings.interfaceVolumeSlider).toHaveValue("65");

  await tapPadButton(page, PadButton.DpadDown);
  expect(await focusedTestId(page)).toBe("setting-menu-theme");
});

const DEFAULT_MENU_THEME = { id: "frlg-title", label: "Écran-titre — Rouge Feu/Vert Feuille" };

// Plan 240, `.claude/rules/multi-input.md` : la ligne « Thème des menus » est atteinte aux FLÈCHES
// depuis sa voisine, Entrée ouvre la modale sur SA liste — les thèmes de menu, le défaut en tête, ni
// « Aléatoire » ni « Medley », aucune musique de combat. ↓ y descend de ligne en ligne et Entrée
// choisit, en un appui ; Échap referme sans rien changer. Dans les deux cas le focus revient sur la
// ligne. Le choix est écrit tout de suite : c'est un réglage, pas un paramètre de partie.
test("paramètres : au clavier, le thème des menus se choisit dans sa liste, s'affiche et garde le focus", async ({
  page,
}) => {
  const { settings } = await openSettings(page);
  const themes = new MenuThemePicker(page);
  const storedTheme = async (): Promise<unknown> => (await readStoredSettings(page)).menuMusicId;
  await expect(page.getByText("Thème des menus", { exact: true })).toBeVisible();
  await expect(settings.menuThemeButton).toHaveText(DEFAULT_MENU_THEME.label);

  await settings.turnCriesToggle.focus();
  await page.keyboard.press("ArrowUp");
  expect(await focusedTestId(page)).toBe("setting-menu-theme");
  await page.keyboard.press("Enter");
  await expect(themes.title).toBeVisible();

  await expect(themes.listItems.first()).toHaveText(DEFAULT_MENU_THEME.label);
  await expect(themes.item(DEFAULT_MENU_THEME.id)).toHaveAttribute("aria-current", "true");
  await expect(themes.item(DEFAULT_MENU_THEME.id)).toBeFocused();
  for (const absent of ["random", "medley", "bw-trainer"]) {
    await expect(themes.item(absent)).toHaveCount(0);
  }

  await page.keyboard.press("ArrowDown");
  const passedOver = await focusedDataValue(page, "musicId");
  expect(passedOver).not.toBe(DEFAULT_MENU_THEME.id);

  await page.keyboard.press("Escape");
  await expect(themes.title).toHaveCount(0);
  await expect(settings.menuThemeButton).toHaveText(DEFAULT_MENU_THEME.label);
  await expect.poll(() => focusedTestId(page)).toBe("setting-menu-theme");
  expect(await storedTheme()).not.toBe(passedOver);

  await page.keyboard.press("Enter");
  await expect(themes.title).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  const chosen = (await focusedDataValue(page, "musicId")) ?? "";
  expect([DEFAULT_MENU_THEME.id, passedOver]).not.toContain(chosen);
  const chosenLabel = (await themes.item(chosen).textContent()) ?? "";

  await page.keyboard.press("Enter");
  await expect(themes.title).toHaveCount(0);
  await expect(settings.menuThemeButton).toHaveText(chosenLabel);
  await expect.poll(() => focusedTestId(page)).toBe("setting-menu-theme");
  expect(await storedTheme()).toBe(chosen);

  // Rouverte, la modale part du thème retenu.
  await page.keyboard.press("Enter");
  await expect(themes.item(chosen)).toHaveAttribute("aria-current", "true");
  await expect(themes.item(chosen)).toBeFocused();
  await expect(themes.item(DEFAULT_MENU_THEME.id)).toHaveAttribute("aria-current", "false");
});

// Un seul rechargement pour les réglages du plan 240 : c'est `initSettings()` qui les relit. Rien
// n'est semé — `seedSettings` rejoue à chaque navigation et écraserait ce que le test vient d'écrire.
// Les valeurs sont lues à l'écran avant le rechargement, sans supposer les défauts.
test("paramètres : musique de menu, interface et thème des menus persistent au rechargement", async ({
  page,
}) => {
  const { settings } = await openSettings(page);
  const themes = new MenuThemePicker(page);

  await settings.menuMusicMuteToggle.click();
  const menuMusicVolume = await settings.menuMusicVolumeSlider.inputValue();
  const interfaceVolumeBefore = await settings.interfaceVolumeSlider.inputValue();
  await settings.interfaceVolumeSlider.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(settings.interfaceVolumeSlider).not.toHaveValue(interfaceVolumeBefore);
  const interfaceVolume = await settings.interfaceVolumeSlider.inputValue();
  await settings.menuThemeButton.click();
  const chosen = themes.listItems.last();
  const chosenLabel = (await chosen.textContent()) ?? "";
  expect(chosenLabel).not.toBe(DEFAULT_MENU_THEME.label);
  await chosen.click();
  await expect(themes.title).toHaveCount(0);

  const reopened = (await reloadIntoSettings(page, settings)).settings;
  await expectMuted(reopened, ["menuMusic"]);
  await expect(reopened.menuMusicVolumeSlider).toHaveValue(menuMusicVolume);
  await expect(reopened.interfaceVolumeSlider).toHaveValue(interfaceVolume);
  await expect(reopened.menuThemeButton).toHaveText(chosenLabel);
});

// Plan 240 : depuis le menu de combat, les Paramètres gardent leurs cinq lignes de son mais PAS le
// thème des menus — le choisir y lancerait la musique de menu par-dessus la partie.
test("paramètres en combat : les cinq lignes de son, sans la ligne « Thème des menus »", async ({
  page,
  bootSandbox,
  combatMenu,
}) => {
  await bootSandbox();
  const settings = new SettingsScreen(page);

  await combatMenu.openByButton();
  await combatMenu.settings.click();
  await expect(combatMenu.settingsTitle).toBeVisible();

  for (const slider of [
    settings.volumeSlider,
    settings.effectsVolumeSlider,
    settings.musicVolumeSlider,
    settings.menuMusicVolumeSlider,
    settings.interfaceVolumeSlider,
  ]) {
    await expect(combatMenu.dialog.locator(slider)).toHaveCount(1);
  }
  await expect(settings.turnCriesToggle).toBeVisible();
  await expect(settings.menuThemeButton).toHaveCount(0);
  await expect(combatMenu.dialog.getByText("Thème des menus", { exact: true })).toHaveCount(0);
});
