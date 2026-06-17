import { expect, test } from "../../fixtures";
import { DUEL } from "../../fixtures/sandbox-configs";

// Cahier §4.2 / §4.6 / §4.7 — états du HUD pilotés par la config sandbox (timeline Charge Time,
// tooltip, badges du panneau d'info). DOM/scene-graph, déterministe.

// §4.6 — tooltip : apparaît au survol, disparaît en quittant, contient les tags spéciaux.
test("§4.6 tooltip : apparaît au survol et disparaît en quittant", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(DUEL);
  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  const move = page.getByTestId("move-item").first();
  const tooltip = page.getByTestId("move-tooltip");

  await move.hover();
  await expect(tooltip).toBeVisible();
  // Quitter le survol du move (vers le bouton Annuler du sous-menu) → la tooltip se cache.
  await page.getByRole("button", { name: "Annuler", exact: true }).hover();
  await expect(tooltip).toBeHidden();
});

test("§4.6 tooltip : tag « 2 tours » sur un move à charge (Lance-Soleil)", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox({ ...DUEL, moves: ["solar-beam"] });
  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  await page.getByTestId("move-item").first().hover();
  await expect(page.getByTestId("move-tooltip")).toContainText("2 tours");
});

// §4.2 — Charge Time : la timeline porte data-ct (barres de charge).
test("§4.2 timeline : data-ct en système Charge Time", async ({ bootSandbox, page }) => {
  await bootSandbox({ ...DUEL });
  await expect(page.getByTestId("timeline")).toHaveAttribute("data-ct", "true");
});

// §4.7 — badge de statut majeur dans le panneau d'info (joueur empoisonné/brûlé au boot).
test("§4.7 info panel : badge de statut majeur (Brûlure)", async ({ page, bootSandbox }) => {
  await bootSandbox({ ...DUEL, status: "burned" });
  const badge = page.locator(".ip-badge").filter({ hasText: "Brûlure" });
  await expect(badge).toBeVisible();
  await expect(badge).toHaveAttribute("data-variant", "debuff");
});

// §4.5 / §4.11 — noms de moves localisés en anglais quand pt-lang=en.
test("§4.5 sous-menu : nom de move en anglais (pt-lang=en)", async ({ page, bootSandbox }) => {
  await page.addInitScript(() => localStorage.setItem("pt-lang", "en"));
  await bootSandbox(DUEL); // moves: ["scratch"] → "Scratch" en EN
  await page.getByRole("button", { name: "Attack", exact: true }).click();
  await expect(page.getByTestId("move-name").first()).toHaveText("Scratch");
});
