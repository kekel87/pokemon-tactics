import { expect, test } from "../../fixtures";
import { DUEL } from "../../fixtures/sandbox-configs";

// Cahier §4.1 / §4.2 / §4.4 / §4.5 / §4.9 — chrome DOM du combat (hors tooltip/pattern déjà couverts
// par hud.spec). Un duel à 4 moves pour exercer la liste du sous-menu d'attaque.
const FOUR_MOVES = {
  ...DUEL,
  moves: ["scratch", "vine-whip", "razor-leaf", "sleep-powder"],
} as const;

test("§4.1 bannière de tour : nom FR du Pokemon actif", async ({ page, bootSandbox }) => {
  await bootSandbox(DUEL);
  // Charge Time seul : plus de notion de round → la bannière n'affiche que le nom FR officiel.
  await expect(page.getByTestId("combat-turn")).toHaveText("Florizarre");
});

test("§4.2 timeline : entrée active surlignée, couleur d'équipe, portrait", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(DUEL);
  // data-active / data-team sont des attributs d'état sémantiques (pas des classes de style).
  const active = page.getByTestId("timeline-entry").and(page.locator('[data-active="true"]'));
  await expect(active).toHaveCount(1);
  await expect(active).toHaveAttribute("data-team", /\d+/);
  await expect(active.getByTestId("timeline-portrait")).toBeVisible();
});

test("§4.4 menu d'action : 5 boutons FR, Objet et Statut désactivés", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(DUEL);
  const menu = page.getByTestId("action-menu");

  for (const label of ["Deplacement", "Attaque", "Objet", "Attendre", "Statut"]) {
    await expect(menu.getByRole("button", { name: label, exact: true })).toBeVisible();
  }
  // Objet / Statut non implémentés → toujours désactivés.
  await expect(menu.getByRole("button", { name: "Objet", exact: true })).toBeDisabled();
  await expect(menu.getByRole("button", { name: "Statut", exact: true })).toBeDisabled();
  // Les trois autres sont actifs au tour du joueur.
  await expect(menu.getByRole("button", { name: "Attaque", exact: true })).toBeEnabled();
});

test("§4.5 sous-menu d'attaque : icône de type + nom FR par move", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(FOUR_MOVES);
  await page.getByRole("button", { name: "Attaque", exact: true }).click();

  const items = page.getByTestId("move-item");
  await expect(items).toHaveCount(4);

  const first = items.first();
  await expect(first.getByTestId("move-type-icon")).toBeVisible(); // icône de type
  await expect(first.getByTestId("move-name")).toHaveText("Griffe"); // nom FR
  // Plus d'affichage de PP : le mécanisme d'usage des PP est retiré (Charge Time régule le rythme).
  await expect(first.getByTestId("move-pp")).toHaveCount(0);
});

test("§4.9 journal de combat : titre + en-tête repliable présents", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(DUEL);
  await expect(page.getByTestId("battle-log-title")).toHaveText("Journal de combat");
  // En-tête repliable = un vrai <button> (toggle collapse).
  await expect(page.getByTestId("battle-log-toggle")).toBeVisible();
});
