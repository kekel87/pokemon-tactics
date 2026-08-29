import { expect, test } from "../../fixtures";
import { MainMenu } from "../../pages/MainMenu";
import { BattleModeScreen, MapSelectScreen, TeamSelectScreen } from "../../pages/screens";

// Cahier §6.2 / §6.3 / §6.4 — écrans DOM hors combat (modes, carte, sélection d'équipe).

test("§6.2 mode de combat : Local actif, En ligne et Tutoriel désactivés", async ({ page }) => {
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);

  await menu.goto();
  await menu.combat.click();

  await expect(mode.local).toBeEnabled();
  await expect(mode.online).toBeDisabled();
  await expect(mode.tutorial).toBeDisabled();
});

test("§6.3 choix de carte : liste de 9 cartes + sélection met à jour le détail", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);
  const maps = new MapSelectScreen(page);

  await menu.goto();
  await menu.combat.click();
  await mode.local.click();

  await expect(maps.title).toBeVisible();
  await expect(maps.listItems).toHaveCount(9);

  // Carte 0 présélectionnée : nom + méta (dimensions) + description renseignés.
  await expect(maps.detailName).toHaveText("Arène Simple");
  await expect(maps.detailMeta).toContainText("×");
  await expect(maps.detailDescription).not.toBeEmpty();

  // Sélectionner une autre carte met à jour le panneau de détail.
  await maps.listItems.nth(3).click();
  await expect(maps.detailName).toHaveText("Volcan Actif");
});

test("§6.3 choix de carte : « Retour » revient au mode de combat", async ({ page }) => {
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);
  const maps = new MapSelectScreen(page);

  await menu.goto();
  await menu.combat.click();
  await mode.local.click();
  await expect(maps.title).toBeVisible();

  await maps.back.click();
  await expect(mode.title).toBeVisible();
});

test("§6.0 navigation : Échap revient à l'écran précédent", async ({ page }) => {
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);
  await menu.goto();
  await menu.combat.click();
  await expect(mode.title).toBeVisible();

  await page.keyboard.press("Escape");
  // Retour au menu principal.
  await expect(menu.title).toBeVisible();
});

test("§6.3 choix de carte : ↑/↓ navigue la liste (sélection + aria-current)", async ({ page }) => {
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);
  const maps = new MapSelectScreen(page);
  await menu.goto();
  await menu.combat.click();
  await mode.local.click();
  await expect(maps.detailName).toHaveText("Arène Simple");

  await maps.listItems.first().focus();
  await page.keyboard.press("ArrowDown");

  // Le détail suit la sélection clavier + l'entrée active porte aria-current.
  await expect(maps.detailName).toHaveText("Forêt Dense");
  await expect(maps.listItems.nth(1)).toHaveAttribute("aria-current", "true");
});

test("§6.4 sélection d'équipe : sélecteur de format + contrôles présents", async ({ page }) => {
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);
  const maps = new MapSelectScreen(page);
  const teams = new TeamSelectScreen(page);
  await menu.goto();
  await menu.combat.click();
  await mode.local.click();
  await maps.confirm.click();
  await expect(teams.title).toBeVisible();

  // Rangée de segments de format (plan 188 #830 : c'était un `<select>`) + au moins un camp.
  await expect(teams.formatSegments).toBeVisible();
  // Le libellé lui-même (#835) : « 2J × 6 » et non la clé de format « 2v6 », qui **se lit** « deux
  // contre six ». Le « J » est celui de Joueurs, donc il suit la locale → EN dans `screens-i18n.spec`.
  await expect(teams.activeFormatSegment).toHaveText("2J × 6");
  await expect(teams.teamButton(0)).toBeVisible();
});

test("§6.4 sélection d'équipe : « Lancer » désactivé tant que les slots ne sont pas tous assignés", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);
  const maps = new MapSelectScreen(page);
  const teams = new TeamSelectScreen(page);

  await menu.goto();
  await menu.combat.click();
  await mode.local.click();
  await maps.confirm.click();

  await expect(teams.title).toBeVisible();
  // Joueur 1 = Humain non assigné → lancement bloqué.
  await expect(teams.launch).toBeDisabled();

  // Donne J1 à l'IA (équipe aléatoire assignée) → tous les camps prêts → lançable.
  await teams.giveSlotToAi();
  await expect(teams.launch).toBeEnabled();
});
