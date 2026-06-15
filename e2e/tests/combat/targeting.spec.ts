import { expect, test } from "../../fixtures";
import { DUEL } from "../../fixtures/sandbox-configs";

// Cahier §3.7 / §4.8 / §4.12 — highlights de tile + ligne d'instruction pendant les phases d'input.
// Le SENS (des highlights apparaissent, l'instruction guide) via scene-graph + DOM ; la COULEUR
// (bleu/rouge) et le contour exact restent 👁.

test("§4.12 déplacement : clic « Deplacement » fait apparaître des highlights de tile", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DUEL);

  // Au repos, aucune tile de déplacement n'est surlignée.
  const countMoveHighlights = async (): Promise<number> =>
    (await scene.meshNames()).filter((name) => name.startsWith("highlight_move_")).length;
  expect(await countMoveHighlights()).toBe(0);

  await page.getByRole("button", { name: "Deplacement", exact: true }).click();

  // Les tiles atteignables sont surlignées (mesh `highlight_move_x_y`).
  await expect.poll(countMoveHighlights).toBeGreaterThan(0);
});

test("§4.8 attaque : la sélection de cible affiche la ligne d'instruction + un highlight", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DUEL);

  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  await page.getByTestId("move-item").first().click(); // Griffe → phase de ciblage

  // Ligne d'instruction guide le joueur, et au moins un highlight de ciblage est monté.
  await expect(page.getByTestId("combat-instruction")).toHaveText("Sélectionne la cible");
  await expect
    .poll(async () => (await scene.meshNames()).filter((n) => n.startsWith("highlight")).length)
    .toBeGreaterThan(0);

  // Viser une cible verrouille la preview → phase de confirmation (l'instruction change).
  await scene.clickTile(2, 2);
  await expect(page.getByTestId("combat-instruction")).toHaveText("Confirmer ?");
});
