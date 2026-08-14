import { expect, test } from "../../fixtures";
import { AppShell } from "../../pages/app-shell";
import { BattleResumeStore } from "../../pages/battle-resume";
import { CombatScene } from "../../pages/CombatScene";
import { readActivePokemon } from "../../pages/combat-queries";
import { MainMenu } from "../../pages/MainMenu";
import { BattleModeScreen, MapSelectScreen, TeamSelectScreen } from "../../pages/screens";

// Cahier §6.11 — reprise d'un combat en cours (plan 181).
//
// Pourquoi ce spec vit dans le projet `combat` et pas `dom` : la sauvegarde n'existe QUE sur le chemin
// réel menu → carte → équipe → placement → combat. La route de dev `?combat=1` et le studio sandbox
// ne participent pas à la persistance (entrées de développement, volontairement déterministes), donc
// aucun `bootSandbox` ne peut fabriquer l'état testé ici — il faut monter un vrai combat.
//
// La sauvegarde n'est pas écrite à la main : le combat la produit, on la laisse survivre au
// rechargement, et on la reprend. Un jeu de données forgé mentirait sur deux points impossibles à
// deviner (le `buildVersion` du build servi, la cohérence des placements avec la carte) ; les cas de
// REJET, eux, n'ont pas besoin d'être rejouables et sont en `dom/battle-resume-menu.spec.ts`.
//
// Déterminisme : le combat réel tire son seed au démarrage et ses équipes au hasard (chemin de
// production), donc aucune assertion ne porte sur un contenu attendu en dur. Toutes comparent l'état
// AVANT le rechargement à l'état APRÈS la reprise — la propriété que le plan revendique.

test("§6.11 reprise : le combat remonte à l'identique depuis le menu principal", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);
  const maps = new MapSelectScreen(page);
  const teams = new TeamSelectScreen(page);
  const scene = new CombatScene(page);
  const shell = new AppShell(page);
  const store = new BattleResumeStore(page);

  // Parcours réel jusqu'au combat. Slot 1 garde son contrôleur « Humain » et reçoit une équipe
  // aléatoire : il faut un tour humain à piloter, et c'est le point d'observation stable (le jeu
  // attend le joueur, il ne bouge pas sous les assertions).
  await menu.goto();
  await menu.combat.click();
  await mode.local.click();
  await expect(maps.title).toBeVisible();
  const mapName = ((await maps.detailName.textContent()) ?? "").trim();
  expect(mapName).not.toBe("");
  await maps.confirm.click();
  await expect(teams.title).toBeVisible();
  await teams.randomTeam.click();
  await expect(teams.launch).toBeEnabled();
  await teams.launch.click();
  await scene.waitReady();

  // Les sprites sont posés par la phase de placement auto, APRÈS le signal de chargement (cf.
  // normal-game.spec) → on attend la convergence du placement avant de mesurer quoi que ce soit.
  await expect
    .poll(() => scene.countByName("pokemon_plane"), { timeout: 15_000 })
    .toBeGreaterThan(0);
  const spriteCount = await scene.countByName("pokemon_plane");

  // Sauvegardé dès le démarrage, avant la première action : un rechargement juste après le placement
  // doit reprendre le combat qui vient d'être posé, pas renvoyer en sélection d'équipe.
  await expect.poll(() => store.actionCount(), { timeout: 15_000 }).toBeGreaterThanOrEqual(0);
  const initialActions = await store.actionCount();

  // Deux tours passés (« Attendre ») : chacun est une action validée, donc la sauvegarde doit grossir.
  const wait = page.getByRole("button", { name: "Attendre", exact: true });
  await scene.endTurn();
  await expect(wait).toBeVisible({ timeout: 15_000 }); // la main est revenue au joueur
  await scene.endTurn();
  await expect(wait).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => store.actionCount()).toBeGreaterThan(initialActions);

  // Instantané de ce qu'on quitte : le journal raconté jusqu'ici, le nombre d'actions enregistrées,
  // et le Pokemon dont c'est le tour avec ses PV.
  const savedActions = await store.actionCount();
  const logBefore = await page.getByTestId("battle-log-entry").allTextContents();
  expect(logBefore.length).toBeGreaterThan(0);
  const activeBefore = await readActivePokemon(page);

  // Le rechargement d'un onglet déchargé : le combat n'est pas un écran restaurable, donc on retombe
  // au menu principal — mais avec de quoi y retourner.
  await shell.reload();
  await expect(menu.title).toBeVisible();
  await expect(menu.resume).toBeVisible();
  // L'entrée dit CE QU'ON reprend (on revient sans savoir où on en était) et passe en tête de menu.
  await expect(menu.resume).toHaveText(`Reprendre le combat — ${mapName}`);
  await expect(menu.entries.first()).toHaveText(`Reprendre le combat — ${mapName}`);

  await menu.resume.click();
  await scene.waitReady();

  // Pas de repassage par le placement : la scène remonte directement avec tout son monde.
  await expect(page.getByTestId("action-menu")).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => scene.countByName("pokemon_plane")).toBe(spriteCount);

  // Le journal est reconstruit : les lignes d'avant le rechargement sont là, dans le même ordre, en
  // tête du journal (c'est le signal qui distingue une reprise d'un combat relancé de zéro).
  await expect
    .poll(async () => (await page.getByTestId("battle-log-entry").allTextContents()).length, {
      timeout: 15_000,
    })
    .toBeGreaterThanOrEqual(logBefore.length);
  const logAfter = await page.getByTestId("battle-log-entry").allTextContents();
  expect(logAfter.slice(0, logBefore.length)).toEqual(logBefore);

  // Le moteur a bien été ré-avancé : la même main à jouer, avec les mêmes PV, et un journal d'actions
  // de même longueur (la reprise réenregistre son propre `exportReplay`, qui doit retomber sur le
  // compte quitté).
  await expect(page.getByTestId("combat-turn")).toHaveText(activeBefore.name);
  expect(await readActivePokemon(page)).toEqual(activeBefore);
  await expect.poll(() => store.actionCount()).toBe(savedActions);
});
