import { expect, test } from "../../fixtures";
import { DUEL } from "../../fixtures/sandbox-configs";

// Contrôles clavier (plan 184, Lot 2). Cahier de recette : docs/test-plan.md §4.19.
//
// ⚠️ Les bindings sont des POSITIONS de touche (`KeyboardEvent.code`), pas des caractères : presser
// `KeyW` désigne la touche physique (Z en AZERTY, W en QWERTY), donc la disposition de la machine de
// test n'entre pas en jeu.
//
// ⚠️ Le contexte décide de ce que font les flèches. Depuis le menu d'actions elles déplacent le
// FOCUS (contexte `menu`) ; il faut être dans une phase de plateau (« Déplacement ») pour qu'elles
// pilotent le CURSEUR. C'est le cœur du routage de ce lot, et la première version de ce fichier s'y
// est trompée.
//
// Géométrie de `DUEL` : lanceur en (2,3) face au nord, cible en (2,2). Depuis (2,3), ↑ mène donc sur
// la cible et ↓ sur une case libre.

const ACTIVE_TILE = { x: 2, y: 3 };
const NORTH_TILE = { x: 2, y: 2 };
const SOUTH_TILE = { x: 2, y: 4 };

/**
 * Attend que la rotation de caméra ait fini de s'animer. La zone tapable de la boussole est épinglée
 * à l'écran, donc sa position MONDE est reprojetée à chaque frame pendant que la vue orbite : elle
 * cesse de bouger quand la rotation est arrivée. Sans cette attente, la flèche suivante serait
 * mesurée sur une caméra à mi-course, entre deux axes de grille.
 *
 * ⚠️ Ce mesh-ci et pas `compass` : l'aiguille est enfant du nœud racine de la boussole, donc sa
 * `position` est locale et ne bouge jamais. (Avant le plan 185, c'était le glyphe d'anneau, mesh
 * depuis supprimé.)
 */
async function waitForCameraSettled(scene: {
  meshInfo(name: string): Promise<{ position: { x: number; y: number; z: number } } | null>;
}): Promise<void> {
  const position = async (): Promise<string> =>
    JSON.stringify((await scene.meshInfo("compass_pick_proxy"))?.position ?? null);
  let previous = "";
  await expect
    .poll(async () => {
      const current = await position();
      const stable = current === previous;
      previous = current;
      return stable;
    })
    .toBe(true);
}

/** Entre dans une phase de plateau, où les flèches pilotent le curseur. */
async function enterBoardPhase(page: import("@playwright/test").Page): Promise<void> {
  await page.getByRole("button", { name: "Déplacement", exact: true }).click();
}

test("clavier : une flèche pose le curseur, sans souris", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(DUEL);
  await enterBoardPhase(page);

  expect(await scene.cursorTile()).toBeNull();

  await page.keyboard.press("ArrowUp");

  // Sans souris, rien ne pouvait désigner une case avant ce lot : le curseur n'existait que comme
  // conséquence d'un `pointermove`. Il part de la case que la caméra a centrée (le Pokemon actif).
  expect(await scene.cursorTile()).toEqual(NORTH_TILE);
});

test("clavier : chaque flèche déplace le curseur d'exactement une case", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DUEL);
  await enterBoardPhase(page);

  await page.keyboard.press("ArrowDown");
  expect(await scene.cursorTile()).toEqual(SOUTH_TILE);

  await page.keyboard.press("ArrowDown");
  expect(await scene.cursorTile()).toEqual({ x: 2, y: 5 });
});

test("clavier : la flèche opposée ramène le curseur sur ses pas", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(DUEL);
  await enterBoardPhase(page);

  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowDown");

  expect(await scene.cursorTile()).toEqual(ACTIVE_TILE);
});

test("clavier : ZQSD (les positions WASD) fait la même chose que les flèches", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DUEL);
  await enterBoardPhase(page);

  // `KeyS` est la touche physique S : S en AZERTY comme en QWERTY, et le bas du pavé dans les deux.
  await page.keyboard.press("KeyS");

  expect(await scene.cursorTile()).toEqual(SOUTH_TILE);
});

test("clavier : le curseur s'arrête au bord de la carte", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(DUEL);
  await enterBoardPhase(page);

  for (let press = 0; press < 30; press++) {
    await page.keyboard.press("ArrowUp");
  }

  // Il s'arrête sur le plateau au lieu de sortir de la grille ou de disparaître.
  const cursor = await scene.cursorTile();
  expect(cursor).not.toBeNull();
  expect(cursor?.x).toBeGreaterThanOrEqual(0);
  expect(cursor?.y).toBeGreaterThanOrEqual(0);
});

