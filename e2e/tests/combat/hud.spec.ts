import { expect, test } from "../../fixtures";
import { DUEL, TOOLTIP_FREEZE_DRY_TYPE_OVERRIDE } from "../../fixtures/sandbox-configs";

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

// §4.12 — le tag `typeEffectivenessOverride` du tooltip est DÉRIVÉ dynamiquement (i18n + nom de type),
// plus un libellé figé. Lyophilisation (freeze-dry, ×2 vs Eau) doit lire « ×2 sur les types Eau » (FR).
test("HUD : tooltip — tag d'efficacité de type dérivé (Lyophilisation ×2 Eau)", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(TOOLTIP_FREEZE_DRY_TYPE_OVERRIDE);
  await page.getByRole("button", { name: "Attaque", exact: true }).click();

  await page.getByTestId("move-item").first().hover();

  const tooltip = page.getByTestId("move-tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip.getByText("×2 sur les types Eau", { exact: true })).toBeVisible();
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
