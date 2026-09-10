import { expect, test } from "../../fixtures";
import { BrowserHistory } from "../../pages/browser-history";
import { MainMenu } from "../../pages/MainMenu";
import { BattleModeScreen, MapSelectScreen, TeamSelectScreen } from "../../pages/screens";
import { MyTeamsScreen, PokemonPicker, TeamEditScreen } from "../../pages/teamBuilder";

// Cahier §6.0 — le retour du navigateur remonte d'un écran (plan 205).
//
// Ce qui est réellement en jeu ici n'est pas « le bouton précédent marche », c'est la FORME retenue :
// une seule entrée d'historique, réarmée après chaque retour consommé. Trois choses en découlent,
// et chacune a son test :
//
//  1. rien n'est armé avant le premier geste du joueur — Chrome fait sauter une entrée empilée sans
//     activation utilisateur, donc armer au démarrage donnerait une sentinelle IGNORÉE ;
//  2. `history.length` ne grandit jamais — sinon il faudrait deux retours, puis trois, pour remonter
//     d'un écran ;
//  3. au menu principal personne ne consomme l'annulation, et le geste doit alors faire ce qu'il
//     annonce : quitter.
//
// Le retour est routé dans le `cancel` de l'`InputSystem` : ce sont donc les `goBack` de chaque
// écran, déjà câblés, qui font la navigation. Aucun écran n'a été modifié par le plan.
//
// 🔴 Ce que ce fichier ne couvre PAS, et pourquoi : la fenêtre de montage ASYNCHRONE d'un écran.
// `ScreenManager.transitionTo` démonte le sortant PUIS attend `mount`, donc entre les deux la pile
// d'entrée est vide et `cancel` rend `false` — sans que la racine soit atteinte pour autant. La
// fenêtre dure ce que dure un `joinAsGuest` (aller-retour réseau), et la viser d'ici demanderait de
// jouer un retour DANS une course : le test ne prouverait que sa propre gigue. Le contrat y est tenu
// par les unitaires de `browser-back.test.ts` (« ne sort JAMAIS du jeu hors racine, même si personne
// ne consomme l'annulation » et « … quand la couche d'entrée n'existe pas encore »), qui posent
// exactement l'état que cette fenêtre produit, sans l'attendre.

test("§6.0 rien n'est armé avant le premier geste du joueur, la sentinelle naît avec lui", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  const historyStack = new BrowserHistory(page);
  await menu.goto();

  // Le chargement seul n'empile RIEN. Une entrée poussée sans activation utilisateur est traitée par
  // Chrome comme une manipulation d'historique et sautée par le bouton précédent : la sentinelle
  // serait inerte précisément là où on l'attend.
  expect(await historyStack.sentinelArmed()).toBe(false);
  const beforeGesture = await historyStack.length();

  await historyStack.armByPlayerGesture();

  expect(await historyStack.sentinelArmed()).toBe(true);
  expect(await historyStack.length()).toBe(beforeGesture + 1);

  // Et une seule, quels que soient les gestes suivants : `arm()` reconnaît sa propre entrée.
  await historyStack.armByPlayerGesture();
  await menu.combat.click();

  expect(await historyStack.length()).toBe(beforeGesture + 1);
});

test("§6.0 le retour remonte d'un écran (choix de la carte → mode de combat) sans empiler d'entrée", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  const battleMode = new BattleModeScreen(page);
  const mapSelect = new MapSelectScreen(page);
  const historyStack = new BrowserHistory(page);

  await menu.goto();
  // Le clic est déjà un geste du joueur : la sentinelle s'arme là, sans rien de plus à jouer.
  await menu.combat.click();
  await battleMode.local.click();
  await expect(mapSelect.title).toBeVisible();
  const armedLength = await historyStack.length();

  await historyStack.back();

  // Le `goBack` de l'écran, celui-là même que son bouton « Retour » appelle.
  await expect(battleMode.title).toBeVisible();
  await expect(mapSelect.title).toHaveCount(0);
  // Réarmée, donc un second retour marchera — et la pile n'a pas grandi d'un cran au passage.
  expect(await historyStack.sentinelArmed()).toBe(true);
  expect(await historyStack.length()).toBe(armedLength);
  // L'URL ne change JAMAIS : aucun écran n'est associé à une entrée (pas de liens profonds, hors
  // périmètre assumé du plan). Un test qui verrait une URL bouger verrait un autre design.
  expect(new URL(page.url()).search).toBe("");
});

test("§6.0 au menu principal personne ne consomme le retour : la page est quittée", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  const historyStack = new BrowserHistory(page);

  // Une entrée AVANT le jeu, sans quoi « quitter » n'est observable nulle part : dans un onglet neuf
  // il n'y a rien derrière, et le geste est un no-op — comme sur n'importe quel site. Un document
  // servi par l'application, mais qui n'est pas l'application (donc aucun boot à payer).
  await page.goto("/manifest.json");
  await menu.goto();
  await historyStack.armByPlayerGesture();
  expect(await historyStack.sentinelArmed()).toBe(true);

  await historyStack.back();

  // Le menu principal s'enregistre SANS `onBack` : son `cancel` rend `false`, le retour n'est pas
  // consommé, et le module POURSUIT vers l'extérieur au lieu de ne rien faire du tout.
  await page.waitForURL(/manifest\.json$/);
  // Corollaire : la sentinelle n'a pas été réarmée. C'est la moitié qui casserait si on réarmait
  // inconditionnellement — le joueur resterait alors prisonnier du menu principal.
  expect(await historyStack.sentinelArmed()).toBe(false);
});

