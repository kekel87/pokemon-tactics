import { expect, test } from "../../fixtures";
import { CombatScene } from "../../pages/CombatScene";
import { MainMenu } from "../../pages/MainMenu";
import { BattleModeScreen, MapSelectScreen, TeamSelectScreen } from "../../pages/screens";

/*
 * Cahier §6.3 / §8.6 — cycle de vie du hook de scène `__ptE2e__`.
 *
 * Ce hook n'est pas une feature du jeu : c'est le HARNAIS lui-même, donc sa justesse conditionne
 * celle de tous les autres tests de scène. L'écran de choix de carte construit son aperçu 3D avec
 * `createCombatScene` (`map-preview-stage.ts`), il installe donc un hook complet — qui répond
 * `isReady() === true` dès que la carte est bâtie.
 *
 * Tant que `dispose()` ne le retirait pas, cet aperçu détruit continuait à répondre : `waitReady()`
 * franchissait aussitôt la barrière sans qu'aucune scène de combat n'existe, et les tests qui
 * suivaient s'appuyaient sur une scène vide. Le piège avait déjà mordu la séquence d'intro, qui a dû
 * se rabattre sur le menu d'actions pour savoir que le combat avait démarré (plan 194).
 */

test("§8.6 aperçu de carte : quitter l'écran désinstalle le hook de scène", async ({ page }) => {
  const menu = new MainMenu(page);
  const battleMode = new BattleModeScreen(page);
  const mapSelect = new MapSelectScreen(page);
  const scene = new CombatScene(page);

  await menu.goto();
  await menu.combat.click();
  await battleMode.local.click();
  await expect(mapSelect.title).toBeVisible();

  // L'aperçu installe bien un hook, et il va jusqu'à « prête » : sans cette première assertion, la
  // suivante passerait aussi pour une raison sans rapport (hook jamais installé).
  await expect.poll(() => scene.hookInstalled()).toBe(true);
  await expect.poll(() => scene.isReady(), { timeout: 20_000 }).toBe(true);

  await mapSelect.back.click();
  await expect(battleMode.title).toBeVisible();

  // Plus aucune scène à l'écran → plus de hook. `isReady()` seul ne suffirait pas comme garde : il
  // reste piégé par la fermeture de l'aperçu, qui garde `true` après destruction.
  await expect.poll(() => scene.hookInstalled()).toBe(false);
});

test("§6.4 le hook suit la scène vivante : absent en sélection d'équipe, réinstallé par le combat", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  const battleMode = new BattleModeScreen(page);
  const mapSelect = new MapSelectScreen(page);
  const teamSelect = new TeamSelectScreen(page);
  const scene = new CombatScene(page);

  await menu.goto();
  await menu.combat.click();
  await battleMode.local.click();
  await expect(mapSelect.title).toBeVisible();
  await expect.poll(() => scene.isReady(), { timeout: 20_000 }).toBe(true);

  await mapSelect.confirm.click();
  await expect(teamSelect.title).toBeVisible();

  // L'écran de sélection d'équipe est du DOM pur : aucune scène Babylon n'y vit. C'est le point
  // exact où le hook rémanent trompait `waitReady()`, puisque le combat se lance depuis ici.
  await expect.poll(() => scene.hookInstalled()).toBe(false);

  await teamSelect.giveSlotToAi();
  await expect(teamSelect.launch).toBeEnabled();
  await teamSelect.launch.click();

  // La scène que `waitReady()` a validée porte de la géométrie : une scène détruite a un graphe
  // vidé, donc c'est ce qui distingue « prête » d'un hook resté branché sur l'aperçu.
  await scene.waitReady();
  const tiles = (await scene.meshNames()).filter((name) => name.startsWith("tile_"));
  expect(tiles.length).toBeGreaterThan(0);
});
