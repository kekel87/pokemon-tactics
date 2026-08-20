import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { DUEL } from "../../fixtures/sandbox-configs";
import type { CombatScene, MeshScreenBox } from "../../pages/CombatScene";

// Cahier §4.18 — glyphe de rotation de la boussole (chantier « aide visuelle des gestes attendus »,
// suite du Lot 1 du plan-cadre 173).
//
// Rien à l'écran ne disait que la boussole se tape : une flèche circulaire posée à sa droite le dit,
// et elle appartient à la ZONE TAPABLE de la boussole plutôt que de devenir un second contrôle.
//
// Les deux meshes sont épinglés à l'ÉCRAN : leur position monde est recalculée depuis la base de la
// caméra à chaque frame, donc elle ne dit rien de leur place à l'écran. C'est `meshViewportBox`
// (projection du hook, lecture seule) qui donne le cadre où le doigt doit tomber — et cette même
// position monde devient, elle, le signal de rotation : elle bouge quand, et seulement quand, la
// caméra tourne.
//
// Le DESSIN de la flèche (tuile Kenney, sens lu par l'œil, translucidité) reste 👁, comme la
// validation au doigt sur téléphone réel : ici la pression est une vraie pression souris, qui
// traverse la même couche d'entrée que le tap (`pointerdown`/`pointerup` sur le canvas).

const HINT = "compass_rotate_hint";
const TAP_AREA = "compass_pick_proxy";
const COMPASS = "compass";
/** Groupe de rendu du HUD (profondeur nettoyée) — cf §2, conventions de profondeur. */
const HUD_RENDERING_GROUP = 3;
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

const distance = (from: WorldPosition, to: WorldPosition): number =>
  Math.hypot(from.x - to.x, from.y - to.y, from.z - to.z);

const hintPosition = async (scene: CombatScene): Promise<WorldPosition> => {
  const info = await scene.meshInfo(HINT);
  if (info === null) {
    throw new Error(`mesh absent de la scène : ${HINT}`);
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
const portraitBox = async (page: Page): Promise<MeshScreenBox & { height: number }> => {
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

/** Position monde du glyphe une fois la caméra au repos. La rotation est amortie sur plusieurs
 *  frames : deux lectures consécutives identiques signifient qu'aucun easing n'est en vol, donc
 *  qu'on compare deux états stables et non un instantané pris au milieu d'un mouvement. */
const settledHintPosition = async (scene: CombatScene): Promise<WorldPosition> => {
  let previous: WorldPosition | null = null;
  await expect
    .poll(async () => {
      const current = await hintPosition(scene);
      const settled = previous !== null && distance(previous, current) === 0;
      previous = current;
      return settled;
    })
    .toBe(true);
  return hintPosition(scene);
};

/** Attend que la boussole soit chargée ET épinglée au moins une fois : `isVisible` du glyphe n'est
 *  posé que par l'épinglage (avant, le plan traînerait au centre du plateau). */
const waitPinned = async (scene: CombatScene): Promise<void> => {
  await expect.poll(() => scene.countByName(COMPASS)).toBe(1);
  await expect.poll(async () => (await scene.meshInfo(HINT))?.isVisible).toBe(true);
};

test("§4.18 le glyphe de rotation est posé à droite de la boussole, à son niveau", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DUEL);
  await waitPinned(scene);

  // Le chrome monte APRÈS la scène, qui épingle d'abord sur ses constantes de repli : on attend que
  // la mesure du portrait ait atterri en polling la seule relation qui en dépend — la zone tapable
  // commence juste après la timeline, à l'écart de dégagement près, donc sans la recouvrir.
  await expect
    .poll(async () => (await screenBox(scene, TAP_AREA)).left - (await portraitBox(page)).right)
    .toBeCloseTo(CHROME_CLEARANCE_PX, 0);

  const glyph = await screenBox(scene, HINT);
  const portrait = await portraitBox(page);
  // À la droite du portrait (donc de la boussole, qui occupe le carré juste après lui) et exactement
  // à son niveau : les deux partagent un centre vertical, à n'importe quelle taille d'écran.
  expect(glyph.left).toBeGreaterThan(portrait.right);
  expect((glyph.top + glyph.bottom) / 2).toBeCloseTo((portrait.top + portrait.bottom) / 2, 0);

  // Décor : le glyphe vit sur le groupe HUD, où la profondeur est nettoyée.
  await expect
    .poll(async () => (await scene.meshInfo(HINT))?.renderingGroupId)
    .toBe(HUD_RENDERING_GROUP);
});

test("§4.18 la zone tapable couvre le glyphe et ne s'étend que vers la droite", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DUEL);
  await waitPinned(scene);
  await expect
    .poll(async () => (await screenBox(scene, TAP_AREA)).left - (await portraitBox(page)).right)
    .toBeCloseTo(CHROME_CLEARANCE_PX, 0);

  const area = await screenBox(scene, TAP_AREA);
  const glyph = await screenBox(scene, HINT);
  const portrait = await portraitBox(page);

  // Le glyphe compte comme une partie de la boussole, pas comme un second contrôle : il est DANS sa
  // zone tapable, et celle-ci s'arrête net sur son bord droit.
  expect(glyph.left).toBeGreaterThan(area.left);
  expect(glyph.right).toBeCloseTo(area.right, 0);

  // Croissance vers la DROITE seulement : le glyphe occupe la moitié droite de la zone, et la
  // HAUTEUR reste celle de la boussole (le carré du portrait, planché à la cible tactile). Un cube
  // élargi — l'implémentation d'avant — aurait gagné autant de plateau EN DESSOUS de la boussole,
  // et taper une case là aurait fait tourner la caméra.
  expect(glyph.left).toBeGreaterThan((area.left + area.right) / 2);
  expect(area.bottom - area.top).toBeCloseTo(Math.max(portrait.height, TOUCH_FLOOR_PX), 0);

  // Plancher de cible tactile, invisible autrement : le proxy de picking est un mesh invisible.
  expect(area.right - area.left).toBeGreaterThanOrEqual(TOUCH_FLOOR_PX);
  expect(area.bottom - area.top).toBeGreaterThanOrEqual(TOUCH_FLOOR_PX);
});

