import { expect, test } from "../../fixtures";
import { FLYING_REST_FROM_ICE, FLYING_REST_FROM_LAND } from "../../fixtures/sandbox-configs";

// §11 — Anim de repos d'un Volant selon le terrain d'atterrissage (verrouille le fix : le resting
// terrain-aware réellement appliqué au sprite APRÈS un déplacement, l'intégration renderer par-dessus
// l'unit `view-core` `isFlyoverTerrain`). Roucarnage (pidgeot, Vol) exécute un déplacement 1-case
// déterministe puis on lit `spriteStates()` :
//   - atterrissage fly-over (glace / marais) → reste en vol : `restingAnimation === "FlyingIdle"`
//   - atterrissage sur sol praticable (normal)  → se pose  : `restingAnimation === "Idle"`
// Le resting n'est posé qu'à la FIN du tween (en même temps que la tuile occupée est mise à jour), on
// converge donc via expect.poll sur « le mover est arrivé sur la tuile cible » avant d'asserter le
// resting — ce qui écarte tout faux positif (au SPAWN le resting vaut « Idle » par défaut, avant que
// la logique terrain ne s'exécute).

const PIDGEOT = "pidgeot";
const POLL = { timeout: 10_000, intervals: [150, 250, 400] };

/** Poll the flyer's resting pose + terrain ONCE it has landed on `(x,y)` (the tile only updates when
 *  the glide tween settles, at which point the landing resting animation has been applied). Returns
 *  `null` until arrival so a chained `.toEqual(expected)` keeps polling — no spawn-default false
 *  positive. */
const landedResting = (scene: { spriteStates: () => Promise<unknown> }, x: number, y: number) =>
  expect.poll(async () => {
    const states = (await scene.spriteStates()) as {
      pokemonId: string;
      restingAnimation: string;
      tile: { x: number; y: number };
      terrain: string | undefined;
    }[];
    const mover = states.find((state) => state.pokemonId === PIDGEOT);
    if (!mover || mover.tile.x !== x || mover.tile.y !== y) {
      return null; // not yet arrived — keep polling until the glide tween settles
    }
    return { resting: mover.restingAnimation, terrain: mover.terrain };
  }, POLL);

test("§11 Volant : atterrissage sur la GLACE (fly-over) → reste en vol (FlyingIdle)", async ({
  bootSandbox,
}) => {
  const scene = await bootSandbox(FLYING_REST_FROM_LAND); // départ sol (1,1)
  await scene.moveTo(1, 1, 1, 2); // (1,1) normal → (1,2) glace, adjacent
  await landedResting(scene, 1, 2).toEqual({ resting: "FlyingIdle", terrain: "ice" });
});

test("§11 Volant : atterrissage sur SOL praticable (normal) → se pose (Idle)", async ({
  bootSandbox,
}) => {
  const scene = await bootSandbox(FLYING_REST_FROM_ICE); // départ glace (1,2)
  await scene.moveTo(1, 2, 1, 1); // (1,2) glace → (1,1) normal, adjacent
  await landedResting(scene, 1, 1).toEqual({ resting: "Idle", terrain: "normal" });
});

test("§11 Volant : atterrissage sur le MARAIS (fly-over) → reste en vol (FlyingIdle)", async ({
  bootSandbox,
}) => {
  const scene = await bootSandbox(FLYING_REST_FROM_ICE); // départ glace (1,2)
  await scene.moveTo(1, 2, 2, 2); // (1,2) glace → (2,2) marais, adjacent
  await landedResting(scene, 2, 2).toEqual({ resting: "FlyingIdle", terrain: "swamp" });
});
