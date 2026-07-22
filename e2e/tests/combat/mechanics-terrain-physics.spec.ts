import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import {
  FALL_TABLE_2,
  FALL_TABLE_3,
  ICE_SLIDE,
  KNOCKBACK_IMMUNE_FLYER,
  RECOIL_SELF_KO,
} from "../../fixtures/sandbox-configs";
import type { CombatScene } from "../../pages/CombatScene";
import { readHp } from "../../pages/combat-queries";

// Cahier §5.18 — physique de chute / glace / recul. Les dégâts de chute ne sont PAS journalisés → on
// lit les PV via la barre de vie de l'InfoPanel (`role="progressbar"` → `aria-valuenow`) et la tuile
// finale via `spriteStates().tile`. Interactions réelles à travers le renderer, déterministes (seed
// fixe, hauteurs/terrains figés par les maps dev). SENS chiffré (table de chute, glissade) = unit core.
const POLL = { timeout: 10_000, intervals: [150, 250, 400] };

const log = (page: Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

/** Poll the sprite's occupied tile (settles at the end of the knockback/slide tween). */
const tileOf = (scene: CombatScene, pokemonId: string) =>
  expect.poll(async () => {
    const state = (await scene.spriteStates()).find((s) => s.pokemonId === pokemonId);
    return state ? `${state.tile.x},${state.tile.y}` : null;
  }, POLL);

// §5.18 — table de chute : une chute plus profonde retire plus de PV. La cible (Ronflex endurant) est
// repoussée hors d'un plateau identique sur deux maps (2 niveaux → 33 %, 3 niveaux → 66 %). Le dégât du
// move est identique (mêmes espèces/seed, Δh=0 sur le plateau) → la DIFFÉRENCE de PV isole la table.
test("§5.18 table de chute : 3 niveaux (66 %) retire plus que 2 niveaux (33 %)", async ({
  page,
  bootSandbox,
}) => {
  const scene2 = await bootSandbox(FALL_TABLE_2);
  await scene2.castFirstMove(2, 1); // Draco-Queue frappe + repousse la cible en contrebas (3,1)
  const fall2 = await readHp(scene2, page, 3, 1, "Ronflex");

  const scene3 = await bootSandbox(FALL_TABLE_3);
  await scene3.castFirstMove(2, 1);
  const fall3 = await readHp(scene3, page, 3, 1, "Ronflex");

  expect(fall2.now).toBeLessThan(fall2.max); // la cible a bien chuté
  expect(fall3.now).toBeLessThan(fall2.now); // 66 % > 33 %
  // La différence de PV isole précisément la table (66 % − 33 % du PV max), le dégât du move s'annulant.
  const expectedDiff = Math.floor((66 / 100) * fall2.max) - Math.floor((33 / 100) * fall2.max);
  expect(fall2.now - fall3.now).toBe(expectedDiff);
});

// §5.18 — glissade sur glace : un repoussé d'UNE case sur une bande de glace fait glisser la cible
// au-delà de l'adjacence jusqu'à la première case non-glace.
test("§5.18 glissade sur la glace : la cible glisse au-delà de l'adjacence", async ({
  bootSandbox,
}) => {
  const scene = await bootSandbox(ICE_SLIDE);
  await scene.castFirstMove(1, 1); // repoussé sud → (1,2) glace → glisse → s'arrête sur (1,4) normal
  await tileOf(scene, "snorlax").toBe("1,4");
});

// §5.18 — immunité au repoussé : un Volant poussé vers un terrain d'arrivée où il est immunisé (lave)
// n'est PAS déplacé.
test("§5.18 immunité au repoussé : le Volant poussé vers la lave n'est pas déplacé", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(KNOCKBACK_IMMUNE_FLYER);
  await scene.castFirstMove(0, 4); // Draco-Queue frappe Dracaufeu ; l'arrivée (0,5) est de la lave
  await tileOf(scene, "charizard").toBe("0,4"); // resté sur place
  await expect(log(page, /est repoussé/)).toHaveCount(0);
});

// §5.18 — recul mortel : le recul de Damoclès met le LANCEUR K.O. (la cible endurante survit au coup).
test("§5.18 recul mortel : Damoclès met le lanceur K.O. par recul", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(RECOIL_SELF_KO);
  await scene.castFirstMove(2, 2); // Damoclès frappe le Ronflex adjacent ; le recul 1/3 tue le lanceur
  await expect(log(page, /Ronflex perd \d+ PV/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Florizarre est K\.O\./)).toBeAttached();
});