test("§4.18 cliquer le glyphe de rotation fait tourner la vue", async ({ bootSandbox }) => {
  const scene = await bootSandbox(DUEL);
  await waitPinned(scene);

  const before = await settledHintPosition(scene);
  const glyph = await screenBox(scene, HINT);

  await scene.clickViewportPoint((glyph.left + glyph.right) / 2, (glyph.top + glyph.bottom) / 2);

  // La caméra orbite d'un cran → le glyphe, épinglé à l'écran, est reprojeté depuis une autre base
  // de caméra, donc sa position MONDE change (sa position écran, elle, ne bouge pas).
  await expect
    .poll(async () => distance(before, await hintPosition(scene)))
    .toBeGreaterThan(ROTATION_WORLD_EPSILON);
});

test("§4.18 cliquer sous la boussole ne fait pas tourner la vue", async ({ bootSandbox }) => {
  const scene = await bootSandbox(DUEL);
  await waitPinned(scene);

  const before = await settledHintPosition(scene);
  const area = await screenBox(scene, TAP_AREA);
  const glyph = await screenBox(scene, HINT);

  // Juste sous la zone tapable : c'est du plateau, et une pression là doit rester au plateau.
  await scene.clickViewportPoint((area.left + area.right) / 2, area.bottom + 8);
  expect(distance(before, await settledHintPosition(scene))).toBeLessThan(ROTATION_WORLD_EPSILON);

  // Contre-épreuve dans le MÊME test : la pression sur le glyphe, elle, tourne. Sans elle,
  // l'absence de rotation ci-dessus pourrait n'être qu'une pression perdue en route.
  await scene.clickViewportPoint((glyph.left + glyph.right) / 2, (glyph.top + glyph.bottom) / 2);
  await expect
    .poll(async () => distance(before, await hintPosition(scene)))
    .toBeGreaterThan(ROTATION_WORLD_EPSILON);
});
