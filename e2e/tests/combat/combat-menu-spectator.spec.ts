import { expect, test } from "../../fixtures";
import { AI_ONLY_SPECTATOR } from "../../fixtures/sandbox-configs";

// Cahier §4.20 — menu de combat pendant un combat entre IA seules (plan 241). Aucun camp n'est joué à
// cet écran : le contexte d'entrée est `spectating`, qui laisse la vue et `Échap` mais pas le jeu.
// Avant le plan, ce contexte restait `locked` d'un bout à l'autre et le menu n'était atteignable
// qu'à la souris.

test("§4.20 combat entre IA : le bouton du menu de combat est actif et ouvre la modale", async ({
  bootSandbox,
  combatMenu,
}) => {
  await bootSandbox(AI_ONLY_SPECTATOR);

  await expect(combatMenu.openButton).toBeEnabled({ timeout: 15_000 });
  await combatMenu.openByButton();

  await expect(combatMenu.dialog).toBeVisible();
  await expect(combatMenu.title).toBeVisible();
});

test("§4.20 combat entre IA : Échap ouvre le menu de combat, puis le referme", async ({
  bootSandbox,
  combatMenu,
  page,
}) => {
  await bootSandbox(AI_ONLY_SPECTATOR);
  await expect(combatMenu.dialog).toHaveCount(0);

  await combatMenu.openByEscape();
  await expect(combatMenu.dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(combatMenu.dialog).toHaveCount(0);
});

test("§4.20 combat entre IA : une flèche pendant une animation ne pose pas de curseur de case", async ({
  bootSandbox,
  page,
}) => {
  const scene = await bootSandbox(AI_ONLY_SPECTATOR);
  expect(await scene.cursorTile()).toBeNull();

  await expect(
    page
      .getByTestId("battle-log-entry")
      .filter({ hasText: /utilise/ })
      .first(),
  ).toBeAttached({ timeout: 30_000 });
  await page.keyboard.press("ArrowDown");

  expect(await scene.cursorTile()).toBeNull();
});
