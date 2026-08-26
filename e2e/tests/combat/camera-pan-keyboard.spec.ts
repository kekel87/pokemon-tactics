import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { DUEL } from "../../fixtures/sandbox-configs";
import type { CombatScene } from "../../pages/CombatScene";

// Cahier §4.19 — panoramique caméra au clavier (plan 189, volet A). Au clavier seul, la caméra ne se
// DÉPLAÇAIT pas : le panoramique n'existait qu'au stick droit et au glissé du doigt.
//
// ⚠️ C'est le seul contrôle CONTINU du jeu : `input-system.ts` n'écoute que `keydown`, sans
// répétition, donc un appui ne produit qu'UNE action. Le maintien est une boucle
// `requestAnimationFrame` à part (`keyboard-hold-source.ts`) — d'où des tests qui TIENNENT la touche
// au lieu de la presser, et qui vérifient surtout que **le relâchement arrête la caméra**.
//
// La mécanique fine de la source (ajout/retrait, arrêt de la boucle, purge au `blur` et au
// `visibilitychange` — la touche « collée » d'un `Alt+Tab`) est couverte en unit :
// `app/input/keyboard-hold-source.test.ts`, 8 cas. Ici on ne juge que ce qui se voit à l'écran, une
// fois toute la chaîne branchée.
//
// ⚠️ **Les deux files ne sont pas la même.** Un `keydown`/`keyup` synthétique traverse la file
// d'ENTRÉE du navigateur, `page.evaluate` celle du script : une mesure prise juste après une frappe
// peut précéder son traitement de quelques frames. D'où un maintien qui attend la PREUVE que la
// caméra a bougé (plutôt qu'un nombre de frames fixe) et un sursis après la relâche.

/** Une case du plateau : sa position PROJETÉE suit la caméra. Un mesh épinglé à l'écran (boussole),
 *  lui, ne bougerait pas — c'est justement ce qui le rend inutilisable comme témoin de panoramique. */
const WITNESS_TILE = "tile_2_2";

/** Au-delà : la caméra a bougé pour de bon (~4 px d'écran par frame tenue). */
const PAN_MOVED_PX = 20;
/** En deçà : elle est à l'arrêt. Ce contrôle n'a aucune inertie — `panByPixels` aligne le but sur la
 *  cible, donc il ne reste rien à amortir. */
const PAN_STILL_PX = 2;
/** Frames laissées à la relâche pour que le `keyup` traverse la file d'entrée avant qu'on mesure. */
const RELEASE_FRAMES = 6;
/** Frames d'immobilité exigées après la relâche. Tenues, elles auraient déplacé la case de ~120 px. */
const STILL_FRAMES = 30;

/** L'axe d'écran sur lequel un panoramique se lit. Le rendu est isométrique mais la projection reste
 *  axée : les touches verticales ne déplacent que `top`, les horizontales que `left`. */
type Axis = "top" | "left";

interface Projected {
  readonly left: number;
  readonly top: number;
}

async function projectedTile(scene: CombatScene): Promise<Projected> {
  const box = await scene.meshViewportBox(WITNESS_TILE);
  if (box === null) {
    throw new Error(`mesh absent de la scène : ${WITNESS_TILE}`);
  }
  return { left: box.left, top: box.top };
}

/**
 * Attendre un nombre de FRAMES, pas un délai en millisecondes (`waitForTimeout` est banni, et pour
 * une raison qui vaut doublement ici) : le panoramique avance d'un pas par frame rendue, donc c'est
 * la frame qui est l'unité de ce contrôle. Un délai mesurerait la charge de la machine.
 */
function waitFrames(page: Page, frames: number): Promise<void> {
  return page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let left = count;
        const step = (): void => {
          left -= 1;
          if (left <= 0) {
            resolve();
            return;
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    frames,
  );
}

/**
 * Tenir une touche jusqu'à ce que la caméra ait visiblement bougé sur `axis`, puis la rendre.
 *
 * L'attente est une assertion : si rien ne bouge, elle expire et le test échoue — c'est *ça*, la
 * preuve que le maintien panote. Un nombre de frames fixe, lui, mesurerait la latence du pilote
 * autant que le jeu (constaté à l'écriture : sous charge, le `keydown` arrivait après le compte).
 */
async function holdUntilMoved(
  page: Page,
  scene: CombatScene,
  press: () => Promise<void>,
  release: () => Promise<void>,
  axis: Axis,
): Promise<{ from: Projected; to: Projected }> {
  const from = await projectedTile(scene);
  await press();
  await expect
    .poll(async () => Math.abs((await projectedTile(scene))[axis] - from[axis]))
    .toBeGreaterThan(PAN_MOVED_PX);
  await release();
  await waitFrames(page, RELEASE_FRAMES);
  return { from, to: await projectedTile(scene) };
}

/**
 * Le tour du joueur est ouvert et le contexte n'est plus `locked`.
 *
 * ⚠️ **Sans cette porte, le panoramique est purement ignoré** : `handleViewAction` n'est atteint
 * qu'hors verrou, et le verrou de démarrage de tour dure d'autant plus longtemps que la machine est
 * chargée. La boucle de maintien, elle, tourne quand même — elle réémet une action que le routeur
 * jette. En isolation le boot devançait le verrou ; sous la charge de la suite, les tests panotaient
 * dans le vide (constaté 2026-08-26). Même piège que celui documenté en §4.19 pour les flèches.
 */
async function waitForPlayerTurn(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Attaque", exact: true })).toBeVisible({
    timeout: 30_000,
  });
}

