import { expect, test } from "../../fixtures";
import { DUEL, SOLAR_BEAM_RAIN, SOLAR_BEAM_SUN } from "../../fixtures/sandbox-configs";

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

// Enter the targeting phase for the active mon's first move without confirming (Attaque → move).
const selectFirstMove = async (page: import("@playwright/test").Page) => {
  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  await page.getByTestId("move-item").first().click();
  await expect(page.getByTestId("combat-instruction")).toHaveText("Sélectionne la cible");
};

// §5.11 — Lance-Soleil sous Soleil saute la charge : la sélection passe DIRECT en ciblage, donc
// AUCUNE preview de charge n'est peinte sur la propre case du lanceur (mesh `highlight_preview_buff`).
test("§5.11 charge : Lance-Soleil sous Soleil ne peint PAS de preview de charge", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(SOLAR_BEAM_SUN);
  await selectFirstMove(page);
  const countChargePreview = async () =>
    (await scene.meshNames()).filter((n) => n.startsWith("highlight_preview_buff_")).length;
  await expect.poll(countChargePreview).toBe(0);
});

// Contrôle Pluie : Lance-Soleil charge normalement, donc la preview de charge EST peinte sur la
// propre case (2,3) du lanceur — prouve que c'est le Soleil (et non le move) qui supprime la charge.
test("§5.11 charge : Lance-Soleil hors Soleil peint la preview de charge (propre case)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(SOLAR_BEAM_RAIN);
  await selectFirstMove(page);
  await expect.poll(() => scene.countByName("highlight_preview_buff_2_3")).toBeGreaterThan(0);
});
