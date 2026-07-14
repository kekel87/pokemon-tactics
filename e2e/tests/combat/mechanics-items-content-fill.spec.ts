import { expect, test } from "../../fixtures";
import { LOADED_DICE_MAX_HITS, SHED_SHELL_TRAP_IMMUNE } from "../../fixtures/sandbox-configs";

// Cahier §5.14 — objets légers content-fill (plan 158) pilotés de bout en bout à travers le renderer
// (journal FR). Les unit/integration core couvrent les 11 objets + 2 talents no-op
// (`battle/items/content-fill-158.test.ts`, `effective-weight.test.ts`, `effective-base-speed.test.ts`) ;
// e2e ne pilote que les deux facettes qui produisent un signal observable dans le journal. Déterministes :
// aucun override Math.random (Étreinte forcée à 100 % via Aucun Garde, Balle Graine 100 % précision).
const log = (page: import("@playwright/test").Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// Carapace Mue (shed-shell) : le porteur ciblé par un piège n'est PAS piégé. Le joueur lance Étreinte
// sur le dummy Ronflex porteur → le statut Piégé est bloqué (« L'objet de Ronflex le protège ! ») et
// aucune ligne « Ronflex est piégé ! » n'apparaît. Le badge « Piégé » sur le sprite est un feedback de
// scène (👁) ; le SENS robuste est l'absence de la ligne de piège dans le journal.
test("§5.14 Carapace Mue : le porteur ciblé par Étreinte n'est pas piégé (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(SHED_SHELL_TRAP_IMMUNE);
  await scene.castFirstMove(2, 2); // Étreinte sur le Ronflex adjacent au nord

  await expect(log(page, /L'objet de Ronflex le protège/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Ronflex est piégé/)).toHaveCount(0);
});

// Dé Pipé (loaded-dice) : force Balle Graine (2-5 coups) à son maximum. Le récap journal lit « Touché 5
// fois ! » quel que soit le seed (l'objet court-circuite le tirage du nombre de coups).
test("§5.14 Dé Pipé : force Balle Graine au maximum de coups (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(LOADED_DICE_MAX_HITS);
  await scene.castFirstMove(2, 2); // Balle Graine sur le dummy adjacent au nord

  await expect(log(page, /Touché 5 fois/)).toBeAttached({ timeout: 10_000 });
});
