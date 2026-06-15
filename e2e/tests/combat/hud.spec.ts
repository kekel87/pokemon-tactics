import { expect, test } from "../../fixtures";
import { DUEL } from "../../fixtures/sandbox-configs";

// Cahier §4 — HUD DOM de combat.

test("HUD : sous-menu d'attaque — type + nom + PP/puissance par move", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(DUEL);
  await page.getByRole("button", { name: "Attaque", exact: true }).click();

  const firstMove = page.getByTestId("move-item").first();
  await expect(firstMove).toBeVisible();
  await expect(firstMove.getByTestId("move-name")).toBeVisible(); // nom FR
  await expect(firstMove.getByTestId("move-type-icon")).toBeVisible(); // icône de type
});

test("HUD : tooltip de move au survol + grille de pattern", async ({ page, bootSandbox }) => {
  await bootSandbox(DUEL);
  await page.getByRole("button", { name: "Attaque", exact: true }).click();

  await page.getByTestId("move-item").first().hover();

  await expect(page.getByTestId("move-tooltip")).toBeVisible();
  await expect(page.getByTestId("move-tooltip-stats")).toBeVisible(); // ligne stats (Puis/Préc)
  await expect(page.getByTestId("move-tooltip-cell").first()).toBeVisible(); // preview pattern
});

test("HUD : timeline présente avec des entrées", async ({ page, bootSandbox }) => {
  await bootSandbox(DUEL);
  await expect(page.getByTestId("timeline")).toBeVisible();
  await expect(page.getByTestId("timeline-entry").first()).toBeVisible();
});

// §4.11 — le HUD de combat suit `pt-lang` sur le boot direct sandbox (corrigé : `initLanguage()`
// est appelé au boot, plus seulement via le menu). On pré-positionne `pt-lang=en` AVANT la
// navigation (`addInitScript`) → le menu d'action s'affiche en anglais.
test("HUD : combat en anglais quand pt-lang=en (boot sandbox)", async ({ page, bootSandbox }) => {
  await page.addInitScript(() => localStorage.setItem("pt-lang", "en"));
  await bootSandbox(DUEL);

  const menu = page.getByTestId("action-menu");
  for (const label of ["Move", "Attack", "Item", "Wait", "Status"]) {
    await expect(menu.getByRole("button", { name: label, exact: true })).toBeVisible();
  }
});
