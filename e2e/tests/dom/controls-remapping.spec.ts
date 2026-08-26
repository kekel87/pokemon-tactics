import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { MainMenu } from "../../pages/MainMenu";
import { ControlsScreen, SettingsScreen } from "../../pages/screens";

// Cahier §6.12 — écran de contrôles et réassignation (plan 186).
//
// La capture MANETTE reste 👁 : Playwright ne pilote pas `navigator.getGamepads()` (limite actée au
// plan 184), donc seul l'onglet clavier est automatisable ici. Ce que le clavier couvre, en
// revanche, couvre toute la mécanique : capture, échange, réinitialisation, persistance.

async function goToControls(page: Page): Promise<ControlsScreen> {
  const menu = new MainMenu(page);
  const settings = new SettingsScreen(page);
  const controls = new ControlsScreen(page);
  await menu.goto();
  await menu.settings.click();
  await settings.controls.click();
  await expect(controls.title).toBeVisible();
  return controls;
}

test("§6.12 l'écran liste les contrôles, sans une seule case en alerte à l'ouverture", async ({
  page,
}) => {
  const controls = await goToControls(page);

  await expect(page.getByRole("heading", { name: "Curseur & menus" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Prévisualisation AoE" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Caméra" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Barre d'ordre de jeu" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Journal de combat" })).toBeVisible();
  await expect(controls.cell("rotate-camera-left", 0)).toHaveText("A");
  // Le panoramique est REVENU dans cet écran au plan 189 (révision des décisions #807 et #811) : il
  // n'existait qu'au stick, ce qui le rendait inassignable ; le clavier a depuis gagné le maintien de
  // touche qui lui manquait, et le pavé numérique en est le défaut.
  await expect(controls.cell("pan-camera-up", 0)).toHaveText("Pavé 8");

  // La régression la plus facile à réintroduire : la majorité des actions n'ont pas de secondaire,
  // et les peindre comme « vidées par un échange » couvrirait l'écran de rouge au premier lancement.
  await expect(page.locator("[data-state='displaced']")).toHaveCount(0);
});

test("§6.12 les lignes sans binding possible annoncent au lieu de proposer", async ({ page }) => {
  const controls = await goToControls(page);

  await expect(controls.cell("cancel", 0)).toBeDisabled();
  // À la manette le curseur est un axe, et les crans de zoom absolus n'ont pas d'équivalent.
  await expect(controls.cell("cursor-up", "pad")).toBeDisabled();
  await expect(controls.cell("cursor-up", "pad")).toHaveText("Croix/Stick");
  await expect(controls.cell("zoom-level-1", "pad")).toBeDisabled();
  // Le défilement des panneaux est un MAINTIEN + direction : il s'annonce au lieu de se remapper.
  // Il n'était affiché nulle part avant le plan 186, donc indevinable.
  await expect(controls.cell("scroll-log-up", "pad")).toHaveText("R3 + ↑");
  await expect(controls.cell("scroll-timeline-up", "pad")).toHaveText("R3 + ←");
  await expect(controls.cell("scroll-log-up", "pad")).toBeDisabled();
  // Le panoramique se remappe au clavier depuis le plan 189, mais à la manette c'est le stick DROIT
  // — un axe, pas un bouton. Annoncé, donc, jamais assignable.
  await expect(controls.cell("pan-camera-up", "pad")).toHaveText("Stick droit");
  await expect(controls.cell("pan-camera-up", "pad")).toBeDisabled();
  // Et le jeu de secours des claviers SANS pavé numérique (décision 2), en lecture seule : il ne se
  // remappe pas — donc pas une case du tableau, qui promettrait une capture — mais un contrôle qu'on
  // ne peut ni deviner ni lire ici n'existe pas pour le joueur.
  await expect(page.getByTestId("control-fallback-pan")).toHaveText("Maj + flèches");
});

test("§6.12 la colonne manette n'a qu'un slot, et le stick droit s'inverse", async ({ page }) => {
  const controls = await goToControls(page);

  await expect(controls.cell("confirm", "pad")).toHaveText("A");
  await expect(controls.cell("cycle-target-previous", "pad")).toHaveText("Y");
  await expect(page.getByTestId("control-invert-right-stick")).toHaveText("NON");

  await page.getByTestId("control-invert-right-stick").click();

  await expect(page.getByTestId("control-invert-right-stick")).toHaveText("OUI");
  const stored = JSON.parse(
    (await page.evaluate(() => localStorage.getItem("pt-settings"))) ?? "{}",
  ) as { invertRightStick?: boolean };
  expect(stored.invertRightStick).toBe(true);
});

test("§6.12 le journal a sa touche d'ouverture, l'ordre de jeu garde Page ↑/↓", async ({
  page,
}) => {
  const controls = await goToControls(page);

  await expect(controls.cell("toggle-battle-log", 0)).toHaveText("J");
  // Journal entièrement pilotable à la manette : Select l'ouvre, `R3 + ↑/↓` le fait défiler.
  await expect(controls.cell("toggle-battle-log", "pad")).toHaveText("Select");
  await expect(controls.cell("scroll-timeline-up", 0)).toHaveText("Page ↑");
  await expect(controls.cell("scroll-log-up", 0)).toHaveText("Maj + Page ↑");
});

test("§6.12 capture d'une touche : la case prend la nouvelle touche et l'écart est persisté", async ({
  page,
}) => {
  const controls = await goToControls(page);

  await controls.cell("rotate-camera-left", 0).click();
  await expect(controls.cell("rotate-camera-left", 0)).toHaveAttribute("data-state", "capturing");
  await page.keyboard.press("KeyG");

  await expect(controls.cell("rotate-camera-left", 0)).toHaveText("G");
  await expect(controls.cell("rotate-camera-left", 0)).toHaveAttribute("data-state", "custom");

  const stored = JSON.parse((await controls.storedBindings()) ?? "{}") as {
    keyboard: Record<string, unknown>;
  };
  expect(Object.keys(stored.keyboard)).toEqual(["rotate-camera-left"]);
});

test("§6.12 échange : la touche quitte son ancienne action, qui l'annonce", async ({ page }) => {
  const controls = await goToControls(page);

  // `KeyR` sert Zoom avant par défaut : le poser sur Rotation caméra à gauche doit le lui retirer.
  await controls.cell("rotate-camera-left", 0).click();
  await page.keyboard.press("KeyR");

  await expect(controls.cell("rotate-camera-left", 0)).toHaveText("R");
  await expect(controls.cell("zoom-in", 0)).toHaveText("—");
  await expect(controls.cell("zoom-in", 0)).toHaveAttribute("data-state", "displaced");
  await expect(controls.message).toHaveText(/R a quitté « Zoom avant »/);
});

test("§6.12 la capture s'annule au bouton, la seule issue d'un joueur tactile", async ({
  page,
}) => {
  const controls = await goToControls(page);

  await controls.cell("zoom-in", 0).click();
  await expect(controls.captureCancel).toBeVisible();

  await controls.captureCancel.click();

  await expect(controls.captureCancel).toBeHidden();
  await expect(controls.cell("zoom-in", 0)).toHaveText("R");
});

test("§6.12 la capture s'annule à Échap, sans assigner Échap", async ({ page }) => {
  const controls = await goToControls(page);

  await controls.cell("zoom-in", 0).click();
  await page.keyboard.press("Escape");

  await expect(controls.cell("zoom-in", 0)).toHaveText("R");
  await expect(controls.title).toBeVisible();
});

test("§6.12 les bindings survivent au rechargement, et « Tout réinitialiser » les rend", async ({
  page,
}) => {
  const controls = await goToControls(page);
  await controls.cell("rotate-camera-left", 0).click();
  await page.keyboard.press("KeyG");

  const reopened = await goToControls(page);
  await expect(reopened.cell("rotate-camera-left", 0)).toHaveText("G");

  await reopened.resetAll.click();

  await expect(reopened.cell("rotate-camera-left", 0)).toHaveText("A");
  await expect(reopened.cell("rotate-camera-left", 0)).toHaveAttribute("data-state", "bound");
});

test("§6.12 « Tout réinitialiser » referme une capture en cours et rend l'inversion du stick", async ({
  page,
}) => {
  const controls = await goToControls(page);
  await page.getByTestId("control-invert-right-stick").click();
  await expect(page.getByTestId("control-invert-right-stick")).toHaveText("OUI");

  await controls.cell("zoom-in", 0).click();
  await expect(controls.captureCancel).toBeVisible();
  await page.getByTestId("controls-reset-all").click();

  await expect(controls.captureCancel).toBeHidden();
  await expect(controls.cell("zoom-in", 0)).toHaveText("R");
  // La bascule vit dans `pt-settings`, pas dans `pt-bindings` — mais elle est affichée dans cette
  // table, donc « Tout réinitialiser » doit la rendre aussi.
  await expect(page.getByTestId("control-invert-right-stick")).toHaveText("NON");
});

test("§6.12 Retour ramène aux Réglages, d'où l'on vient", async ({ page }) => {
  await goToControls(page);

  await page.getByRole("button", { name: "Retour" }).click();

  await expect(new SettingsScreen(page).title).toBeVisible();
});
