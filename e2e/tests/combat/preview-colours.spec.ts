import { expect, test } from "../../fixtures";
import {
  DUEL,
  PREVIEW_BUFF,
  PREVIEW_DASH,
  PREVIEW_HEAL,
  PREVIEW_QUAKE,
} from "../../fixtures/sandbox-configs";

// Cahier §6 — couleurs de preview d'attaque : la grille de pattern du MoveTooltip (DOM) et les
// surbrillances de tiles au sol partagent le même langage couleur, piloté par l'intention du move.
// Ici on automatise la partie DOM observable (data-intent sur .mt-grid, data-cell sur les cellules,
// croix lanceur). Les couleurs/croix AU SOL restent un contrôle visuel humain (👁).

/** Open the attack submenu and hover the first (only) move → its tooltip pattern grid. */
async function openMoveGrid(
  page: import("@playwright/test").Page,
): Promise<import("@playwright/test").Locator> {
  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  await page.getByTestId("move-item").first().hover();
  const grid = page.getByTestId("move-tooltip-grid");
  await expect(grid).toBeVisible();
  return grid;
}

test("preview attaque : Griffe (single damage) → data-intent=attack + cellule cible", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(DUEL); // moves: ["scratch"] — single, damage
  const grid = await openMoveGrid(page);

  await expect(grid).toHaveAttribute("data-intent", "attack");
  // au moins une cellule cible (la tile attaquée) + la croix du lanceur.
  await expect(grid.locator('[data-cell="target"]').first()).toBeVisible();
  await expect(grid.locator('[data-cell="caster"]').first()).toBeVisible();
});

test("preview buff : Danse Lames (self stat-up) → data-intent=buff + lanceur affecté (croix)", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(PREVIEW_BUFF);
  const grid = await openMoveGrid(page);

  await expect(grid).toHaveAttribute("data-intent", "buff");
  // Self buff : la seule cellule peinte est le lanceur lui-même (coloré + croix).
  await expect(grid.locator('[data-cell="caster-target"]').first()).toBeVisible();
  await expect(grid.locator('[data-cell="target"]')).toHaveCount(0);
});

test("preview soin : Fontaine de Vie (self-centred heal) → data-intent=heal + zone autour du lanceur", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(PREVIEW_HEAL);
  const grid = await openMoveGrid(page);

  await expect(grid).toHaveAttribute("data-intent", "heal");
  // Zone soin centrée sur le lanceur : centre = caster-target (coloré + croix), couronne = target.
  await expect(grid.locator('[data-cell="caster-target"]')).toHaveCount(1);
  await expect(grid.locator('[data-cell="target"]').first()).toBeVisible();
});

test("preview dash : Bélier (dash) → cellules de traînée + cible d'arrivée + lanceur", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(PREVIEW_DASH);
  const grid = await openMoveGrid(page);

  // Move dégât → intention attaque (couleur d'arrivée), mais le chemin est tracé en cellules dash.
  await expect(grid).toHaveAttribute("data-intent", "attack");
  await expect(grid.locator('[data-cell="dash"]').first()).toBeVisible();
  await expect(grid.locator('[data-cell="target"]').first()).toBeVisible();
  await expect(grid.locator('[data-cell="caster"]').first()).toBeVisible();
});

test("preview Séisme : Zone AoE qui n'affecte PAS le lanceur → centre = caster vide (croix, non peint)", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(PREVIEW_QUAKE);
  const grid = await openMoveGrid(page);

  await expect(grid).toHaveAttribute("data-intent", "attack");
  // Le centre est un lanceur NON affecté : croix sans remplissage (caster), pas caster-target.
  await expect(grid.locator('[data-cell="caster"]')).toHaveCount(1);
  await expect(grid.locator('[data-cell="caster-target"]')).toHaveCount(0);
  await expect(grid.locator('[data-cell="target"]').first()).toBeVisible();
});
