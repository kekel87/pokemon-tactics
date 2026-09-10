import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { DUEL } from "../../fixtures/sandbox-configs";
import { BattleResumeStore } from "../../pages/battle-resume";
import { BrowserHistory } from "../../pages/browser-history";
import { CombatScene } from "../../pages/CombatScene";
import type { CombatMenuOverlay } from "../../pages/combat-menu";
import { MainMenu } from "../../pages/MainMenu";
import { BattleModeScreen, MapSelectScreen, TeamSelectScreen } from "../../pages/screens";

// Cahier §4.20 — le retour du navigateur EN COMBAT (plan 205).
//
// 🔴 C'est le cas qui a motivé tout l'item : sur téléphone, le geste de retour est un réflexe
// permanent, et sans interception il QUITTE la partie. En ligne, une sortie lance en plus un délai
// de grâce chez l'adversaire (plan 202). Le contrat n'est donc pas « le retour fait quelque chose »,
// c'est **jamais de sortie muette d'une partie** : on reste en combat et le menu de combat s'ouvre,
// avec ses confirmations.
//
// Rien n'a été écrit côté combat pour ça : le retour est routé dans le `cancel` de l'`InputSystem`,
// là où arrivent `Échap` et le bouton B — donc il hérite de la retombée du plan 187, y compris de
// l'annulation d'une visée en cours avant l'ouverture du menu (couverte par `combat-menu.spec`).

/** Le menu d'actions est monté et le tour n'est plus verrouillé : une frappe envoyée avant ça est
 *  ignorée à raison, et le geste d'armement ne compterait pas. */
async function waitForPlayerTurn(page: Page, combatMenu: CombatMenuOverlay): Promise<void> {
  await expect(page.getByRole("button", { name: "Attaque", exact: true })).toBeVisible();
  await expect(combatMenu.openButton).toBeEnabled();
}

test("§4.20 le retour du navigateur en combat ouvre le menu de combat, sans quitter la partie", async ({
  page,
  bootSandbox,
  combatMenu,
}) => {
  const historyStack = new BrowserHistory(page);
  await bootSandbox(DUEL);
  await waitForPlayerTurn(page, combatMenu);

  // Par une frappe neutre, pas par un clic : ouvrir le menu ou toucher une tuile changerait
  // justement l'état qu'on veut juger ensuite.
  await historyStack.armByPlayerGesture();
  const armedLength = await historyStack.length();

  await historyStack.back();

  // Toujours en combat — le chrome de combat est là, avec sa bannière de tour.
  await expect(page.getByTestId("combat-turn")).toBeVisible();
  // Et le menu s'est ouvert : la sortie passe par « Abandonner » et sa confirmation, jamais par le
  // geste lui-même.
  await expect(combatMenu.dialog).toBeVisible();
  await expect(combatMenu.abandon).toBeVisible();
  // « Quitter » n'existe que là où une sauvegarde de reprise existe : le studio sandbox n'en produit
  // pas. Le vrai combat, où il est présent, est le dernier test de ce fichier.
  await expect(combatMenu.quit).toHaveCount(0);
  // Consommé, donc réarmé : le joueur peut refaire le geste, il ne sortira pas plus la fois d'après.
  expect(await historyStack.sentinelArmed()).toBe(true);
  expect(await historyStack.length()).toBe(armedLength);
});

