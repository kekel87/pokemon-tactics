import { expect, test } from "../../fixtures";
import { TRAP_PARTIAL_FIRE_SPIN, TRAP_PURE_BLOCK } from "../../fixtures/sandbox-configs";

// Cahier §5.24 — famille Pièges (trapping), pilotée à travers le renderer. Les unit/integration core
// couvrent la résolution pure (chip 1/8, durée 4-5 tours, position-linked) ; ici on prouve que le move
// résout via l'orchestrateur ET que le feedback DOM (ligne de journal FR) monte. On assert la ligne de
// journal (lisible, robuste). L'icône de statut « piégé » sur le sprite reste 👁 (anim/visuel).
const log = (page: import("@playwright/test").Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// §5.24 piège PARTIEL : Danse Flammes piège la cible (cast) puis lui inflige le chip 1/8 chaque tour.
test("§5.24 piège partiel : Danse Flammes piège la cible (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(TRAP_PARTIAL_FIRE_SPIN);
  await scene.castFirstMove(2, 2); // le Ronflex adjacent au nord
  await expect(log(page, /Ronflex est piégé/)).toBeAttached({ timeout: 10_000 });
});

test("§5.24 piège partiel : le chip 1/8 entame la cible piégée en fin de tour (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(TRAP_PARTIAL_FIRE_SPIN);
  await scene.castFirstMove(2, 2);
  await expect(log(page, /Ronflex est piégé/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Ronflex perd \d+ PV/)).toHaveCount(1); // dégâts directs du cast
  await scene.endTurn(); // fin de tour → tick du piège → 2e ligne de dégâts
  await expect(log(page, /Ronflex perd \d+ PV/)).toHaveCount(2, { timeout: 10_000 });
});

// §5.24 piège PUR (position-linked) : Barrage verrouille la cible SANS dégâts ; la rupture survient
// quand le lanceur s'éloigne (chebyshev > 1).
test("§5.24 piège pur : Barrage verrouille la cible sans dégâts (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(TRAP_PURE_BLOCK);
  await scene.castFirstMove(2, 2);
  await expect(log(page, /Ronflex est piégé/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Ronflex perd \d+ PV/)).toHaveCount(0);
});

test("§5.24 piège pur : le verrou se rompt quand le lanceur s'éloigne (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(TRAP_PURE_BLOCK);
  await scene.castFirstMove(2, 2);
  await expect(log(page, /Ronflex est piégé/)).toBeAttached({ timeout: 10_000 });

  await page.getByRole("button", { name: "Deplacement", exact: true }).click();
  await scene.clickTile(2, 5); // distance 3 du dummy (2,2) → rupture du verrou position-linked

  await expect(log(page, /Ronflex est libéré du piège/)).toBeAttached({ timeout: 10_000 });
});
