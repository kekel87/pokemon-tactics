import type { Page } from "@playwright/test";
import { expect, seedSavedTeams, test } from "../../fixtures";
import { MainMenu } from "../../pages/MainMenu";
import { DUEL_ATTACKER_TEAM_ID, DUEL_TEAM_STORAGE } from "../../pages/online-duel";
import { BattleModeScreen, TeamSelectScreen } from "../../pages/screens";
import { readStoredTeams } from "../../pages/teamBuilder";

/*
 * §6.4 — modifier son équipe sans quitter la sélection (plan 228).
 *
 * L'icône ✏️ d'un camp ouvre l'éditeur d'équipe PAR-DESSUS l'écran, dans une modale : naviguer vers
 * l'écran d'édition aurait démonté la sélection, et avec elle le format et les camps réglés. Ce que
 * ces scénarios gardent, c'est le RETOUR : la carte de camp tient une copie de l'équipe, et c'est
 * cette copie qui part en combat. Une fermeture qui ne la relirait pas laisserait l'écran — et le
 * combat — sur l'ancienne version, sans qu'aucun test unitaire ne bronche.
 */

const RENAMED_TEAM = "Duel — renommée";
/** Le nom que porte une équipe neuve (`teamBuilder.untitledTeam`). */
const UNTITLED_TEAM = "Équipe sans nom";

/** Pose les équipes du duel, puis entre en sélection d'équipe solo. */
async function openTeamSelect(page: Page): Promise<TeamSelectScreen> {
  await seedSavedTeams(page, DUEL_TEAM_STORAGE);
  const menu = new MainMenu(page);
  const teams = new TeamSelectScreen(page);
  await menu.goto();
  await menu.combat.click();
  await new BattleModeScreen(page).local.click();
  await expect(teams.title).toBeVisible();
  return teams;
}

test("§6.4 ✏️ ouvre l'éditeur, et le retour met à jour TOUS les camps qui tiennent l'équipe", async ({
  page,
}) => {
  const teams = await openTeamSelect(page);

  // Sans équipe sauvegardée, pas d'icône : il n'y aurait rien à ouvrir. Témoin de l'apparition.
  await expect(teams.editButton(0)).toHaveCount(0);

  // Les deux camps tiennent la MÊME équipe : chacun en garde sa propre copie.
  await teams.pickSavedTeam(0, DUEL_ATTACKER_TEAM_ID);
  await teams.pickSavedTeam(1, DUEL_ATTACKER_TEAM_ID);
  await expect(teams.teamButton(1)).toContainText("Duel — Alakazam");

  await teams.editButton(0).click();
  await expect(teams.teamEditor).toBeVisible();
  await expect(teams.teamEditor).toHaveAttribute("data-size", "screen");
  // L'écran d'en dessous n'est pas démonté : il reste là, sous le voile.
  await expect(teams.teamButton(0)).toBeAttached();

  // Renommer puis revenir AUSSITÔT : la sauvegarde de l'éditeur est différée, la fermeture doit la
  // vider avant que l'écran ne relise l'équipe — sinon le nom resterait l'ancien.
  await teams.teamEditor.getByTestId("team-name-input").fill(RENAMED_TEAM);
  await teams.teamEditor.getByTestId("screen-back").click();

  await expect(teams.teamEditor).toHaveCount(0);
  await expect(teams.teamButton(0)).toContainText(RENAMED_TEAM);
  await expect(teams.teamButton(1)).toContainText(RENAMED_TEAM);
  expect(await readStoredTeams(page)).toContain(RENAMED_TEAM);
  // Le focus revient à l'icône d'où l'on est parti, pas au `<body>`.
  await expect(teams.editButton(0)).toBeFocused();
});

test("§6.4 « + Nouvelle équipe » assigne une équipe vide au camp, et « Lancer » se grise", async ({
  page,
}) => {
  const teams = await openTeamSelect(page);

  // Le témoin : un camp aléatoire rend la partie lançable. Sans lui, « Lancer » grisé ne dirait
  // rien — il l'est déjà sur un camp sans équipe.
  await teams.pickRandomTeam(0);
  await expect(teams.launch).toBeEnabled();

  await teams.teamButton(0).click();
  await teams.pickerCreateTeam.click();

  // L'éditeur s'ouvre directement sur l'équipe neuve.
  await expect(teams.teamEditor).toBeVisible();
  await expect(teams.teamEditor.getByTestId("team-name-input")).toHaveValue(UNTITLED_TEAM);
  await page.keyboard.press("Escape");
  await expect(teams.teamEditor).toHaveCount(0);

  await expect(teams.teamButton(0)).toHaveAttribute("data-state", "saved");
  await expect(teams.teamButton(0)).toContainText(UNTITLED_TEAM);
  // 🔴 Une équipe sauvegardée VIDE n'est pas lançable : le combat partirait avec un camp sans Pokémon.
  await expect(teams.launch).toBeDisabled();
});

/*
 * Navigation SPATIALE : → depuis le bouton d'équipe, large, doit atteindre l'icône collée à sa droite
 * et non un bouton du segment Humain / IA de la rangée du dessus, dont le centre est plus proche.
 * C'est le défaut que le calcul bord à bord a corrigé (`directionalScore`, plan 228). Le test part du
 * VOISIN et presse de vraies touches — il ne focalise jamais l'icône lui-même.
 */
test("§6.4 clavier : → depuis l'équipe atteint ✏️, ← y revient, Entrée ouvre et Échap rend le focus", async ({
  page,
}) => {
  const teams = await openTeamSelect(page);
  await teams.pickSavedTeam(0, DUEL_ATTACKER_TEAM_ID);

  await teams.teamButton(0).focus();
  await page.keyboard.press("ArrowRight");
  await expect(teams.editButton(0)).toBeFocused();

  await page.keyboard.press("ArrowLeft");
  await expect(teams.teamButton(0)).toBeFocused();

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(teams.teamEditor).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(teams.teamEditor).toHaveCount(0);
  await expect(teams.editButton(0)).toBeFocused();
});
