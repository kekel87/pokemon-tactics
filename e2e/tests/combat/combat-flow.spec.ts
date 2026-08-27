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

  await page.getByRole("button", { name: "Déplacement", exact: true }).click();
  await scene.clickTile(3, 3); // exécute le déplacement → le menu propose "Annuler déplacement"

  const undo = page.getByRole("button", { name: "Annuler déplacement", exact: true });
  await expect(undo).toBeVisible();
  await undo.click();

  // Déplacement annulé → l'option "Déplacement" revient (et l'annulation disparaît).
  await expect(page.getByRole("button", { name: "Déplacement", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Annuler déplacement", exact: true })).toHaveCount(
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

  // Le VERDICT est porté par le titre. Avant le 2026-08-27 le titre portait le NOM du vainqueur
  // (« Joueur 1 ») et la phrase juste en dessous le répétait (« Joueur 1 gagne ! »).
  await expect(victory.getByRole("heading")).toHaveText("Joueur 1 gagne !");
  // Et il n'est écrit QU'UNE FOIS : la phrase de détail n'existe plus sur une victoire.
  expect(((await victory.textContent()) ?? "").match(/gagne/g)).toHaveLength(1);
});
