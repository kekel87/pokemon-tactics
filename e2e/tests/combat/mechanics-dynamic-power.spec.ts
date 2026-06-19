import { expect, test } from "../../fixtures";
import { DYNAMIC_BOLT_BEAK, DYNAMIC_FISHIOUS_REND } from "../../fixtures/sandbox-configs";

// Cahier §5.23 — moves « puissance conditionnelle » Charge-Temps (plan 134). Branchicrok et Prise de
// Bec doublent leur puissance quand la cible n'a pas agi depuis la dernière action du lanceur. Au
// tour 1 personne n'a encore agi → la condition ×2 est ACTIVE. Ces moves sont hors-pool (aucun
// Pokémon Gen 1 ne les apprend) : on les force via `moves` (SandboxSetup écrase `moveIds`). Ce que
// l'e2e ajoute aux unit core : le move forcé est ciblable, résout via l'orchestrateur, et descend les
// PV de la cible (ligne de journal FR). La VALEUR exacte du ×2 (formule défense/seed) reste unit.
const log = (page: import("@playwright/test").Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

test("§5.23 Branchicrok (hors-pool, ×2 cible fraîche) résout et inflige des dégâts", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DYNAMIC_FISHIOUS_REND);
  await scene.castFirstMove(2, 2);
  await expect(log(page, /perd \d+ PV/)).toBeAttached({ timeout: 10_000 });
});

test("§5.23 Prise de Bec (hors-pool, ×2 cible fraîche) résout et inflige des dégâts", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DYNAMIC_BOLT_BEAK);
  await scene.castFirstMove(2, 2);
  await expect(log(page, /perd \d+ PV/)).toBeAttached({ timeout: 10_000 });
});
