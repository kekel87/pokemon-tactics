import { expect, test } from "../../fixtures";
import { DUEL, DUEL_LETHAL } from "../../fixtures/sandbox-configs";

// Flow / state-machine of the action menu (orchestrator input phases), driven through the DOM +
// the tile-click hook. Distinct from driving.spec, which asserts the *outcome* of a resolved move.

test("flux : annuler le sous-menu d'attaque revient au menu d'action", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(DUEL);

  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  await expect(page.getByTestId("move-item").first()).toBeVisible();

  await page.getByRole("button", { name: "Annuler", exact: true }).click();

  // Retour au menu racine → le bouton Attaque est de nouveau là, le sous-menu a disparu.
  await expect(page.getByRole("button", { name: "Attaque", exact: true })).toBeVisible();
  await expect(page.getByTestId("move-item")).toHaveCount(0);
});

test("flux : annuler un déplacement restaure l'option de déplacement", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DUEL);

  await page.getByRole("button", { name: "Deplacement", exact: true }).click();
  await scene.clickTile(3, 3); // exécute le déplacement → le menu propose "Annuler deplacement"

  const undo = page.getByRole("button", { name: "Annuler deplacement", exact: true });
  await expect(undo).toBeVisible();
  await undo.click();

  // Déplacement annulé → l'option "Deplacement" revient (et l'annulation disparaît).
  await expect(page.getByRole("button", { name: "Deplacement", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Annuler deplacement", exact: true })).toHaveCount(
    0,
  );
});

// §4.12 — Échap recule d'une phase : ciblage → sous-menu d'attaque.
test("flux : Échap en sélection de cible revient au sous-menu d'attaque", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(DUEL);
  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  await page.getByTestId("move-item").first().click(); // → phase ciblage (instruction affichée)
  await expect(page.getByTestId("combat-instruction")).toHaveText("Sélectionne la cible");

  await page.keyboard.press("Escape");

  // Retour au sous-menu : la liste de moves est de nouveau là.
  await expect(page.getByTestId("move-item").first()).toBeVisible();
});

// §4.12 — clic hors portée en ciblage ne résout rien (reste en phase ciblage).
test("flux : clic hors portée en ciblage ne résout pas le move", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(DUEL);
  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  await page.getByTestId("move-item").first().click(); // Griffe (portée 1)
  await scene.clickTile(5, 5); // tuile hors portée

  // Aucun usage de move journalisé, on est toujours en phase ciblage.
  await expect(page.getByTestId("battle-log-entry").filter({ hasText: /utilise/ })).toHaveCount(0);
  await expect(page.getByTestId("combat-instruction")).toHaveText("Sélectionne la cible");
});

// §4.10 — fin de partie : modale de victoire + bouton retour menu.
test("§4.10 modale de victoire : apparaît à la fin du combat avec un retour au menu", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DUEL_LETHAL);
  await scene.castFirstMove(2, 2); // coup létal → dernier adversaire K.O. → fin de combat

  const victory = page.getByRole("dialog").filter({ hasText: /gagne/ });
  await expect(victory).toBeVisible({ timeout: 10_000 });
  await expect(victory.getByRole("button", { name: "Retour au menu" })).toBeVisible();
});