/** Le cas courant : une seule touche tenue puis rendue. */
function hold(
  page: Page,
  scene: CombatScene,
  code: string,
  axis: Axis,
): Promise<{ from: Projected; to: Projected }> {
  return holdUntilMoved(
    page,
    scene,
    () => page.keyboard.down(code),
    () => page.keyboard.up(code),
    axis,
  );
}

test("clavier : un maintien de Numpad8 panote la caméra, et le relâchement l'arrête", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DUEL);
  await waitForPlayerTurn(page);

  // L'attente interne EST l'assertion « ça panote » : sans elle, la caméra ne bougerait jamais et le
  // maintien expirerait ici.
  const { to } = await hold(page, scene, "Numpad8", "top");

  // La contre-épreuve, et le vrai enjeu du modèle continu : autant de frames APRÈS la relâche ne
  // doivent plus rien déplacer. Une touche restée « collée » ferait dériver le plateau tout seul.
  await waitFrames(page, STILL_FRAMES);
  const settled = await projectedTile(scene);

  expect(Math.abs(settled.top - to.top)).toBeLessThan(PAN_STILL_PX);
});

test("clavier : Numpad8 et Numpad2 panotent dans des sens opposés", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DUEL);
  await waitForPlayerTurn(page);

  // Le pavé numérique dessine physiquement la croix 8/2/4/6 (décision 1) : les deux touches
  // verticales se défont l'une l'autre au lieu de s'ajouter.
  const up = await hold(page, scene, "Numpad8", "top");
  const down = await hold(page, scene, "Numpad2", "top");

  expect(Math.sign(up.to.top - up.from.top)).toBe(-Math.sign(down.to.top - down.from.top));
});

test("clavier : Numpad4 et Numpad6 panotent horizontalement, dans des sens opposés", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DUEL);
  await waitForPlayerTurn(page);

  const left = await hold(page, scene, "Numpad4", "left");
  const right = await hold(page, scene, "Numpad6", "left");

  expect(Math.sign(left.to.left - left.from.left)).toBe(
    -Math.sign(right.to.left - right.from.left),
  );
});

test("clavier : Maj + flèche panote aussi, pour les claviers sans pavé numérique", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DUEL);
  await waitForPlayerTurn(page);

  // Jeu de secours FIXE (décision 2) : il ne passe pas par le magasin de bindings et n'est jamais
  // capturable — un portable sans pavé numérique doit pouvoir paner sans passer par l'écran de
  // contrôles. Il n'est consulté qu'en repli, donc il ne vole aucune touche assignée par le joueur.
  const { from, to } = await holdUntilMoved(
    page,
    scene,
    async () => {
      await page.keyboard.down("Shift");
      await page.keyboard.down("ArrowUp");
    },
    async () => {
      await page.keyboard.up("ArrowUp");
      await page.keyboard.up("Shift");
    },
    "top",
  );

  expect(Math.abs(to.top - from.top)).toBeGreaterThan(PAN_MOVED_PX);
});

test("clavier : Numpad1 ne pose plus de cran de zoom, le pavé numérique est passé à la caméra", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DUEL);
  await waitForPlayerTurn(page);

  const tileWidth = async (): Promise<number> => {
    const box = await scene.meshViewportBox(WITNESS_TILE);
    return box === null ? 0 : box.right - box.left;
  };
  /** Le zoom est LISSÉ (`tick` amortit vers la cible) : deux lectures identiques disent qu'il est
   *  arrivé. Mesuré en vol, il donnerait deux largeurs différentes pour un même cran. */
  const settledTileWidth = async (): Promise<number> => {
    let previous = -1;
    await expect
      .poll(async () => {
        const current = await tileWidth();
        const settled = current > 0 && current === previous;
        previous = current;
        return settled;
      })
      .toBe(true);
    return tileWidth();
  };

  // Cran 3 : la vue la plus rapprochée. `Numpad1` y ramenait autrefois la vue la plus large.
  await page.keyboard.press("Digit3");
  const closest = await settledTileWidth();

  await page.keyboard.press("Numpad1");
  await waitFrames(page, STILL_FRAMES);

  // Décision 3 : le pavé numérique devient « la caméra », la rangée de chiffres garde les crans de
  // zoom. `Numpad1/2/3` ont donc quitté les défauts — régression assumée, annoncée au changelog.
  expect(await settledTileWidth()).toBeCloseTo(closest, 0);
});
