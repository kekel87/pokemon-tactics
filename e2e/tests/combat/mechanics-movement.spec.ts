import { expect, test } from "../../fixtures";
import { DASH_DIRECTIONAL, DUEL } from "../../fixtures/sandbox-configs";

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

// §5.13 Dash directionnel (chantier g) : depuis chantier g, un Dash se confirme par DIRECTION (comme
// Cône/Ligne/Tranche), plus par la tuile d'atterrissage variable. Raichu en (2,5) face nord, colonne
// nord libre (dummy hors axe en (4,4)), Vive-Attaque (quick-attack, Dash 2) → portée auto. On survole
// puis clique des tuiles de l'AXE nord qui ne sont PAS la tuile d'atterrissage (2,3) : si le dash se
// résout quand même, c'est bien la direction — pas la tuile précise — qui valide. La traînée/glissade
// (preview jaune, anim de saut) reste 👁 (non exposée par le hook scène).
test("§5.13 dash directionnel : Vive-Attaque se confirme par la direction de l'axe (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DASH_DIRECTIONAL);
  // Sélectionner le move (Attaque → 1er move) puis piloter par la DIRECTION nord.
  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  await page.getByTestId("move-item").first().click();
  // Survoler une tuile de l'axe nord (haut de colonne) fixe la direction de prévisualisation…
  await scene.hoverTile(2, 0);
  // …et cliquer une AUTRE tuile de l'axe nord — ni la tuile survolée, ni l'atterrissage (2,3) —
  // valide puis confirme dans cette direction (1er clic = lock direction, 2e = confirme).
  await scene.clickTile(2, 1);
  await scene.clickTile(2, 1);
  await expect(log(page, /utilise Vive-Attaque/)).toBeAttached({ timeout: 10_000 });
});

// §5.18 — repoussé (knockback) : Draconnerie (dragon-tail) repousse la cible → ligne « repoussé ».
// La chute/glissade qui peut suivre n'est PAS journalisée (dégâts via HP) → reste 👁.
test("§5.18 repoussé : Draconnerie repousse la cible (journal)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox({ ...DUEL, seed: 3, moves: ["dragon-tail"] });
  await scene.castFirstMove(2, 2);
  await expect(log(page, /repoussé/)).toBeAttached({ timeout: 10_000 });
});
