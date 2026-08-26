import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { DUEL, DUEL_LETHAL } from "../../fixtures/sandbox-configs";
import { BattleResumeStore } from "../../pages/battle-resume";
import { CombatScene } from "../../pages/CombatScene";
import type { CombatMenuOverlay } from "../../pages/combat-menu";
import { MainMenu } from "../../pages/MainMenu";
import {
  BattleModeScreen,
  ControlsScreen,
  MapSelectScreen,
  TeamSelectScreen,
} from "../../pages/screens";

// Cahier §4.20 — menu de combat (plan 187).
//
// ⚠️ Ce comportement n'a AUCUN test unitaire, et c'est assumé : la modale est du DOM, le projet
// `unit` de Vitest n'a pas d'environnement DOM (pas de jsdom) et aucun composant DOM n'y est monté.
// Tout ce qui suit est donc le SEUL filet de la surcouche — d'où la couverture large de ce fichier.
//
// Deux choses distinctes s'y jouent, et la première est la plus dangereuse :
//
//  1. `Échap` cesse de renvoyer `true` en dur (`onEscape(): boolean`, plan 187 étape B). C'est la
//     sortie de TOUT le flux d'attaque : si un cran se met à ouvrir la modale au lieu de reculer, le
//     jeu devient injouable au clavier. Un test par cran, chacun vérifiant en plus que la modale
//     n'est PAS montée.
//  2. Au menu d'actions racine — le seul endroit du flux où la touche était sans effet — `Échap`
//     ouvre le menu. Et une seule frappe le referme : le `cancel` natif du `<dialog>` est neutralisé,
//     sans quoi la fermeture native déclencherait la retombée #7 qui rouvrirait aussitôt la modale.
//
// Géométrie de `DUEL` : lanceur en (2,3) face au nord, cible inerte en (2,2), Griffe (portée 1).

const DUMMY_TILE = { x: 2, y: 2 };

/**
 * L'action logique « Menu de combat » posée sur `M`.
 *
 * Son défaut est `Start` à la manette et **rien** au clavier (`Échap` fait déjà le travail par sa
 * retombée) — or Playwright ne pousse pas de bouton de manette. La remapper est donc le seul moyen de
 * piloter l'action elle-même, et ça vérifie du même coup qu'elle est bien remappable de bout en bout.
 */
const OPEN_MENU_ON_KEY_M = JSON.stringify({
  version: 1,
  keyboard: { "open-combat-menu": [{ code: "KeyM", shift: false }, null] },
  gamepad: {},
});

async function bindOpenMenuToKeyM(page: Page): Promise<void> {
  await page.addInitScript((stored: string) => {
    localStorage.setItem("pt-bindings", stored);
  }, OPEN_MENU_ON_KEY_M);
}

/** Le menu d'actions du joueur est monté et le tour n'est plus verrouillé (contexte ≠ `locked`) :
 *  une frappe envoyée avant ça est ignorée à raison, et le test compterait une touche de moins. */
async function waitForPlayerTurn(page: Page, combatMenu: CombatMenuOverlay): Promise<void> {
  await expect(page.getByRole("button", { name: "Attaque", exact: true })).toBeVisible();
  await expect(combatMenu.openButton).toBeEnabled();
}

/**
 * Même gate, sur un combat RÉEL : le bouton `☰` naît avec le chrome, donc après le placement, et les
 * équipes étant tirées au hasard c'est parfois l'IA qui ouvre le bal — le temps de ses tours, le
 * contexte est `locked` et le bouton grisé. On attend le menu d'actions du joueur, pas juste la scène.
 */
