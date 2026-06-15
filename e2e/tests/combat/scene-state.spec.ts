import { expect, test } from "../../fixtures";
import { POISONED } from "../../fixtures/sandbox-configs";

// State-driven scene facts: the boot config seeds a battle state and we assert the HUD/scene
// reflects it. (Invariant facts of any scene live in scene-graph.spec.ts.)
test("§3.4 statut : l'icône de statut apparaît quand empoisonné", async ({ bootSandbox }) => {
  const scene = await bootSandbox(POISONED);

  // L'icône de statut est montée par le HUD au premier rendu de l'état de combat, APRÈS le signal
  // de scène prête (waitReady) — on poll donc sa convergence (pas un substitut au loader).
  await expect
    .poll(() => scene.countByName("hud_status_icon"), { timeout: 10_000 })
    .toBeGreaterThan(0);
});
