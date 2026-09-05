// Composable test fixtures (extend here as the suite grows — never raw `beforeEach`).
import { test as base, expect } from "@playwright/test";
import { signallingPort } from "../../playwright.config";
import { CombatScene } from "../pages/CombatScene";
import { CombatMenuOverlay } from "../pages/combat-menu";
import { PlacementPhase } from "../pages/placement";

interface CombatFixtures {
  /**
   * Boot a sandbox battle already past the loader, ready to assert/drive. Pass a config object
   * (see ./sandbox-configs) for a precise state, or nothing for a default seeded battle. Folds
   * the goto + `waitReady()` gate into one call so no test re-implements the boot-and-wait dance.
   */
  bootSandbox: (config?: Record<string, unknown>) => Promise<CombatScene>;
  /** La modale du menu de combat et son bouton `☰` (plan 187) — locators seuls, état mutable nul. */
  combatMenu: CombatMenuOverlay;
  /** La phase de placement interactive (plan 189) — locators + le geste « poser un Pokemon ». */
  placement: PlacementPhase;
}

export const test = base.extend<CombatFixtures>({
  bootSandbox: async ({ page }, use) => {
    const scene = new CombatScene(page);
    await use(async (config) => {
      if (config) {
        await scene.gotoSandboxConfig(config);
      } else {
        await scene.gotoSandbox();
      }
      await scene.waitReady();
      return scene;
    });
  },
  combatMenu: async ({ page }, use) => {
    await use(new CombatMenuOverlay(page));
  },
  placement: async ({ page }, use) => {
    await use(new PlacementPhase(page));
  },
});

export { expect };

/**
 * Chaîne de requête pointant l'annuaire de mise en relation LOCAL, celui que `playwright.config.ts`
 * démarre — jamais le service public de PeerJS.
 *
 * Sans elle, tout écran qui touche au jeu en ligne ferait dépendre la suite d'un tiers sans
 * engagement de service : une panne chez eux rendrait le gate rouge sans qu'une ligne de notre code
 * ait bougé. `peerIce=off` coupe STUN/TURN, propre au harnais (les deux pairs sont sur la boucle
 * locale) et volontairement PAS le défaut de `?peerPort=`, dont un humain qui teste a besoin.
 *
 * Ici plutôt que recopiée dans chaque spec : elle l'était déjà à deux endroits.
 */
export const localSignalling = `?peerPort=${signallingPort}&peerIce=off`;