async function waitForRealBattleTurn(page: Page, combatMenu: CombatMenuOverlay): Promise<void> {
  await expect(page.getByRole("button", { name: "Attendre", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(combatMenu.openButton).toBeEnabled({ timeout: 30_000 });
}

/** Entre dans la liste d'attaques (phase `attack_submenu`). */
async function openAttackList(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  await expect(page.getByTestId("move-item").first()).toBeVisible();
}

test("§4.20 Échap dans la liste d'attaques revient au menu d'actions, sans ouvrir le menu de combat", async ({
  page,
  bootSandbox,
  combatMenu,
}) => {
  await bootSandbox(DUEL);
  await waitForPlayerTurn(page, combatMenu);
  await openAttackList(page);

  await page.keyboard.press("Escape");

  await expect(page.getByTestId("move-item")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Attaque", exact: true })).toBeVisible();
  await expect(combatMenu.dialog).toHaveCount(0);
});

test("§4.20 Échap au choix de cible revient à la liste d'attaques, sans ouvrir le menu de combat", async ({
  page,
  bootSandbox,
  combatMenu,
}) => {
  await bootSandbox(DUEL);
  await waitForPlayerTurn(page, combatMenu);
  await openAttackList(page);
  await page.getByTestId("move-item").first().click();
  await expect(page.getByTestId("combat-instruction")).toHaveText("Sélectionne la cible");

  await page.keyboard.press("Escape");

  await expect(page.getByTestId("move-item").first()).toBeVisible();
  await expect(combatMenu.dialog).toHaveCount(0);
});

test("§4.20 Échap à la confirmation revient au choix de cible, sans ouvrir le menu de combat", async ({
  page,
  bootSandbox,
  combatMenu,
}) => {
  const scene = await bootSandbox(DUEL);
  await waitForPlayerTurn(page, combatMenu);
  await scene.aimFirstMove(DUMMY_TILE.x, DUMMY_TILE.y);
  await expect(page.getByTestId("combat-instruction")).toHaveText("Confirmer ?");

  await page.keyboard.press("Escape");

  await expect(page.getByTestId("combat-instruction")).toHaveText("Sélectionne la cible");
  await expect(combatMenu.dialog).toHaveCount(0);
});

test("§4.20 Échap au choix de destination revient au menu d'actions, sans ouvrir le menu de combat", async ({
  page,
  bootSandbox,
  combatMenu,
}) => {
  await bootSandbox(DUEL);
  await waitForPlayerTurn(page, combatMenu);
  await page.getByRole("button", { name: "Deplacement", exact: true }).click();
  await expect(page.getByTestId("combat-instruction")).toHaveText("Où se déplacer ?");

  await page.keyboard.press("Escape");

  // Le menu racine est revenu (la phase n'affichait qu'un « Annuler ») et la pastille d'instruction
  // est masquée. ⚠️ Son `textContent` n'est PAS vidé au masquage : `toBeHidden` est le seul signal
  // juste, `not.toHaveText` passerait pour une mauvaise raison.
  await expect(page.getByRole("button", { name: "Deplacement", exact: true })).toBeVisible();
  await expect(page.getByTestId("combat-instruction")).toBeHidden();
  await expect(combatMenu.dialog).toHaveCount(0);
});

test("§4.20 Échap au choix d'orientation referme le sélecteur, sans ouvrir le menu de combat", async ({
  page,
  bootSandbox,
  combatMenu,
}) => {
  await bootSandbox(DUEL);
  await waitForPlayerTurn(page, combatMenu);
  // « Attendre » ouvre le sélecteur d'orientation de fin de tour : la seule phase de plateau dont
  // l'annulation est servie par la scène AVANT l'orchestrateur (le picker a le premier refus).
  await page.getByRole("button", { name: "Attendre", exact: true }).click();
  await expect(page.getByTestId("combat-instruction")).toHaveText("Choisis l'orientation");

  await page.keyboard.press("Escape");

  await expect(page.getByRole("button", { name: "Attendre", exact: true })).toBeVisible();
  await expect(page.getByTestId("combat-instruction")).toBeHidden();
  await expect(combatMenu.dialog).toHaveCount(0);
});

test("§4.20 Échap au menu d'actions racine ouvre le menu de combat", async ({
  page,
  bootSandbox,
  combatMenu,
}) => {
  await bootSandbox(DUEL);
  await waitForPlayerTurn(page, combatMenu);

  await combatMenu.openByEscape();

  await expect(combatMenu.dialog).toBeVisible();
  await expect(combatMenu.title).toBeVisible();
  // L'ordre voulu : Reprendre d'abord (l'action par défaut, et la seule sortie d'un doigt), puis
  // Paramètres, puis les deux actions qui détruisent la tentative.
  await expect(combatMenu.resume).toBeVisible();
  await expect(combatMenu.settings).toBeVisible();
  await expect(combatMenu.restart).toBeVisible();
  await expect(combatMenu.abandon).toBeVisible();
  // « Quitter » n'existe que là où une sauvegarde de reprise existe : le studio sandbox n'en a pas,
  // donc l'entrée ne promet pas une reprise qui n'aurait rien à reprendre.
  await expect(combatMenu.quit).toHaveCount(0);
});

test("§4.20 Échap referme le menu de combat en une seule frappe, sans le rouvrir", async ({
  page,
  bootSandbox,
  combatMenu,
}) => {
  await bootSandbox(DUEL);
  await waitForPlayerTurn(page, combatMenu);
  await combatMenu.openByEscape();
  await expect(combatMenu.dialog).toBeVisible();

  await page.keyboard.press("Escape");

  // Le piège du double traitement : si le `cancel` natif du `<dialog>` n'était pas neutralisé, la
  // fermeture native produirait AUSSI l'action logique `Cancel`, qui n'ayant plus rien à annuler
  // rouvrirait le menu. Une frappe, une fermeture.
  await expect(combatMenu.dialog).toHaveCount(0);
  await expect(page.locator("dialog[open]")).toHaveCount(0);

  // L'entrée est bien revenue au combat (la registration de la modale s'est dépilée) : une flèche
  // reprend la navigation du menu d'actions…
  await page.keyboard.press("ArrowDown");
  await expect(page.getByTestId("action-menu").locator(":focus")).toHaveCount(1);
  // …et la modale est toujours fermée, pas rouverte un tick plus tard.
  await expect(combatMenu.dialog).toHaveCount(0);

  // Réouvrable : la fermeture n'a pas cassé la retombée d'`Échap`.
  await page.keyboard.press("Escape");
  await expect(combatMenu.dialog).toBeVisible();
});

test("§4.20 l'action « Menu de combat » remappée au clavier ouvre le menu", async ({
  page,
  bootSandbox,
  combatMenu,
}) => {
  await bindOpenMenuToKeyM(page);
  await bootSandbox(DUEL);
  await waitForPlayerTurn(page, combatMenu);

  await page.keyboard.press("KeyM");

  await expect(combatMenu.dialog).toBeVisible();
  await expect(combatMenu.title).toBeVisible();
});

test("§4.20 le dialogue de victoire garde la main : Échap ne le referme pas, le menu refuse de s'ouvrir", async ({
  page,
  bootSandbox,
  combatMenu,
}) => {
  await bindOpenMenuToKeyM(page);
  const scene = await bootSandbox(DUEL_LETHAL);
  await waitForPlayerTurn(page, combatMenu);
  await scene.castFirstMove(DUMMY_TILE.x, DUMMY_TILE.y);
  const victory = page.getByRole("dialog").filter({ hasText: /gagne/ });
  await expect(victory).toBeVisible({ timeout: 10_000 });

  await page.keyboard.press("Escape");

  // ⚠️ Trou refermé en fin de plan : la phase `battle_over` est un contexte de MENU, donc
  // son `cancel` retombait sur « rien à annuler » → `open()` refusé (un `dialog` est là) → le routeur
  // ne faisait pas `preventDefault()` → la fermeture NATIVE d'`Échap` emportait le dialogue de
  // victoire, définitivement (`showVictory` n'est appelé qu'une fois). Le `return true` inconditionnel
  // d'avant le plan 187 masquait le trou.
  await expect(victory).toBeVisible();
  await expect(victory.getByRole("button", { name: "Retour au menu" })).toBeVisible();
  await expect(combatMenu.dialog).toHaveCount(0);

  await page.keyboard.press("KeyM");

  // La victoire porte déjà ses propres sorties (Rejouer / Retour au menu) : deux modales empilées
  // n'auraient aucun sens, et la navigation de focus ne saurait laquelle servir.
  await expect(combatMenu.dialog).toHaveCount(0);
  await expect(victory).toBeVisible();
});

test("§4.20 les niveaux se dépilent un cran à la fois : Contrôles → Paramètres → menu → fermé", async ({
  page,
  bootSandbox,
  combatMenu,
}) => {
  await bootSandbox(DUEL);
  await waitForPlayerTurn(page, combatMenu);
  await combatMenu.openByEscape();

  await combatMenu.settings.click();
  await expect(combatMenu.settingsTitle).toBeVisible();
  await page.getByTestId("setting-controls").click();
  await expect(combatMenu.controlsTitle).toBeVisible();
  // La table des contrôles annonce l'action, donc elle est découvrable ET remappable — c'est la
  // seule chose qui apprend au joueur que `Start` ouvre ce menu (aucun défaut clavier : `Échap` fait
  // déjà le travail par sa retombée).
  await expect(page.getByTestId("control-open-combat-menu-pad")).toHaveText("Start");
  await expect(page.getByText("Menu de combat", { exact: true })).toBeVisible();

  await page.keyboard.press("Escape");

  // Sans pile explicite de niveaux, `Échap` dans les Contrôles ramènerait au combat en sautant les
  // Paramètres.
  await expect(combatMenu.controlsTitle).toHaveCount(0);
  await expect(combatMenu.settingsTitle).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(combatMenu.settingsTitle).toHaveCount(0);
  await expect(combatMenu.resume).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(combatMenu.dialog).toHaveCount(0);
});

test("§4.20 une capture de touche dans la modale renonce à la capture, pas au niveau", async ({
  page,
  bootSandbox,
  combatMenu,
}) => {
  const controls = new ControlsScreen(page);
  await bootSandbox(DUEL);
  await waitForPlayerTurn(page, combatMenu);
  await combatMenu.openByEscape();
  await combatMenu.settings.click();
  await page.getByTestId("setting-controls").click();
  await expect(combatMenu.controlsTitle).toBeVisible();

  await controls.cell("zoom-in", 0).click();
  await expect(controls.captureCancel).toBeVisible();
  await page.keyboard.press("Escape");

  // La capture a sa sortie inconditionnelle, servie AVANT le routeur : sans cette priorité, configurer
  // une touche refermerait le panneau au lieu de renoncer à la frappe.
  await expect(controls.captureCancel).toBeHidden();
  await expect(controls.cell("zoom-in", 0)).toHaveText("R"); // `Échap` n'est jamais assigné
  await expect(combatMenu.controlsTitle).toBeVisible(); // le niveau n'a pas été dépilé
  await expect(combatMenu.dialog).toBeVisible();
});

test("§4.20 ouvrir le menu n'annule rien : la visée en cours est retrouvée intacte", async ({
  page,
  bootSandbox,
  combatMenu,
}) => {
  const scene = await bootSandbox(DUEL);
  await waitForPlayerTurn(page, combatMenu);
  await openAttackList(page);
  await page.getByTestId("move-item").first().click();
  await expect(page.getByTestId("combat-instruction")).toHaveText("Sélectionne la cible");

  // Par le BOUTON, pas par `Échap` — qui reculerait d'un cran. C'est toute la différence entre les
  // deux entrées, et la raison pour laquelle ouvrir le menu par erreur ne coûte pas le choix en cours.
  await combatMenu.openByButton();
  await expect(combatMenu.dialog).toBeVisible();
  await combatMenu.resume.click();

  await expect(combatMenu.dialog).toHaveCount(0);
  await expect(page.getByTestId("combat-instruction")).toHaveText("Sélectionne la cible");
  // Et la phase n'est pas seulement affichée, elle est VIVANTE : désigner la cible fait avancer.
  await scene.hoverTile(DUMMY_TILE.x, DUMMY_TILE.y);
  await scene.clickTile(DUMMY_TILE.x, DUMMY_TILE.y);
  await expect(page.getByTestId("combat-instruction")).toHaveText("Confirmer ?");
});

test("§4.20 le bouton ☰ ouvre le menu, et se grise pendant un verrou d'animation", async ({
  page,
  bootSandbox,
  combatMenu,
}) => {
  const scene = await bootSandbox(DUEL);
  await waitForPlayerTurn(page, combatMenu);

  await combatMenu.openByButton();
  await expect(combatMenu.dialog).toBeVisible();
  await combatMenu.resume.click();
  await expect(combatMenu.dialog).toHaveCount(0);

  await scene.castFirstMove(DUMMY_TILE.x, DUMMY_TILE.y);

  // Pendant `locked` le menu ne s'ouvre pas — comme toute autre action. Au clavier et à la manette
  // une touche inerte ne se remarque pas ; un bouton tactile sans aucun retour se fait taper trois
  // fois de suite et se lit comme un bug. Le seul état visuel que le tactile a en propre.
  await expect.poll(() => combatMenu.openButton.isDisabled()).toBe(true);
  await expect(combatMenu.dialog).toHaveCount(0);
});

test("§4.20 la fermeture rend le focus à ce qui a ouvert le menu", async ({
  page,
  bootSandbox,
  combatMenu,
}) => {
  await bootSandbox(DUEL);
  await waitForPlayerTurn(page, combatMenu);

  await combatMenu.openByButton();
  // `showModal()` prend le focus (la modale le piège) : il a donc bien quitté le bouton, et le lui
  // rendre à la fermeture n'est pas gratuit.
  await expect(combatMenu.openButton).not.toBeFocused();

  await page.keyboard.press("Escape");

  // Sans ça le focus retombe sur `<body>` et la navigation clavier / manette repart de zéro au lieu
  // de reprendre où elle était.
  await expect(combatMenu.openButton).toBeFocused();
});

test("§4.20 « Recommencer » passe par une confirmation, et relance le combat depuis zéro", async ({
  page,
  bootSandbox,
  combatMenu,
}) => {
  await bootSandbox(DUEL);
  await waitForPlayerTurn(page, combatMenu);
  await combatMenu.openByEscape();

  await combatMenu.restart.click();

  // Un libellé PAR ACTION (décision 17) : « la partie sera perdue » serait vrai mais imprécis ici —
  // même carte, mêmes équipes, c'est la tentative qui saute, pas la partie.
  await expect(
    page.getByText(/Recommencer ce combat depuis le placement \?/, { exact: false }),
  ).toBeVisible();
  await expect(combatMenu.confirm).toBeVisible();
  await expect(combatMenu.confirmCancel).toBeVisible();
  await expect(combatMenu.restart).toHaveCount(0);

  await combatMenu.confirmCancel.click();

  // « Annuler » dépile d'un cran comme n'importe quel niveau : on revient au menu, rien n'est détruit.
  await expect(combatMenu.restart).toBeVisible();
  await expect(combatMenu.confirm).toHaveCount(0);

  await combatMenu.restart.click();
  await combatMenu.confirm.click();

  await expect(combatMenu.dialog).toHaveCount(0);
  // Le combat est vraiment remonté : voile de chargement d'un nouveau montage, puis chrome de neuf.
  await expect(page.getByTestId("loading-overlay")).toBeVisible();
  await expect(page.getByTestId("loading-overlay")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Attaque", exact: true })).toBeVisible();
});

test("§4.20 « Abandonner » passe par une confirmation, et rend la main au menu principal", async ({
  page,
  bootSandbox,
  combatMenu,
}) => {
  await bootSandbox(DUEL);
  await waitForPlayerTurn(page, combatMenu);
  await combatMenu.openByEscape();

  await combatMenu.abandon.click();

  // Texte distinct de celui de « Recommencer » : les deux détruisent la tentative, mais pas la même
  // chose ni pour la même raison.
  await expect(page.getByText(/Abandonner ce combat \?/, { exact: false })).toBeVisible();
  await expect(combatMenu.abandon).toHaveCount(0);

  await combatMenu.confirm.click();

  await expect(combatMenu.dialog).toHaveCount(0);
  await expect(new MainMenu(page).title).toBeVisible();
});

test("§4.20 « Quitter » n'existe qu'avec une sauvegarde, sort sans confirmation et la garde reprenable", async ({
  page,
  combatMenu,
}) => {
  // Deux combats RÉELS montés bout à bout (le second par la reprise) : le budget d'un test de
  // sandbox n'y suffit pas.
  test.slow();
  // Le seul chemin qui produit une sauvegarde de reprise est le chemin RÉEL (menu → carte → équipe →
  // combat) : ni la route de dev ni le studio sandbox n'y participent, et c'est précisément pour ça
  // que « Quitter » n'y apparaît pas. Il faut donc un vrai combat pour juger sa présence.
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);
  const maps = new MapSelectScreen(page);
  const teams = new TeamSelectScreen(page);
  const scene = new CombatScene(page);
  const store = new BattleResumeStore(page);

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

  await waitForRealBattleTurn(page, combatMenu);
  await expect.poll(() => store.actionCount(), { timeout: 15_000 }).toBeGreaterThanOrEqual(0);

  await combatMenu.openByButton();

  await expect(combatMenu.quit).toBeVisible();

  await combatMenu.quit.click();

  // Aucune confirmation : rien n'est perdu, et une confirmation sur une action réversible use le
  // réflexe jusqu'à ce qu'on valide sans lire — y compris devant l'abandon.
  await expect(combatMenu.confirm).toHaveCount(0);
  await expect(combatMenu.dialog).toHaveCount(0);
  await expect(menu.title).toBeVisible();
  // La partie est restée reprenable : c'est ce qui distingue « Quitter » d'« Abandonner », et ce qui
  // referme le chemin accidentel (fermer l'onglet préservait la partie, le menu ne le proposait pas).
  await expect(menu.resume).toBeVisible();

  await menu.resume.click();
  await scene.waitReady();
  await waitForRealBattleTurn(page, combatMenu);

  await combatMenu.openByButton();
  await combatMenu.abandon.click();
  await combatMenu.confirm.click();

  // « Abandonner », lui, détruit la partie : plus rien à reprendre au menu principal.
  await expect(menu.title).toBeVisible();
  await expect(menu.resume).toHaveCount(0);
});
