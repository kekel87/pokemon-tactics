// Composable test fixtures (extend here as the suite grows — never raw `beforeEach`).
import { test as base, expect } from "@playwright/test";
import { CombatScene } from "../pages/CombatScene";

interface CombatFixtures {
  /**
   * Boot a sandbox battle already past the loader, ready to assert/drive. Pass a config object
   * (see ./sandbox-configs) for a precise state, or nothing for a default seeded battle. Folds
   * the goto + `waitReady()` gate into one call so no test re-implements the boot-and-wait dance.
   */
  bootSandbox: (config?: Record<string, unknown>) => Promise<CombatScene>;
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
});

export { expect };
