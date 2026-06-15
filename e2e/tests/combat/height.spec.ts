import { expect, test } from "../../fixtures";
import { DUEL } from "../../fixtures/sandbox-configs";

// Cahier §5.17 — combat en hauteur. Cas pilotable proprement : la **mêlée (portée 1) est bloquée
// si l'écart de hauteur ≥ 2**. Sur `sandbox-melee-block` (bloc h3 en haut-gauche, h1 ailleurs) :
// depuis (3,3) h1, frapper (3,2) h3 (adjacent, Δh=2) NE résout PAS ; frapper (4,3) h1 (Δh=0) résout.
// Le reste de §5.17 (ligne de vue, modificateur de dégâts ±10%/niveau) = SENS en unit core
// (`grid/line-of-sight.ts`, `battle/height-modifier.ts`) ; setup e2e ambigu → reste 👁.
const usedGriffe = (page: import("@playwright/test").Page) =>
  page.getByTestId("battle-log-entry").filter({ hasText: /utilise Griffe/ });

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
