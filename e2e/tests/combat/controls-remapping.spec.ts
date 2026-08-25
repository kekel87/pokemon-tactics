import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { DUEL } from "../../fixtures/sandbox-configs";
import type { CombatScene } from "../../pages/CombatScene";

// Cahier §6.12 (moitié combat) — un binding réassigné agit vraiment, et la légende le dit.
//
// C'est le lien le plus facile à casser en silence : `key-legend.ts` relit la table de bindings
// (plan 185) précisément pour que l'écran de contrôles n'ait rien à recâbler. Si quelqu'un
// re-figeait une lettre en dur, le jeu tournerait encore — la légende, elle, mentirait.
//
// ⚠️ Deux précautions reprises de `compass-and-legend.spec.ts`, apprises au plan 185 : la légende
// monte APRÈS la scène, et la rotation de caméra est amortie sur plusieurs frames. Sans elles, ce
// spec passe en isolation et échoue sous la charge de la suite complète (constaté 2026-08-25).

const TAP_AREA = "compass_pick_proxy";
/** Un cran de rotation déplace la boussole de plusieurs unités monde ; au repos la dérive est nulle. */
const ROTATION_WORLD_EPSILON = 0.05;

interface WorldPosition {
  x: number;
  y: number;
  z: number;
}

/** Rotation caméra à gauche sur `KeyG` au lieu de sa position par défaut. */
const REMAPPED = JSON.stringify({
  version: 1,
  keyboard: { "rotate-camera-left": [{ code: "KeyG", shift: false }, null] },
  gamepad: {},
});

async function remapBeforeBoot(page: Page): Promise<void> {
  await page.addInitScript((stored: string) => {
    localStorage.setItem("pt-bindings", stored);
  }, REMAPPED);
}

const distance = (from: WorldPosition, to: WorldPosition): number =>
  Math.hypot(from.x - to.x, from.y - to.y, from.z - to.z);

async function compassPosition(scene: CombatScene): Promise<WorldPosition> {
  const info = await scene.meshInfo(TAP_AREA);
  if (info === null) {
    throw new Error(`mesh absent de la scène : ${TAP_AREA}`);
  }
  return info.position;
}

/**
 * Position de la boussole une fois la caméra au repos : deux lectures consécutives identiques
 * signifient qu'aucun amortissement n'est en vol, donc qu'on compare des états stables et non un
 * instantané pris au milieu d'un mouvement.
 */
async function settledCompassPosition(scene: CombatScene): Promise<WorldPosition> {
  let previous: WorldPosition | null = null;
  await expect
    .poll(async () => {
      const current = await compassPosition(scene);
      const settled = previous !== null && distance(previous, current) === 0;
      previous = current;
      return settled;
    })
    .toBe(true);
  return compassPosition(scene);
}

/** Tuile dessinée par un capuchon de la légende, publiée en propriétés CSS calculées. */
function capTile(page: Page, testId: string): Promise<string> {
  return page.evaluate((id) => {
    const cap = document.querySelector(`[data-testid="${id}"]`);
    if (!cap) {
      return "";
    }
    const style = getComputedStyle(cap);
    return `${style.getPropertyValue("--cl-cap-col").trim()}/${style
      .getPropertyValue("--cl-cap-row")
      .trim()}`;
  }, testId);
}

/** La légende monte APRÈS la scène : on attend qu'elle ait dessiné son capuchon. */
async function settledCapTile(page: Page, testId: string): Promise<string> {
  await expect.poll(() => capTile(page, testId)).not.toBe("");
  return capTile(page, testId);
}

test("§6.12 la touche réassignée fait tourner la caméra, et la légende dessine la nouvelle", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(DUEL);
  const defaultTile = await settledCapTile(page, "legend-cap-rotate-left");

  await remapBeforeBoot(page);
  const scene = await bootSandbox(DUEL);

  await expect.poll(() => capTile(page, "legend-cap-rotate-left")).not.toBe(defaultTile);

  const before = await settledCompassPosition(scene);
  await page.keyboard.press("KeyG");

  await expect
    .poll(async () => distance(before, await compassPosition(scene)))
    .toBeGreaterThan(ROTATION_WORLD_EPSILON);
});

test("§6.12 la touche d'origine ne fait plus rien une fois réassignée", async ({
  page,
  bootSandbox,
}) => {
  await remapBeforeBoot(page);
  const scene = await bootSandbox(DUEL);

  const before = await settledCompassPosition(scene);
  // `A` (position `KeyQ`) tournait la caméra par défaut : le binding est parti sur `KeyG`.
  await page.keyboard.press("KeyQ");

  expect(distance(before, await settledCompassPosition(scene))).toBeLessThan(
    ROTATION_WORLD_EPSILON,
  );
});
