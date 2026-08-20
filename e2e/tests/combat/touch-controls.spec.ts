import { expect, test } from "../../fixtures";
import { DUEL, DUEL_DIRECTIONAL, DUEL_SELF_TARGET } from "../../fixtures/sandbox-configs";

// Contrôles tactiles (plan 183, Lot 1). Cahier de recette : docs/test-plan.md §4.18.
//
// ⚠️ `clickTile` / `hoverTile` du hook e2e COURT-CIRCUITENT la couche d'entrée (ils appellent
// l'orchestrateur en direct, et ~419 tests en dépendent). Seul `tapTile` synthétise un vrai
// pointerdown/pointerup tactile : toute assertion sur le comportement au doigt doit passer par lui.
//
// Deux familles :
//  - le tap agit du premier coup, SAUF pour viser un pattern directionnel, où retaper la même
//    DIRECTION valide (et non la même case : plusieurs cases partagent une direction) ;
//  - l'annulation atteignable au doigt : les phases qui vidaient le chrome exposent une instruction
//    et un bouton « Annuler », seule sortie possible sans clavier.

const PREVIEW_PREFIX = "highlight_preview_attack_";

test("tactile : un seul tap suffit pour se déplacer", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(DUEL);

  await page.getByRole("button", { name: "Deplacement", exact: true }).click();
  expect(await scene.tapTile(3, 3)).toBe(true);

  // Le déplacement est parti du premier coup : le menu propose de l'annuler. Un tap en deux temps
  // généralisé demandait 4 taps par action (le jeu a déjà sa propre étape de confirmation).
  await expect(
    page.getByRole("button", { name: "Annuler deplacement", exact: true }),
  ).toBeVisible();
});

test("tactile : un pattern directionnel s'ouvre avec son cône déjà affiché", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DUEL_DIRECTIONAL);

  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  await page.getByTestId("move-item").first().click();

  // Sans ça la phase s'ouvrait sur un plateau vide et il fallait deviner qu'il fallait taper
  // quelque part ("on comprend pas ce qu'il faut faire", humain 2026-08-20).
  await expect
    .poll(async () => (await scene.meshNamesStartingWith(PREVIEW_PREFIX)).length)
    .toBeGreaterThan(0);

  // Et on ne parle plus de « cible » : ce motif se vise par une DIRECTION (retour humain).
  await expect(page.getByTestId("combat-instruction")).toHaveText("Choisis la direction");
});

test("tactile : retaper la direction déjà visée lance l'attaque", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(DUEL_DIRECTIONAL);

  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  await page.getByTestId("move-item").first().click();
  await expect
    .poll(async () => (await scene.meshNamesStartingWith(PREVIEW_PREFIX)).length)
    .toBeGreaterThan(0);

  // Le lanceur regarde le nord et la cible est au nord : la direction par défaut est déjà la bonne,
  // donc accepter ce défaut coûte UN tap, pas deux.
  await scene.tapTile(2, 2);

  // Cible verrouillée → phase de confirmation : le chrome montre la ligne « Confirmer ? ».
  await expect(page.getByTestId("combat-instruction")).toHaveText("Confirmer ?");
});

test("tactile : taper une autre direction re-vise sans lancer", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(DUEL_DIRECTIONAL);

  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  await page.getByTestId("move-item").first().click();
  await expect
    .poll(async () => (await scene.meshNamesStartingWith(PREVIEW_PREFIX)).length)
    .toBeGreaterThan(0);

  // Le lanceur est en (2,3) face au nord : taper à l'est change la direction, donc ça doit MONTRER
  // le nouveau cône et surtout ne rien lancer.
  await scene.tapTile(4, 3);
  await expect(page.getByTestId("combat-instruction")).toHaveText("Choisis la direction");

  // Et retaper cette même direction — sur une AUTRE case de cette direction, ce qui prouve que la
  // comparaison porte sur la direction et non sur la case — lance bien l'attaque.
  await scene.tapTile(3, 3);
  await expect(page.getByTestId("combat-instruction")).toHaveText("Confirmer ?");
});

test("une attaque centrée sur le lanceur saute la phase de ciblage", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(DUEL_SELF_TARGET);

  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  await page.getByTestId("move-item").first().click();

  // Un motif statique est centré sur le lanceur : la phase de ciblage demandait de choisir entre une
  // seule option et se validait sur n'importe quel clic (retour humain 2026-08-20). On arrive donc
  // directement à la confirmation, l'empreinte reste affichée et la prévision de dégâts s'ajoute.
  await expect(page.getByTestId("combat-instruction")).toHaveText("Confirmer ?");
});

test("annulation : le choix de destination expose une instruction et un bouton Annuler", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(DUEL);

  await page.getByRole("button", { name: "Deplacement", exact: true }).click();

  // Cette phase appelait `hideMenus()` : l'écran était vide, donc sans issue au doigt.
  await expect(page.getByTestId("combat-instruction")).toHaveText("Où se déplacer ?");
  const cancel = page.getByRole("button", { name: "Annuler", exact: true });
  await expect(cancel).toBeVisible();

  await cancel.click();
  await expect(page.getByRole("button", { name: "Deplacement", exact: true })).toBeVisible();
});

test("annulation : le choix de cible expose un bouton Annuler et revient au sous-menu", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(DUEL);

  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  await page.getByTestId("move-item").first().click();

  // Phase de ciblage : le nom de l'attaque était seul, sans aucun moyen de reculer.
  const cancel = page.getByRole("button", { name: "Annuler", exact: true });
  await expect(cancel).toBeVisible();

  await cancel.click();
  await expect(page.getByTestId("move-item").first()).toBeVisible();
});

test("annulation : le choix d'orientation expose un bouton Annuler et revient au menu", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(DUEL);

  await page.getByRole("button", { name: "Attendre", exact: true }).click();

  await expect(page.getByTestId("combat-instruction")).toHaveText("Choisis l'orientation");
  const cancel = page.getByRole("button", { name: "Annuler", exact: true });
  await expect(cancel).toBeVisible();

  await cancel.click();
  // Le sélecteur est bien démonté et le HUD rétabli : on est de retour au menu racine.
  await expect(page.getByRole("button", { name: "Attaque", exact: true })).toBeVisible();
});
