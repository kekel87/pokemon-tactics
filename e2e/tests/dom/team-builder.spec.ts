import { expect, test } from "../../fixtures";
import { MainMenu } from "../../pages/MainMenu";
import {
  MyTeamsScreen,
  PokemonPicker,
  readStoredTeams,
  TeamEditScreen,
} from "../../pages/teamBuilder";

// Cahier §6.5 / §7.1 — Mes équipes : CRUD + persistance localStorage (pokemon-tactics:teams).

test("§6.5 mes équipes : état vide affiche « Aucune équipe pour l'instant »", async ({ page }) => {
  const menu = new MainMenu(page);
  // Contexte e2e neuf → aucune équipe persistée.
  await menu.goto();
  await menu.teamBuilder.click();
  await expect(page.getByText("Aucune équipe pour l'instant")).toBeVisible();
});

test("équipe : créer, ajouter un Pokemon, renommer → persiste en localStorage", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  const teams = new MyTeamsScreen(page);
  const edit = new TeamEditScreen(page);
  const picker = new PokemonPicker(page);

  await menu.goto();
  await menu.teamBuilder.click();
  await teams.newTeam.click();

  await edit.slot(1).click();
  await picker.search.fill("flo");
  await picker.cell("Florizarre").click();
  await expect(edit.filledSlot("Florizarre")).toBeVisible();

  await edit.nameInput.fill("Team E2E");

  // Auto-save (debounce) → le blob localStorage contient le nom + l'espèce.
  await expect.poll(() => readStoredTeams(page)).toContain("Team E2E");
  expect(await readStoredTeams(page)).toContain("venusaur");
});

test("équipe : générer aléatoire crée une équipe persistée", async ({ page }) => {
  const menu = new MainMenu(page);
  const teams = new MyTeamsScreen(page);
  const edit = new TeamEditScreen(page);

  await menu.goto();
  await menu.teamBuilder.click();
  await teams.generateRandom.click();

  // « Générer aléatoire » ouvre direct l'édition de la nouvelle équipe → persistée.
  await expect(edit.back).toBeVisible();
  expect(await readStoredTeams(page)).toBeTruthy();

  // Retour à la liste → la carte est là.
  await edit.back.click();
  await expect(teams.cards).toHaveCount(1);
});

// FIXME — régression : la migration Phaser → Babylon a perdu la modale de confirmation « Vider
// l'équipe » (les clés i18n `teamBuilder.clearAllConfirmTitle`/`Body` existent encore mais ne sont
// plus appelées ; `TeamEditView.clearAll()` vide direct). Le test attend la modale ; à réactiver
// quand la modale est remise. Cf backlog « Team Builder — « Tout vider » sans confirmation ».
// biome-ignore lint/suspicious/noSkippedTests: régression modale "Tout vider" (cf backlog) — test prêt, à réactiver post-fix
test.fixme("équipe : « Tout vider » demande confirmation puis vide les slots", async ({ page }) => {
  const menu = new MainMenu(page);
  const teams = new MyTeamsScreen(page);
  const edit = new TeamEditScreen(page);
  const picker = new PokemonPicker(page);

  await menu.goto();
  await menu.teamBuilder.click();
  await teams.newTeam.click();

  await edit.slot(1).click();
  await picker.search.fill("flo");
  await picker.cell("Florizarre").click();
  await expect(edit.filledSlot("Florizarre")).toBeVisible();

  await edit.clearAll.click();
  // Attendu (post-fix) : modale de confirmation « Vider l'équipe » → bouton de validation.
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Vider|Confirmer/ })
    .click();

  await expect(edit.filledSlot("Florizarre")).toHaveCount(0);
  await expect(edit.slot(1)).toBeVisible();
});

test("équipe : supprimer (avec confirmation) retire la carte", async ({ page }) => {
  const menu = new MainMenu(page);
  const teams = new MyTeamsScreen(page);
  const edit = new TeamEditScreen(page);

  await menu.goto();
  await menu.teamBuilder.click();
  await teams.generateRandom.click();
  await edit.back.click();
  await expect(teams.cards).toHaveCount(1);

  await teams.cards.first().getByRole("button", { name: "Supprimer" }).click();
  // Modale de confirmation → bouton Supprimer du dialog.
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();

  await expect(teams.cards).toHaveCount(0);
});