test("§4.20 le retour du navigateur, menu de combat ouvert, referme le menu et reste en combat", async ({
  page,
  bootSandbox,
  combatMenu,
}) => {
  const historyStack = new BrowserHistory(page);
  await bootSandbox(DUEL);
  await waitForPlayerTurn(page, combatMenu);

  // Le clic du bouton `☰` arme la sentinelle en même temps qu'il ouvre le menu — c'est bien un geste
  // du joueur, et c'est le chemin qu'un joueur emprunte vraiment.
  await combatMenu.openByButton();
  await expect(combatMenu.dialog).toBeVisible();
  const armedLength = await historyStack.length();

  await historyStack.back();

  // La modale possède `Annuler` : elle se ferme, au lieu de laisser le combat filer dessous.
  //
  // 🔴 Et elle se ferme par SA PROPRE sortie, pas par le `dialog.close()` de secours que le module
  // applique aux modales que personne ne ferme (le repli ajouté à la revue du plan 205). C'est bien
  // ce que cette ligne prouve : le testid est posé sur l'élément `<dialog>`, que le `close()` du
  // menu RETIRE du document — un `close()` sec le laisserait en place, refermé, et le compte serait
  // de 1.
  await expect(combatMenu.dialog).toHaveCount(0);
  await expect(page.getByTestId("combat-turn")).toBeVisible();
  await expect(page.getByRole("button", { name: "Attaque", exact: true })).toBeVisible();
  expect(await historyStack.sentinelArmed()).toBe(true);
  expect(await historyStack.length()).toBe(armedLength);

  // Et la preuve qu'aucune registration fantôme ne traîne : un second retour ROUVRE le menu
  // entièrement. Court-circuiter la sortie propre laisserait `unregisterInput` non appelé et la
  // référence au dialogue en place — l'ouverture suivante serait refusée, et le retour sortirait de
  // la partie par-dessous.
  await historyStack.back();

  await expect(combatMenu.dialog).toBeVisible();
  await expect(combatMenu.abandon).toBeVisible();
  await expect(page.getByTestId("combat-turn")).toBeVisible();
  expect(await historyStack.length()).toBe(armedLength);
});

test("§4.20 dans un combat RÉEL, le retour ouvre le menu avec ses deux sorties (Abandonner, Quitter)", async ({
  page,
  combatMenu,
}) => {
  // Un combat réel monté depuis les menus : le budget d'un test de sandbox n'y suffit pas.
  test.slow();
  // Le studio sandbox est monté HORS du `ScreenManager` et ne produit aucune sauvegarde de reprise ;
  // seul le chemin réel en écrit une, donc seul lui montre « Quitter ». Or c'est exactement la
  // partie qu'une sortie accidentelle détruirait — et, en ligne, celle qui lance un délai de grâce
  // chez l'adversaire. Le cas vaut donc son coût.
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);
  const maps = new MapSelectScreen(page);
  const teams = new TeamSelectScreen(page);
  const scene = new CombatScene(page);
  const store = new BattleResumeStore(page);
  const historyStack = new BrowserHistory(page);

  await menu.goto();
  await menu.combat.click();
  await mode.local.click();
  await expect(maps.title).toBeVisible();
  await maps.confirm.click();
  await expect(teams.title).toBeVisible();
  await teams.pickRandomTeam();
  await expect(teams.launch).toBeEnabled();
  await teams.launch.click();
  await scene.waitReady();
  await expect(page.getByRole("button", { name: "Attendre", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(combatMenu.openButton).toBeEnabled({ timeout: 30_000 });
  await expect.poll(() => store.actionCount(), { timeout: 15_000 }).toBeGreaterThanOrEqual(0);

  // La sentinelle est déjà armée par les clics de menu — c'est la séquence d'un vrai joueur, et le
  // combat n'a rien eu à faire pour en hériter.
  expect(await historyStack.sentinelArmed()).toBe(true);
  const armedLength = await historyStack.length();

  await historyStack.back();

  await expect(page.getByTestId("combat-turn")).toBeVisible();
  await expect(combatMenu.dialog).toBeVisible();
  await expect(combatMenu.abandon).toBeVisible();
  await expect(combatMenu.quit).toBeVisible();
  expect(await historyStack.length()).toBe(armedLength);

  // Et la sortie reste volontaire : « Reprendre » rend la main au combat.
  await combatMenu.resume.click();
  await expect(combatMenu.dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Attendre", exact: true })).toBeVisible();
});