test("clavier : le curseur suit l'ÉCRAN, donc une rotation change ce que fait une flèche", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DUEL);
  await enterBoardPhase(page);

  await page.keyboard.press("ArrowUp");
  expect(await scene.cursorTile()).toEqual(NORTH_TILE);
  await page.keyboard.press("ArrowDown");

  // `KeyE` = E en AZERTY comme en QWERTY : un quart de tour de la vue (4 azimuts iso).
  await page.keyboard.press("KeyE");
  await waitForCameraSettled(scene);
  await page.keyboard.press("ArrowUp");

  // Même touche, autre axe de grille : c'est toute la différence entre un curseur écran-relatif et
  // un curseur grille-relatif, qui aurait redonné la même case — incohérente avec ce qu'on voit.
  expect(await scene.cursorTile()).not.toEqual(NORTH_TILE);
});

test("clavier : Espace valide la case sous le curseur", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(DUEL);
  await enterBoardPhase(page);

  await page.keyboard.press("ArrowDown");
  expect(await scene.cursorTile()).toEqual(SOUTH_TILE);

  await page.keyboard.press("Space");

  // Le déplacement est parti : le menu propose de l'annuler (même signal que le tap du plan 183).
  await expect(
    page.getByRole("button", { name: "Annuler déplacement", exact: true }),
  ).toBeVisible();
});

test("clavier : Échap sort de la phase en cours", async ({ page, bootSandbox }) => {
  await bootSandbox(DUEL);

  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  await page.getByTestId("move-item").first().click();
  await expect(page.getByTestId("combat-instruction")).toHaveText("Sélectionne la cible");

  await page.keyboard.press("Escape");

  // Échap remonte d'UN cran : on revient à la liste d'attaques, pas au menu racine.
  await expect(page.getByTestId("move-item").first()).toBeVisible();
});

test("clavier : les flèches naviguent le menu d'actions", async ({ page, bootSandbox }) => {
  await bootSandbox(DUEL);

  const move = page.getByRole("button", { name: "Déplacement", exact: true });
  const attack = page.getByRole("button", { name: "Attaque", exact: true });
  // Le menu doit être là AVANT la première touche : pendant que le tour drenne ses events de
  // démarrage, le contexte est `locked` et une pression est ignorée — à raison, mais le test
  // compterait alors une flèche de moins (échec sous charge, pas en solo).
  await expect(attack).toBeVisible();

  await page.keyboard.press("ArrowDown");
  await expect(move).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await expect(attack).toBeFocused();

  await page.keyboard.press("ArrowUp");
  await expect(move).toBeFocused();
});

test("clavier : le focus survit au changement de phase du menu", async ({ page, bootSandbox }) => {
  await bootSandbox(DUEL);

  // Tout au clavier : chaque phase reconstruit le menu (`replaceChildren`), ce qui éjectait le focus
  // vers `<body>` — la navigation repartait de zéro à chaque étape d'un tour. Le menu ne reprend le
  // focus que si la source active EST le clavier : à la souris, un liseré sous un curseur immobile
  // se lirait comme un bug (d'où le tout-clavier ici).
  await expect(page.getByRole("button", { name: "Attaque", exact: true })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("button", { name: "Attaque", exact: true })).toBeFocused();

  await page.keyboard.press("Space");

  await expect(page.getByTestId("move-item").first()).toBeFocused();
});

test("clavier : les 3 crans de zoom sont sur la rangée de chiffres", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DUEL);
  await enterBoardPhase(page);

  // Une case du plateau : sa taille projetée suit le zoom (la boussole, elle, est épinglée à l'écran
  // et ne bougerait pas). Le zoom est lissé → assertions qui convergent.
  const tileWidth = async (): Promise<number> => {
    const box = await scene.meshViewportBox("highlight_move_2_4");
    return box === null ? 0 : box.right - box.left;
  };

  await page.keyboard.press("Digit1");
  await expect.poll(tileWidth).toBeGreaterThan(0);
  const widest = await tileWidth();

  await page.keyboard.press("Digit3");
  // Cran 1 = la vue la plus large, cran 3 = la plus rapprochée : la même case y occupe plus de pixels.
  await expect.poll(tileWidth).toBeGreaterThan(widest * 1.5);
});

test("clavier : rien n'est consommé pendant qu'une animation joue", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DUEL);
  await enterBoardPhase(page);

  await page.keyboard.press("ArrowDown");
  expect(await scene.cursorTile()).toEqual(SOUTH_TILE);
  await page.keyboard.press("Space");

  // Contexte `locked` pendant la résolution : le curseur s'efface (plus rien n'est pointable, et le
  // laisser afficherait la fiche du mon visé comme si on visait encore) et aucune flèche ne le
  // ressuscite — c'est la preuve qu'aucune entrée n'est consommée.
  await expect.poll(() => scene.cursorTile()).toBeNull();
  for (const arrow of ["ArrowUp", "ArrowRight", "ArrowLeft"]) {
    await page.keyboard.press(arrow);
  }

  expect(await scene.cursorTile()).toBeNull();
});
