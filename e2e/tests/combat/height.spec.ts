import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import {
  DUEL,
  HEIGHT_DMG_FLAT_EAST,
  HEIGHT_DMG_FLAT_WEST,
  HEIGHT_DMG_HIGH,
  HEIGHT_DMG_LOW,
} from "../../fixtures/sandbox-configs";
import type { CombatScene } from "../../pages/CombatScene";
import { readHp } from "../../pages/combat-queries";

// Cahier §5.17 — combat en hauteur. Cas pilotable proprement : la **mêlée (portée 1) est bloquée
// si l'écart de hauteur ≥ 2**. Sur `sandbox-melee-block` (bloc h3 en haut-gauche, h1 ailleurs) :
// depuis (3,3) h1, frapper (3,2) h3 (adjacent, Δh=2) NE résout PAS ; frapper (4,3) h1 (Δh=0) résout.
// Le **modificateur de dégâts ±10 %/niveau** est piloté via les PV de la cible (barre de vie InfoPanel
// `role="progressbar"` → `aria-valuenow`, les dégâts n'étant pas journalisés). La ligne de vue reste
// 👁 (SENS en unit core `grid/line-of-sight.ts` ; setup e2e ambigu whiff/targeting).
const usedGriffe = (page: Page) =>
  page.getByTestId("battle-log-entry").filter({ hasText: /utilise Griffe/ });

/** PV perdus par la cible (Ronflex) après un coup — lus par la barre de vie de l'InfoPanel au survol. */
async function damageDealt(scene: CombatScene, page: Page, x: number, y: number): Promise<number> {
  await scene.castFirstMove(x, y);
  const { now, max } = await readHp(scene, page, x, y, "Ronflex");
  return max - now;
}

const meleeAt = (player: { x: number; y: number }, target: { x: number; y: number }) => ({
  ...DUEL,
  moves: ["scratch"], // portée 1
  playerPosition: player,
  playerDirection: "north",
  dummyPosition: target,
  dummyPokemon: "snorlax",
  mapUrl: "assets/maps/dev/sandbox-melee-block.tmj",
});

test("§5.17 mêlée : bloquée par un écart de hauteur ≥ 2 (h1 → h3 adjacent)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(meleeAt({ x: 3, y: 3 }, { x: 3, y: 2 }));
  await scene.castFirstMove(3, 2); // cible adjacente mais 2 niveaux plus haut
  // La cible n'est pas atteignable en mêlée → aucune résolution.
  await expect(usedGriffe(page)).toHaveCount(0);
});

test("§5.17 mêlée : résout normalement à plat (Δh=0, contrôle)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(meleeAt({ x: 3, y: 3 }, { x: 4, y: 3 }));
  await scene.castFirstMove(4, 3); // cible adjacente même hauteur
  await expect(usedGriffe(page)).toBeAttached({ timeout: 10_000 });
});

// §5.17 modificateur de dégâts ±10 %/niveau, sur `sandbox-fall-1` (plateau cols 0-2 h2.0, sol h1.0).
// Même Griffe/seed/cible : seul l'écart de hauteur change le dégât. Chaque paire garde le même axe
// d'attaque (est ou ouest) pour que le modificateur de face s'annule.
test("§5.17 modificateur : attaquant plus HAUT retire plus de PV qu'à plat (+10 %)", async ({
  page,
  bootSandbox,
}) => {
  const high = await damageDealt(await bootSandbox(HEIGHT_DMG_HIGH), page, 3, 1);
  const flat = await damageDealt(await bootSandbox(HEIGHT_DMG_FLAT_EAST), page, 4, 1);
  expect(high).toBeGreaterThan(flat);
});

test("§5.17 modificateur : attaquant plus BAS retire moins de PV qu'à plat (−10 %)", async ({
  page,
  bootSandbox,
}) => {
  const low = await damageDealt(await bootSandbox(HEIGHT_DMG_LOW), page, 2, 1);
  const flat = await damageDealt(await bootSandbox(HEIGHT_DMG_FLAT_WEST), page, 3, 1);
  expect(low).toBeLessThan(flat);
});
