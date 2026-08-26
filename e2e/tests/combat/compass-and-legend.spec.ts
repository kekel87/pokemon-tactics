import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { DUEL } from "../../fixtures/sandbox-configs";
import type { CombatScene, MeshScreenBox } from "../../pages/CombatScene";

// Cahier §4.18 — boussole tapable (plan 183) + légende de contrôles caméra (plan 185).
//
// Le glyphe d'anneau qui vivait à droite de la boussole était un MESH ; il est devenu une légende
// DOM posée autour d'elle (plan 185), donc ce spec a deux moitiés :
//   - la boussole, interrogée par projection (`meshScreenBox`) parce qu'elle est épinglée à l'ÉCRAN :
//     sa position monde est recalculée depuis la caméra à chaque frame et ne dit rien de sa place ;
//   - la légende, interrogée par locators, comme n'importe quel morceau de chrome.
//
// Le DESSIN des tuiles (et le sens perçu des flèches de rotation) reste 👁, comme la lecture au doigt
// sur téléphone réel.

const TAP_AREA = "compass_pick_proxy";
const COMPASS = "compass";
/** Plancher de cible tactile de la boussole : son aiguille ne fait que ~17 px de large. */
const TOUCH_FLOOR_PX = 44;
/** Écart entre le bord droit de la timeline et ce que le moteur épingle à côté (`chrome-insets`). */
const CHROME_CLEARANCE_PX = 6;
/** Un cran de rotation déplace la caméra de plusieurs unités monde ; au repos la dérive est nulle. */
const ROTATION_WORLD_EPSILON = 0.05;

interface WorldPosition {
  x: number;
  y: number;
  z: number;
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const distance = (from: WorldPosition, to: WorldPosition): number =>
  Math.hypot(from.x - to.x, from.y - to.y, from.z - to.z);

/**
 * Position MONDE de la zone tapable — le signal de rotation.
 *
 * Pas celle du mesh `compass` : celui-ci est enfant du nœud racine de la boussole, donc sa
 * `position` est LOCALE et vaut (0,0,0) à jamais. Le proxy de picking, lui, n'est parenté à rien et
 * est replacé en coordonnées monde à chaque frame depuis la base de la caméra : il ne bouge que
 * quand la caméra tourne, ce qui en fait exactement le témoin cherché.
 */
const pinnedPosition = async (scene: CombatScene): Promise<WorldPosition> => {
  const info = await scene.meshInfo(TAP_AREA);
  if (info === null) {
    throw new Error(`mesh absent de la scène : ${TAP_AREA}`);
  }
  return info.position;
};

const screenBox = async (scene: CombatScene, name: string): Promise<MeshScreenBox> => {
  const box = await scene.meshViewportBox(name);
  if (box === null) {
    throw new Error(`mesh absent de la scène : ${name}`);
  }
  return box;
};

/** Boîte du premier portrait de la timeline : la boussole prend sa TAILLE et son ANCRAGE dessus
 *  (mesuré à l'exécution par `chrome-insets.ts`), donc c'est la référence de tout le reste. */
const portraitBox = async (page: Page): Promise<Box & { height: number }> => {
  const box = await page.getByTestId("timeline-portrait").first().boundingBox();
  if (box === null) {
    throw new Error("premier portrait de la timeline absent");
  }
  return {
    left: box.x,
    right: box.x + box.width,
    top: box.y,
    bottom: box.y + box.height,
    height: box.height,
  };
};

const domBox = async (page: Page, testId: string): Promise<Box> => {
  const box = await page.getByTestId(testId).boundingBox();
  if (box === null) {
    throw new Error(`élément absent du DOM : ${testId}`);
  }
  return { left: box.x, right: box.x + box.width, top: box.y, bottom: box.y + box.height };
};

/** Carré que le renderer dessine la boussole dedans : bord droit du portrait + dégagement, côté = sa
 *  hauteur (`chrome-insets.ts`). La légende DOM se place sur ces mêmes nombres, donc c'est la
 *  référence commune — pas la zone tapable, qui peut être PLUS GRANDE (plancher de cible tactile). */
const compassSquare = async (page: Page): Promise<Box & { side: number }> => {
  const portrait = await portraitBox(page);
  const left = portrait.right + CHROME_CLEARANCE_PX;
  return {
    left,
    right: left + portrait.height,
    top: portrait.top,
    bottom: portrait.top + portrait.height,
    side: portrait.height,
  };
};

/** Tuile de la feuille dessinée par un glyphe : le CSS la publie en propriétés personnalisées, donc
 *  elle se lit comme une valeur — pas besoin d'une capture d'écran pour vérifier un dessin. */
const glyphTile = async (page: Page, testId: string): Promise<string> =>
  page.getByTestId(testId).evaluate((element) => {
    const style = getComputedStyle(element);
    const column = style.getPropertyValue("--cl-col").trim();
    const line = style.getPropertyValue("--cl-row").trim();
    return `${column}/${line}`;
  });

/** Position monde épinglée une fois la caméra au repos. La rotation est amortie sur plusieurs
 *  frames : deux lectures consécutives identiques signifient qu'aucun easing n'est en vol, donc
 *  qu'on compare deux états stables et non un instantané pris au milieu d'un mouvement. */
const settledPinnedPosition = async (scene: CombatScene): Promise<WorldPosition> => {
  let previous: WorldPosition | null = null;
  await expect
    .poll(async () => {
      const current = await pinnedPosition(scene);
      const settled = previous !== null && distance(previous, current) === 0;
      previous = current;
      return settled;
    })
    .toBe(true);
  return pinnedPosition(scene);
};

/** Attend que la boussole soit chargée ET épinglée au moins une fois : avant l'épinglage, le proxy
 *  de picking traîne à l'origine du monde, au milieu du plateau. Le chrome monte APRÈS la scène, qui
 *  épingle d'abord sur ses constantes de repli — on attend donc que la mesure du portrait ait
 *  atterri, en surveillant la seule relation qui en dépend. */
const waitPinned = async (page: Page, scene: CombatScene): Promise<void> => {
  await expect.poll(() => scene.countByName(COMPASS)).toBe(1);
  await expect
    .poll(async () => (await screenBox(scene, TAP_AREA)).left - (await portraitBox(page)).right)
    .toBeCloseTo(CHROME_CLEARANCE_PX, 0);
};

test("§4.18 la zone tapable de la boussole est un carré ancré sur le premier portrait", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DUEL);
  await waitPinned(page, scene);

