import { expect, test } from "../../fixtures";
import { DUEL, DUEL_LETHAL } from "../../fixtures/sandbox-configs";

test("piloter : Griffe touche le dummy adjacent et journalise l'effet", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DUEL);

  // Menu d'action → sous-menu d'attaque → sélection de Griffe (couvre l'ouverture du menu).
  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  await page.getByTestId("move-item").first().click(); // sélectionne Griffe → select_attack_target

  await scene.clickTile(2, 2); // pick target → confirm_attack
  await scene.clickTile(2, 2); // confirme → resolveAttack

  // L'attaque résout → le journal montre l'usage du move puis les dégâts (PV perdus).
  await expect(
    page.getByTestId("battle-log-entry").filter({ hasText: "utilise Griffe" }),
  ).toBeAttached({
    timeout: 10_000,
  });
  await expect(
    page.getByTestId("battle-log-entry").filter({ hasText: /perd \d+ PV/ }),
  ).toBeAttached();
});

test("piloter : un coup létal met le dummy K.O.", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(DUEL_LETHAL);

  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  await page.getByTestId("move-item").first().click();
  await scene.clickTile(2, 2);
  await scene.clickTile(2, 2);

  // Le journal annonce le K.O. (les sprites K.O. restent en place — pas d'assert sur le count)…
  await expect(page.getByTestId("battle-log-entry").filter({ hasText: "est K.O." })).toBeAttached({
    timeout: 10_000,
  });
  // …et, le seul adversaire étant à terre, le combat se termine.
  await expect(
    page.getByTestId("battle-log-entry").filter({ hasText: "remporte le combat" }),
  ).toBeAttached();
});

test("piloter : un déplacement débloque l'annulation (mouvement exécuté)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DUEL);

  await page.getByRole("button", { name: "Deplacement", exact: true }).click();
  await scene.clickTile(3, 3); // tile libre adjacente → exécute le déplacement

  // Mouvement effectué → le menu propose désormais d'annuler le déplacement.
  await expect(page.getByRole("button", { name: "Annuler deplacement", exact: true })).toBeVisible({
    timeout: 10_000,
  });
});
