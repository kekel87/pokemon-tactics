import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import {
  DYNAMIC_BOLT_BEAK,
  DYNAMIC_FISHIOUS_REND,
  ROLLOUT_AFTER_DEFENSE_CURL,
  ROLLOUT_FRESH,
} from "../../fixtures/sandbox-configs";
import type { CombatScene } from "../../pages/CombatScene";
import { readHp } from "../../pages/combat-queries";

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

// §5.23 Boul'Armure double Roulade — Boul'Armure (`defense-curl`) pose le flag persistant
// `usedDefenseCurl` sur le lanceur ; tant qu'il est actif, Roulade (`rollout`) inflige le DOUBLE de
// puissance (30 → 60 BP à l'index 1 du streak). Observable : deux Roulade « fraîches » (streak index 1,
// même base BP) — l'une seule, l'autre APRÈS Boul'Armure (qui remet le streak à 0) — sur le même
// Ronflex endurant, mêmes espèces/positions/seed. Les PV perdus DOUBLENT après Boul'Armure. Lecture à
// la barre de vie de l'InfoPanel (`readHp`). Le facteur ×2 exact, le reset au K.O. et Ball'Glace =
// SENS unit/integration core (`battle/moves/{defense-curl,rollout}.test.ts`, `dynamic-power-system`).

/** Fait glisser la Roulade (Dash) de Rhinoféros vers l'est jusqu'au Ronflex et renvoie les PV perdus.
 *  Le Dash se confirme par la DIRECTION (cf §5.13) : survoler l'axe est, cliquer deux fois une tuile de
 *  l'axe au-delà de la cible (lock direction puis confirme). `moveIndex` choisit Roulade selon l'ordre
 *  du moveset (0 = Roulade seule, 1 = après Boul'Armure). Le dummy ne bouge pas → `readHp` lit ses PV. */
async function rolloutDamageEast(
  page: Page,
  scene: CombatScene,
  moveIndex: number,
): Promise<number> {
  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  await page.getByTestId("move-item").nth(moveIndex).click();
  await scene.hoverTile(5, 4); // survole l'axe est → fixe la direction de prévisualisation
  await scene.clickTile(3, 4); // 1er clic sur l'axe (au-delà de la cible en (2,4)) → lock direction
  await scene.clickTile(3, 4); // 2e clic → confirme le Dash vers l'est
  // La Roulade a percuté le dummy → attendre la ligne de dégâts avant de lire la barre de vie.
  await expect(
    page.getByTestId("battle-log-entry").filter({ hasText: /Ronflex perd \d+ PV/ }),
  ).toBeAttached({ timeout: 10_000 });
  const { now, max } = await readHp(scene, page, 2, 4, "Ronflex");
  return max - now;
}

test("§5.23 Boul'Armure : double les PV retirés par une Roulade fraîche", async ({
  page,
  bootSandbox,
}) => {
  // Témoin : Roulade seule (index 0), streak index 1, base 30 BP.
  const fresh = await rolloutDamageEast(page, await bootSandbox(ROLLOUT_FRESH), 0);

  // Boul'Armure d'abord (index 0, self → pose le flag, remet le streak à 0), on rend la main…
  const scene = await bootSandbox(ROLLOUT_AFTER_DEFENSE_CURL);
  await scene.castFirstMove(0, 4); // Boul'Armure ciblée sur sa propre case
  await expect(
    page.getByTestId("battle-log-entry").filter({ hasText: /Défense de Rhinoféros augmente/ }),
  ).toBeAttached({ timeout: 10_000 });
  await scene.endTurn();
  await expect(page.getByRole("button", { name: "Attaque", exact: true })).toBeEnabled({
    timeout: 15_000,
  });
  // …puis Roulade (index 1), streak index 1 de nouveau mais doublée par le flag → PV ≈ ×2.
  const boosted = await rolloutDamageEast(page, scene, 1);

  expect(boosted).toBeGreaterThan(fresh);
  expect(boosted).toBeGreaterThanOrEqual(Math.floor(fresh * 1.6)); // ×2 amorti par la variance de jet
});