test("§6.0 après un rechargement, UN seul retour remonte d'un écran et la pile n'a pas grandi", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  const battleMode = new BattleModeScreen(page);
  const mapSelect = new MapSelectScreen(page);
  const historyStack = new BrowserHistory(page);

  await menu.goto();
  await menu.combat.click();
  await battleMode.local.click();
  await expect(mapSelect.title).toBeVisible();
  const armedLength = await historyStack.length();

  await page.reload();

  // L'écran est restauré par `screen-persistence` (`pt-last-screen`), et l'entrée d'historique, elle,
  // a survécu telle quelle au rechargement.
  await expect(mapSelect.title).toBeVisible();
  expect(await historyStack.sentinelArmed()).toBe(true);

  // Le geste qui suit le rechargement ne doit PAS empiler une seconde sentinelle : sans la
  // reconnaissance de sa propre entrée, chaque rechargement coûterait un retour de plus au joueur.
  await historyStack.armByPlayerGesture();
  expect(await historyStack.length()).toBe(armedLength);

  await historyStack.back();

  await expect(battleMode.title).toBeVisible();
  expect(await historyStack.length()).toBe(armedLength);
});

// §6.0 — une modale que PERSONNE n'a fermée (le défaut relevé à la revue du plan 205).
//
// `bindScreenInput` rend `false` quand un `<dialog>` est ouvert et que la modalité n'est pas la
// manette : il compte sur la fermeture NATIVE du dialogue, celle qu'une frappe d'`Échap` déclenche
// derrière l'action logique (décision #822). Un `popstate` n'a aucun repli natif — et tant que
// « personne n'a consommé » valait « on est à la racine », le geste sortait du jeu depuis n'importe
// quelle modale d'écran de menu. Mesuré à la main le 2026-09-10 en trois gestes : « Sélection
// d'équipe » → sélecteur d'équipe → bouton précédent → onglet sur `about:blank`, partie perdue.
//
// Les deux tests qui suivent jugent le repli : la modale se ferme, l'écran reste, et rien n'a été
// empilé au passage. Ils tomberaient si on retirait `closeOpenModal` — la modale resterait ouverte,
// le geste ne ferait plus rien.

test("§6.0 le retour, un sélecteur d'équipe OUVERT, referme la modale et laisse l'écran en place", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  const battleMode = new BattleModeScreen(page);
  const mapSelect = new MapSelectScreen(page);
  const teamSelect = new TeamSelectScreen(page);
  const historyStack = new BrowserHistory(page);

  // Une entrée AVANT le jeu, sinon « quitter » ne serait observable nulle part : dans un onglet neuf
  // le geste est un no-op, donc une régression qui sortirait du jeu passerait pour un succès.
  await page.goto("/manifest.json");
  await menu.goto();
  await menu.combat.click();
  await battleMode.local.click();
  await expect(mapSelect.title).toBeVisible();
  await mapSelect.confirm.click();
  await expect(teamSelect.title).toBeVisible();

  // Le sélecteur d'équipe du camp 1 : un `<dialog>` sans registration d'entrée à lui, qui n'a donc
  // qu'`Échap` pour sortir — c'est très exactement le trou.
  await teamSelect.teamButton(0).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const armedLength = await historyStack.length();

  await historyStack.back();

  // La modale se ferme d'elle-même (`Modal` retire son élément sur l'événement `close`)…
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // …et on est TOUJOURS dans le jeu, sur l'écran d'où l'on vient : le retour a coûté la modale, pas
  // la partie en préparation.
  await expect(teamSelect.title).toBeVisible();
  await expect(teamSelect.launch).toBeVisible();
  // Réarmée, pile inchangée : le geste suivant remontera d'un écran, comme partout ailleurs.
  expect(await historyStack.sentinelArmed()).toBe(true);
  expect(await historyStack.length()).toBe(armedLength);

  // Et il le fait : le second retour est celui que la modale avait absorbé.
  await historyStack.back();

  await expect(mapSelect.title).toBeVisible();
});

test("§6.0 le même repli vaut pour le sélecteur de Pokemon du Constructeur d'équipe", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  const myTeams = new MyTeamsScreen(page);
  const edit = new TeamEditScreen(page);
  const picker = new PokemonPicker(page);
  const historyStack = new BrowserHistory(page);

  await menu.goto();
  await menu.teamBuilder.click();
  await myTeams.newTeam.click();

  // Un autre écran, une autre modale, le même défaut : tous les sélecteurs sont bâtis sur le `Modal`
  // partagé, aucun n'enregistre d'entrée à lui. Un seul second cas suffit donc à prouver que le
  // repli vit dans le module de retour et non dans un écran particulier.
  await edit.slot(1).click();
  await expect(picker.dialog).toBeVisible();
  const armedLength = await historyStack.length();

  await historyStack.back();

  await expect(picker.dialog).toHaveCount(0);
  await expect(edit.slot(1)).toBeVisible();
  expect(await historyStack.sentinelArmed()).toBe(true);
  expect(await historyStack.length()).toBe(armedLength);
});
