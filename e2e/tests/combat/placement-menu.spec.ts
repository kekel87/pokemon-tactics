import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { CombatScene } from "../../pages/CombatScene";
import { MainMenu } from "../../pages/MainMenu";
import { BattleModeScreen, MapSelectScreen, TeamSelectScreen } from "../../pages/screens";

// Cahier §4.20 (variante `placement`) — menu de combat pendant la phase de placement (plan 189,
// volet B). Il referme le trou signalé par le plan 187 : le menu naissait dans `runBattle`, donc
// APRÈS le placement — pendant qu'on posait ses Pokemon il n'existait ni sortie, ni accès aux
// Paramètres, et `Start` était inerte.
//
// ⚠️ **Aucun de ces tests ne peut passer par la route sandbox** : le studio n'a pas de phase de
// placement du tout. Il faut le parcours réel (menu → mode → carte → équipe), et surtout **décocher
// « Placement auto »** — cochée par défaut, l'option pose l'équipe entière d'un coup avant que la
// phase ne s'affiche. C'est exactement ce qui a laissé le trou passer inaperçu si longtemps.
//
// ⚠️ **Le placement alterne les joueurs** (`PlacementPhase.turnQueue`) et l'IA pose TOUTE son équipe
// dès qu'on lui rend la main. Après le premier Pokemon du joueur, `canUndo()` est donc faux — un
// adversaire a joué depuis, l'anti-triche interdit de défaire. Le chaînage d'`Échap` ne s'observe
// qu'à partir du DEUXIÈME Pokemon posé, celui d'après lequel plus personne n'a joué.

/** Le seul chemin vers la phase de placement : le parcours réel, « Placement auto » décoché. */
async function startInteractivePlacement(page: Page): Promise<CombatScene> {
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);
  const maps = new MapSelectScreen(page);
  const teams = new TeamSelectScreen(page);
  const scene = new CombatScene(page);

  await menu.goto();
  await menu.combat.click();
  await mode.local.click();
  await expect(maps.title).toBeVisible();
  await maps.confirm.click();
  await expect(teams.title).toBeVisible();
  // Le camp 1 reste HUMAIN (contrairement à `giveSlotToAi`) : c'est lui qui doit avoir des Pokemon
  // à poser, donc une phase de placement à traverser.
  await teams.pickRandomTeam();
  await teams.autoPlacement.uncheck();
  await teams.launch.click();
  await scene.waitReady();
  return scene;
}

test("§4.20 la rangée du placement porte le plein écran et « ☰ », sans journal", async ({
  page,
  placement,
  combatMenu,
}) => {
  await startInteractivePlacement(page);
  await expect(placement.instruction).toBeVisible({ timeout: 30_000 });

  await expect(page.getByTestId("fullscreen-button")).toBeVisible();
  await expect(combatMenu.openButton).toBeVisible();
  // Rangée RÉDUITE (plan 189, B3) : aucun combat n'a commencé, donc aucun journal à tenir — et rien
  // du chrome de combat n'est monté à ce stade.
  await expect(page.getByTestId("battle-log")).toHaveCount(0);
  await expect(page.getByTestId("timeline")).toHaveCount(0);
  // La règle du volet C vaut ici aussi : le bouton annonce sa touche sous lui.
  await expect(page.getByTestId("combat-menu-key-hint")).toBeVisible();
});

test("§4.20 le menu du placement s'ouvre au bouton « ☰ » et n'offre PAS « Abandonner »", async ({
  page,
  placement,
  combatMenu,
}) => {
  await startInteractivePlacement(page);
  await expect(placement.instruction).toBeVisible({ timeout: 30_000 });

  await combatMenu.openByButton();

  await expect(combatMenu.dialog).toBeVisible();
  await expect(combatMenu.resume).toBeVisible();
  await expect(combatMenu.settings).toBeVisible();
  await expect(combatMenu.restart).toBeVisible();
  await expect(combatMenu.quit).toBeVisible();
  // Le point de la variante `placement` (décision 4) : « Abandonner » purge une sauvegarde de
  // reprise qui n'existe pas encore — le combat n'a pas commencé. Sa sortie destructrice s'appelle
  // « Quitter », et il n'y a donc que QUATRE entrées.
  await expect(combatMenu.abandon).toHaveCount(0);
  await expect(combatMenu.dialog.getByRole("button")).toHaveCount(4);
});

test("§4.20 Échap ouvre le menu du placement quand il n'y a rien à défaire, et une seconde frappe referme", async ({
  page,
  placement,
  combatMenu,
}) => {
  await startInteractivePlacement(page);
  await expect(placement.instruction).toBeVisible({ timeout: 30_000 });
  // Rien n'est posé : `undoLastPlacement()` n'a rien à rendre, la touche retombe donc sur le menu.
  await expect(placement.counter).toHaveText("Placés : 0/6");

  await combatMenu.openByEscape();
  await expect(combatMenu.dialog).toBeVisible();

  await page.keyboard.press("Escape");

  // Même neutralisation du `cancel` natif du `<dialog>` qu'en combat : sans elle la fermeture native
  // rejouerait *Annuler*, qui n'ayant rien à défaire rouvrirait aussitôt la modale.
  await expect(combatMenu.dialog).toHaveCount(0);
});

