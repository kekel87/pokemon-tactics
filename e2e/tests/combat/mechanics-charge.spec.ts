import { expect, test } from "../../fixtures";
import { DUEL } from "../../fixtures/sandbox-configs";

// Cahier §5.6 / §5.7 / §5.11 — semi-invulnérabilité, Clonage, charge — interactions pilotées.
const log = (page: import("@playwright/test").Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// §5.7 — Clonage : pose le clone (journal). Le swap de sprite vers la poupée reste 👁.
test("§5.7 Clonage : crée un Clone (journal)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox({ ...DUEL, moves: ["substitute"] });
  await scene.castFirstMove(2, 3); // self
  await expect(log(page, /crée un Clone/)).toBeAttached({ timeout: 10_000 });
});

// §5.11 — charge (move 2 tours) : tour 1 « concentre son énergie ». L'indicateur ⚡ reste 👁.
test("§5.11 charge : Lance-Soleil concentre l'énergie au tour 1 (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox({ ...DUEL, moves: ["solar-beam"] });
  await scene.castFirstMove(2, 2);
  await expect(log(page, /concentre son énergie/)).toBeAttached({ timeout: 10_000 });
});

// §5.6 — semi-invulnérabilité : Vol charge au tour 1 (sprite surélevé/caché = 👁 ; ligne = 🤖).
test("§5.6 semi-invul : Vol charge au tour 1 (journal)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox({ ...DUEL, moves: ["fly"] });
  await scene.castFirstMove(2, 2);
  await expect(log(page, /concentre son énergie|s'envole|Vol/)).toBeAttached({ timeout: 10_000 });
});
