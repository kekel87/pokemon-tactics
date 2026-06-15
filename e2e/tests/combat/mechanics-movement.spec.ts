import { expect, test } from "../../fixtures";
import { DUEL } from "../../fixtures/sandbox-configs";

// Cahier §5.13 — déplacements spéciaux pilotés (Téléport, hit-and-run). Baton Pass exige un allié →
// non testable en duel 1v1 (reste 👁). Le glissé/anim de repli = 👁.
const log = (page: import("@playwright/test").Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

test("§5.13 Téléport : le lanceur se téléporte (journal)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox({ ...DUEL, moves: ["teleport"] });
  await scene.castFirstMove(4, 4); // tuile libre destination
  await expect(log(page, /téléporte/)).toBeAttached({ timeout: 10_000 });
});

test("§5.13 hit-and-run : Demi-Tour frappe puis replie le lanceur (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox({ ...DUEL, moves: ["u-turn"] });
  // Attaque → cible le dummy → confirme la frappe → sélectionne la tuile de repli.
  await scene.castFirstMove(2, 2);
  await scene.clickTile(3, 3); // tuile de repli libre
  await expect(log(page, /utilise Demi-Tour/)).toBeAttached({ timeout: 10_000 });
});

// §5.18 — repoussé (knockback) : Draconnerie (dragon-tail) repousse la cible → ligne « repoussé ».
// La chute/glissade qui peut suivre n'est PAS journalisée (dégâts via HP) → reste 👁.
test("§5.18 repoussé : Draconnerie repousse la cible (journal)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox({ ...DUEL, seed: 3, moves: ["dragon-tail"] });
  await scene.castFirstMove(2, 2);
  await expect(log(page, /repoussé/)).toBeAttached({ timeout: 10_000 });
});