test("§4.20 Échap défait d'abord le dernier placement, et n'ouvre le menu qu'ensuite", async ({
  page,
  placement,
  combatMenu,
}) => {
  test.slow();
  const scene = await startInteractivePlacement(page);
  await expect(placement.instruction).toBeVisible({ timeout: 30_000 });

  await placement.placeNext(scene);
  await expect(placement.counter).toHaveText("Placés : 1/6");
  // Le second, celui d'après lequel plus personne n'a joué : c'est le seul que l'anti-triche laisse
  // défaire (l'IA a vidé sa file entre les deux).
  await placement.placeNext(scene);
  await expect(placement.counter).toHaveText("Placés : 2/6");

  await page.keyboard.press("Escape");

  // Le chaînage de `placement-flow.ts` : `undoLastPlacement() || openCombatMenu()`. Il avait quelque
  // chose à défaire, donc il défait — et le menu reste fermé.
  await expect(placement.counter).toHaveText("Placés : 1/6");
  await expect(combatMenu.dialog).toHaveCount(0);

  await page.keyboard.press("Escape");

  await expect(combatMenu.dialog).toBeVisible();
  await expect(placement.counter).toHaveText("Placés : 1/6");
});

test("§4.20 « Recommencer » du placement confirme, « Annuler » ne détruit rien, « Confirmer » remet à zéro", async ({
  page,
  placement,
  combatMenu,
}) => {
  test.slow();
  const scene = await startInteractivePlacement(page);
  await expect(placement.instruction).toBeVisible({ timeout: 30_000 });
  await placement.placeNext(scene);
  await expect(placement.counter).toHaveText("Placés : 1/6");

  await combatMenu.openByButton();
  await combatMenu.restart.click();

  // Libellé propre à la PHASE (décision 4) : ici rien n'est encore « perdu », ce sont les Pokemon
  // déjà posés qu'on retire.
  await expect(page.getByText(/Recommencer le placement \?/)).toBeVisible();
  await expect(combatMenu.confirm).toBeVisible();
  await expect(combatMenu.confirmCancel).toBeVisible();

  await combatMenu.confirmCancel.click();

  await expect(combatMenu.restart).toBeVisible();
  await expect(combatMenu.confirm).toHaveCount(0);

  await combatMenu.restart.click();
  await combatMenu.confirm.click();

  await expect(combatMenu.dialog).toHaveCount(0);
  await scene.waitReady();
  // La phase est remontée de neuf, placements compris — et une SEULE rangée : le chrome du placement
  // précédent est parti avec lui, sinon deux boutons `☰` se disputeraient la même touche.
  await expect(placement.counter).toHaveText("Placés : 0/6", { timeout: 30_000 });
  await expect(combatMenu.openButton).toHaveCount(1);
});

test("§4.20 « Quitter » du placement confirme, et rend la main au menu principal", async ({
  page,
  placement,
  combatMenu,
}) => {
  test.slow();
  const scene = await startInteractivePlacement(page);
  await expect(placement.instruction).toBeVisible({ timeout: 30_000 });
  await placement.placeNext(scene);
  await expect(placement.counter).toHaveText("Placés : 1/6");

  await combatMenu.openByButton();
  await combatMenu.quit.click();

  // Confirmation exigée (décision 5) : rien n'est sauvegardé, mais les Pokemon déjà posés le sont.
  // C'est ce qui distingue ce « Quitter » de celui du combat, qui sort sans rien demander.
  await expect(page.getByText(/Quitter \?/)).toBeVisible();
  await expect(combatMenu.confirm).toBeVisible();

  await combatMenu.confirm.click();

  const menu = new MainMenu(page);
  await expect(menu.title).toBeVisible();
  // Aucune sauvegarde à purger — et aucune à proposer : le combat n'avait pas commencé.
  await expect(menu.resume).toHaveCount(0);
});

test("§4.20 le passage de relais ne laisse qu'un seul menu : le combat monte le sien, celui du placement part", async ({
  page,
  placement,
  combatMenu,
}) => {
  test.slow();
  const scene = await startInteractivePlacement(page);
  await expect(placement.instruction).toBeVisible({ timeout: 30_000 });
  await placement.placeNext(scene);

  // « Terminer » est proposé dès le premier Pokemon posé : l'IA ayant déjà vidé sa file, le combat
  // démarre là.
  await placement.finish.click();
  await expect(page.getByRole("button", { name: "Attendre", exact: true })).toBeVisible({
    timeout: 30_000,
  });

  // Un seul bouton `☰` et un seul menu vivant (risque nommé par le plan 189, B2) : deux
  // registrations d'entrée se disputeraient `Start` et le joueur en ouvrirait un au hasard.
  await expect(combatMenu.openButton).toHaveCount(1);
  await expect(combatMenu.openButton).toBeEnabled({ timeout: 30_000 });
  await combatMenu.openByButton();
  await expect(combatMenu.dialog).toHaveCount(1);
  // Et c'est bien la variante COMBAT qui a pris la main : « Abandonner » est de retour, il y a
  // désormais une partie à détruire.
  await expect(combatMenu.abandon).toBeVisible();
  // Le journal, absent du placement, est monté avec le chrome de combat.
  await expect(page.getByTestId("battle-log")).toBeVisible();
});
