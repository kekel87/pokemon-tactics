import { expect, test } from "../../fixtures";
import { DUEL, GRONDEMENT } from "../../fixtures/sandbox-configs";

// Cahier §5.3 / §5.4 / §5.5 — INTERACTIONS de mécanique pilotées à travers le renderer (ce que les
// unit core ne couvrent pas : le move résout-il via l'orchestrateur ? le feedback DOM monte-t-il ?).
// On assert la ligne de journal FR (lisible, robuste) + l'icône de statut (scene-graph). La couleur
// du texte flottant reste 👁.
const log = (page: import("@playwright/test").Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// §5.3 — l'icône de statut majeur est montée pour chaque statut (boot avec le joueur sous statut).
const MAJOR_STATUSES = ["poisoned", "burned", "paralyzed", "asleep", "frozen", "badly_poisoned"];
for (const status of MAJOR_STATUSES) {
  test(`§5.3 statut « ${status} » : l'icône de statut est montée`, async ({ bootSandbox }) => {
    const scene = await bootSandbox({ ...DUEL, status });
    await expect
      .poll(() => scene.countByName("hud_status_icon"), { timeout: 10_000 })
      .toBeGreaterThan(0);
  });
}

// §5.3 — application via cast : Spore (100% précision) endort la cible → ligne de journal.
test("§5.3 application : Spore endort la cible (journal)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox({ ...DUEL, moves: ["spore"] });
  await scene.castFirstMove(2, 2);
  await expect(log(page, /s'est endormi/)).toBeAttached({ timeout: 10_000 });
});

// §5.4 — changement de stat (hausse self + baisse ennemi).
test("§5.4 stat + : Danse-Lames augmente l'Attaque du lanceur", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox({ ...DUEL, moves: ["swords-dance"] });
  await scene.castFirstMove(2, 3); // self
  await expect(log(page, /Attaque de .* augmente/)).toBeAttached({ timeout: 10_000 });
});

test("§5.4 stat − : Rugissement baisse l'Attaque de l'ennemi", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox({ ...DUEL, moves: ["growl"] });
  await scene.castFirstMove(2, 2); // ennemi
  await expect(log(page, /baisse/)).toBeAttached({ timeout: 10_000 });
});

// §5.4 Grondement (`howl`, Normal Statut Self, StatChange Attaque +1 radius 2) : buff multi-allié
// (lanceur + alliés vivants du diamant Manhattan r2). Le harness sandbox est un 1v1 → seul le LANCEUR
// (dans son propre rayon) est observable ici ; le volet alliés reste couvert unit (howl.test.ts). Le
// lanceur Arcanin gagne Attaque +1 → journal FR. Cast déterministe (statut sans jet, seed DUEL).
test("§5.4 Grondement : le lanceur gagne Attaque +1 (journal)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(GRONDEMENT);
  await scene.castFirstMove(2, 3); // self
  await expect(log(page, /Attaque de .* augmente/)).toBeAttached({ timeout: 10_000 });
});

// §5.5 — volatiles : confusion, provoc (100% précision, déterministes).
test("§5.5 volatile : Onde Folie rend la cible confuse", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox({ ...DUEL, moves: ["confuse-ray"] });
  await scene.castFirstMove(2, 2);
  await expect(log(page, /est confus/)).toBeAttached({ timeout: 10_000 });
});

test("§5.5 volatile : Provoc provoque la cible", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox({ ...DUEL, moves: ["taunt"] });
  await scene.castFirstMove(2, 2);
  await expect(log(page, /est provoqué/)).toBeAttached({ timeout: 10_000 });
});
