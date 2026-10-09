import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import {
  connectPad,
  focusedTagName,
  holdPadUntil,
  PadButton,
  tapPadButton,
  withFakeGamepad,
} from "../../pages/gamepad";
import { MainMenu } from "../../pages/MainMenu";
import { CreditsScreen } from "../../pages/screens";

// Cahier §6.9 — écran Crédits (refonte plan 237 : 4 rubriques, sources en liens, disclaimer en bas).

/** Sources liées, dans l'ordre du document — miroir de `CREDITS.md`. */
const LINKED_SOURCES = [
  "PMDCollab",
  "PMD Origins",
  "Pokémon Showdown",
  "Poképédia",
  "Kenney",
  "Kenney",
  "crystalwalrein",
] as const;

/** Ouvre les Crédits AU CLAVIER : c'est ce chemin qui pose le focus de départ sur « Retour ». */
async function openCreditsWithKeyboard(page: Page, menu: MainMenu): Promise<void> {
  await menu.goto();
  // Entrée par la fin de la liste : le bouton de langue, puis « Crédits », dernière entrée du menu.
  await page.keyboard.press("ArrowUp");
  await expect(menu.languageToggle).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(menu.credits).toBeFocused();
  await page.keyboard.press("Enter");
}

test("crédits : titre + contenu (disclaimer) + retour", async ({ page }) => {
  const menu = new MainMenu(page);
  const credits = new CreditsScreen(page);
  await menu.goto();
  await menu.credits.click();

  await expect(credits.title).toBeVisible();
  await expect(credits.sections).toHaveText(["Graphismes", "Interface", "Police", "Code"]);
  await expect(credits.disclaimer).toBeVisible();

  await credits.back.click();
  await expect(menu.combat).toBeVisible();
});

test("crédits : chaque source est un lien https qui s'ouvre dans un nouvel onglet", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  const credits = new CreditsScreen(page);
  await menu.goto();
  await menu.credits.click();

  await expect(credits.links).toHaveCount(LINKED_SOURCES.length);
  for (const [index, source] of LINKED_SOURCES.entries()) {
    const link = credits.links.nth(index);
    await expect(link).toContainText(source);
    await expect(link).toHaveAttribute("href", /^https:\/\//);
    await expect(link).toHaveAttribute("target", "_blank");
    // `noopener` coupe `window.opener` : l'onglet ouvert ne peut pas rediriger le jeu.
    await expect(link).toHaveAttribute("rel", /\bnoopener\b/);
  }
});

test("crédits : au clavier, le focus part de Retour et remonte lien par lien", async ({ page }) => {
  const menu = new MainMenu(page);
  const credits = new CreditsScreen(page);
  await openCreditsWithKeyboard(page, menu);
  await expect(credits.title).toBeVisible();

  // Départ sur « Retour », jamais sur un lien : un Entrée égaré n'ouvre pas d'onglet.
  await expect(credits.back).toBeFocused();

  // ↑ visite chaque lien, du dernier au premier.
  for (let index = LINKED_SOURCES.length - 1; index >= 0; index--) {
    await page.keyboard.press("ArrowUp");
    await expect(credits.links.nth(index)).toBeFocused();
  }

  // ↓ redescend lien par lien jusqu'à « Retour ».
  for (let index = 1; index < LINKED_SOURCES.length; index++) {
    await page.keyboard.press("ArrowDown");
    await expect(credits.links.nth(index)).toBeFocused();
  }
  await page.keyboard.press("ArrowDown");
  await expect(credits.back).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(menu.combat).toBeVisible();
});

test("crédits : à la manette, les liens sont sautés et B revient au menu", async ({ page }) => {
  await withFakeGamepad(page);
  const menu = new MainMenu(page);
  const credits = new CreditsScreen(page);
  await menu.goto();
  await menu.credits.click();
  await expect(credits.title).toBeVisible();
  await connectPad(page);

  // Un appui manette n'est pas une activation utilisateur : le navigateur bloquerait l'onglet. Les
  // liens portent `data-nav-skip="gamepad"`, le seul arrêt est donc « Retour ».
  await holdPadUntil(
    page,
    PadButton.DpadDown,
    async () => (await focusedTagName(page)) === "BUTTON",
  );
  await expect(credits.back).toBeFocused();
  for (const direction of [PadButton.DpadUp, PadButton.DpadUp, PadButton.DpadDown]) {
    await tapPadButton(page, direction);
    await expect(credits.back).toBeFocused();
  }

  await holdPadUntil(page, PadButton.B, () => menu.combat.isVisible());
});

test("crédits : titre en anglais après bascule de langue", async ({ page }) => {
  const menu = new MainMenu(page);
  await menu.goto();
  await menu.languageToggle.click(); // FR → EN

  await page.getByRole("button", { name: "Credits", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Credits" })).toBeVisible();
});