  const area = await screenBox(scene, TAP_AREA);
  const portrait = await portraitBox(page);
  const side = Math.max(portrait.height, TOUCH_FLOOR_PX);

  // CARRÉ, et rien de plus : la zone était un rectangle étiré à droite pour englober le mesh de
  // glyphe, devenu du DOM inerte sous la boussole (plan 185). Plus large que le carré, elle rendrait
  // tapable du plateau que rien n'annonce.
  expect(area.right - area.left).toBeCloseTo(side, 0);
  expect(area.bottom - area.top).toBeCloseTo(side, 0);

  // Et elle ne grandit que vers la DROITE : son bord gauche reste celui de la boussole, sinon le
  // plancher de cible tactile la ferait mordre sur le portrait de la timeline (constaté en e2e).
  expect(area.left).toBeCloseTo(portrait.right + CHROME_CLEARANCE_PX, 0);
});

test("§4.18 cliquer la boussole fait tourner la vue", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(DUEL);
  await waitPinned(page, scene);

  const before = await settledPinnedPosition(scene);
  const area = await screenBox(scene, TAP_AREA);

  await scene.clickViewportPoint((area.left + area.right) / 2, (area.top + area.bottom) / 2);

  // La caméra orbite d'un cran → la boussole, épinglée à l'écran, est reprojetée depuis une autre
  // base de caméra, donc sa position MONDE change (sa position écran, elle, ne bouge pas).
  await expect
    .poll(async () => distance(before, await pinnedPosition(scene)))
    .toBeGreaterThan(ROTATION_WORLD_EPSILON);
});

test("§4.18 cliquer sous la boussole ne fait pas tourner la vue", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(DUEL);
  await waitPinned(page, scene);

  const before = await settledPinnedPosition(scene);
  const area = await screenBox(scene, TAP_AREA);

  // Juste sous la zone tapable : c'est du plateau, et une pression là doit rester au plateau — la
  // légende qui vit désormais à cet endroit est explicitement inerte (`pointer-events: none`).
  await scene.clickViewportPoint((area.left + area.right) / 2, area.bottom + 8);
  expect(distance(before, await settledPinnedPosition(scene))).toBeLessThan(ROTATION_WORLD_EPSILON);

  // Contre-épreuve dans le MÊME test : la pression sur la boussole, elle, tourne. Sans elle,
  // l'absence de rotation ci-dessus pourrait n'être qu'une pression perdue en route.
  await scene.clickViewportPoint((area.left + area.right) / 2, (area.top + area.bottom) / 2);
  await expect
    .poll(async () => distance(before, await pinnedPosition(scene)))
    .toBeGreaterThan(ROTATION_WORLD_EPSILON);
});

test("§4.18 la légende est posée à droite de la boussole, ses lignes dans la colonne de l'ordre de jeu", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DUEL);
  await waitPinned(page, scene);

  const compass = await compassSquare(page);
  const tap = await domBox(page, "control-legend-tap");
  const rotate = await domBox(page, "control-legend-rotate");
  const zoom = await domBox(page, "control-legend-zoom");

  // « Ça se clique » : à DROITE de la boussole, centré verticalement sur elle (demande humaine). La
  // boussole ne garde QUE ce dessin-là, celui qui dit qu'elle se clique.
  expect(tap.left).toBeCloseTo(compass.right + CHROME_CLEARANCE_PX, 0);
  expect((tap.top + tap.bottom) / 2).toBeCloseTo((compass.top + compass.bottom) / 2, 0);

  // Les deux lignes de contrôles ont QUITTÉ le dessous de la boussole au plan 189 (retour humain
  // 2026-08-26) : ancrées là, elles finissaient par-dessus elle. Elles descendent dans la colonne
  // latérale de l'ordre de jeu, entre les deux capuchons de défilement — les trois se lisent alors
  // comme un seul bloc, à côté de ce qu'ils pilotent.
  const scrollUp = await domBox(page, "timeline-scroll-up-key-hint");
  const scrollDown = await domBox(page, "timeline-scroll-down-key-hint");
  expect(rotate.top).toBeGreaterThanOrEqual(scrollUp.bottom);
  expect(zoom.top).toBeGreaterThanOrEqual(rotate.bottom);
  expect(zoom.bottom).toBeLessThanOrEqual(scrollDown.top);
});

test("§4.18 la légende suit la source d'entrée : touches au clavier, gestes au doigt", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DUEL);
  await waitPinned(page, scene);

  const rotateRow = page.getByTestId("control-legend-rotate");
  const gestureEntry = page.getByTestId("legend-zoom-in-gesture");
  const keyEntry = page.getByTestId("legend-zoom-in");

  // Clavier : les deux sens de rotation annoncent leur touche, et le zoom aussi. Piloté par une VRAIE
  // frappe, pas en écrivant l'attribut : c'est le suivi de source (plan 184) qui doit réagir.
  await page.keyboard.press("KeyE");
  await expect(rotateRow).toBeVisible();
  await expect(keyEntry).toBeVisible();
  await expect(gestureEntry).toBeHidden();

  // Doigt : la boussole tourne déjà la vue au tap, donc la ligne rotation n'a rien à annoncer, et le
  // zoom passe des touches aux gestes. `tapTile` émet un vrai `pointerType: "touch"`.
  await scene.tapTile(DUEL.dummyPosition.x, DUEL.dummyPosition.y);
  await expect(rotateRow).toBeHidden();
  await expect(gestureEntry).toBeVisible();
  await expect(keyEntry).toBeHidden();

  // Les loupes restent : au doigt elles disent quel SENS prend le zoom, la main dit le geste qui y
  // mène (demande humaine 2026-08-24). Tuiles de la feuille de curseurs, colonne/ligne.
  expect(await glyphTile(page, "legend-gesture-glyph-zoom-in")).toBe("7/0");
  expect(await glyphTile(page, "legend-gesture-hand-zoom-in")).toBe("14/6");
});

test("§4.18 la légende ne bouge pas quand la timeline perd son entrée active", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DUEL);
  await waitPinned(page, scene);

  const areaBefore = await screenBox(scene, TAP_AREA);
  const rotateBefore = await domBox(page, "control-legend-rotate");

  // Prévisualisation du coût en CT : AUCUNE entrée n'est pinnée active (`buildTimelineView`), donc la
  // case active se vide et sa boîte tombe à 0×0. Ce qui tient alors, c'est `chrome-insets.measure()`,
  // qui IGNORE une boîte nulle et conserve son dernier relevé valide : boussole et légende lisent la
  // même mesure, donc elles restent immobiles ensemble. Sans ça, la légende s'écrasait sur la
  // boussole (bug relevé par l'humain, 2026-08-24).
  await page.getByRole("button", { name: "Attaque" }).click();
  await page.getByTestId("move-item").first().click();

  await expect
    .poll(async () => (await domBox(page, "control-legend-rotate")).top)
    .toBeCloseTo(rotateBefore.top, 0);
  const areaAfter = await screenBox(scene, TAP_AREA);
  expect(areaAfter.left).toBeCloseTo(areaBefore.left, 0);
  expect(areaAfter.top).toBeCloseTo(areaBefore.top, 0);
});
