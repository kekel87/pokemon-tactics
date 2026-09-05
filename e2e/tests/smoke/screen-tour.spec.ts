import { expect, localSignalling, test } from "../../fixtures";
import { LobbyScreen } from "../../pages/lobby";
import { MainMenu } from "../../pages/MainMenu";
import {
  BattleModeScreen,
  ControlsScreen,
  CreditsScreen,
  MapSelectScreen,
  SettingsScreen,
  TeamSelectScreen,
} from "../../pages/screens";
import { MyTeamsScreen, TeamEditScreen } from "../../pages/teamBuilder";

/**
 * Tour des écrans — le PLANCHER de la boucle d'itération : le plus d'écrans possible dans le moins
 * de temps possible.
 *
 * Pourquoi un seul test plutôt que dix : le coût dominant n'est pas l'assertion mais le
 * `page.goto()` — contexte de navigateur neuf, splash qui retélécharge le bundle de sprites. Dix
 * tests = dix fois ce péage pour vérifier des écrans qui sont, de toute façon, les étapes d'un même
 * parcours. Un seul chargement les visite tous, et **teste la navigation au passage** : chaque
 * « Retour » et chaque Échap est une assertion gratuite qu'un test par écran ne ferait pas.
 *
 * Le prix de ce choix — un échec arrête le tour et masque les écrans suivants — est payé par
 * `test.step` : le rapport nomme l'étape fautive, et les étapes franchies restent lisibles.
 *
 * Ce tour ne monte AUCUNE scène Babylon : c'est ce qui le rend bon marché. Le combat lui-même est
 * couvert par `combat/normal-game.spec.ts` (vrai chemin joueur jusqu'au montage de la scène) et
 * `combat/driving.spec.ts` (attaque, K.O., match nul, annulation de déplacement).
 */

// Dix écrans en un seul test dépassent le défaut de 30 s du projet `smoke` sous charge (chaque
// transition est un démontage/remontage d'écran). Mesuré à ~2 s isolé ; la marge absorbe la
// contention quand la suite entière tourne.
test.setTimeout(60_000);

test("tour des écrans : les 10 écrans DOM montent et la navigation revient", async ({ page }) => {
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);
  const maps = new MapSelectScreen(page);
  const teams = new TeamSelectScreen(page);
  const lobby = new LobbyScreen(page);
  const myTeams = new MyTeamsScreen(page);
  const teamEdit = new TeamEditScreen(page);
  const settings = new SettingsScreen(page);
  const controls = new ControlsScreen(page);
  const credits = new CreditsScreen(page);

  await test.step("1. menu principal", async () => {
    await menu.goto(localSignalling);
    await expect(menu.title).toBeVisible();
    // Comptages en dur ASSUMÉS, ici et pour les cartes : ce tour est joué à chaque gate, donc
    // ajouter une entrée de menu ou une carte le fera virer au rouge. C'est voulu — c'est aussi de
    // la couverture, et un écran qui gagne ou perd une entrée mérite qu'on le décide sciemment.
    await expect(menu.entries).toHaveCount(5);
    await expect(menu.adventure).toBeDisabled();
    await expect(menu.version).toBeVisible();
  });

  await test.step("2. mode de combat", async () => {
    await menu.combat.click();
    await expect(mode.title).toBeVisible();
    await expect(mode.local).toBeEnabled();
    await expect(mode.online).toBeEnabled();
    await expect(mode.tutorial).toBeDisabled();
  });

  await test.step("3. choix de la carte", async () => {
    await mode.local.click();
    await expect(maps.title).toBeVisible();
    await expect(maps.listItems).toHaveCount(9);
    // La première carte est présélectionnée : le panneau de détail la décrit déjà.
    await expect(maps.detailName).toHaveText("Arène Simple");
    await expect(maps.detailDescription).not.toBeEmpty();
  });

  await test.step("4. sélection d'équipe", async () => {
    await maps.confirm.click();
    await expect(teams.title).toBeVisible();
    await expect(teams.activeFormatSegment).toHaveText("2J × 6");
    await expect(teams.teamButton(0)).toBeVisible();
    // Aucun camp assigné → le combat n'est pas lançable.
    await expect(teams.launch).toBeDisabled();
  });

  await test.step("5. retour arrière depuis la sélection d'équipe", async () => {
    await page.keyboard.press("Escape");
    await expect(maps.title).toBeVisible();
    await maps.back.click();
    await expect(mode.title).toBeVisible();
  });

  await test.step("6. salon en ligne", async () => {
    await mode.online.click();
    await expect(lobby.title).toBeVisible();
    // La roue de caractères est le seul widget de saisie du code (cinq emplacements).
    await expect(lobby.codeSlots).toHaveCount(5);
    await expect(lobby.create).toBeEnabled();
    await lobby.back.click();
    await expect(mode.title).toBeVisible();
    await mode.back.click();
    await expect(menu.title).toBeVisible();
  });

  await test.step("7. mes équipes", async () => {
    await menu.teamBuilder.click();
    await expect(myTeams.newTeam).toBeVisible();
    await expect(myTeams.generateRandom).toBeVisible();
  });

  await test.step("8. édition d'équipe", async () => {
    await myTeams.newTeam.click();
    await expect(teamEdit.nameInput).toBeVisible();
    await expect(teamEdit.slot(1)).toBeVisible();
    await teamEdit.back.click();
    await expect(myTeams.newTeam).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu.title).toBeVisible();
  });

  await test.step("9. paramètres puis contrôles", async () => {
    await menu.settings.click();
    await expect(settings.title).toBeVisible();
    await expect(settings.languageToggle).toBeVisible();

    await settings.controls.click();
    await expect(controls.title).toBeVisible();
    // La table de remapping est montée : la case principale d'une action existe.
    await expect(controls.cell("confirm", 0)).toBeVisible();
    await expect(controls.resetAll).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(settings.title).toBeVisible();
    await settings.back.click();
    await expect(menu.title).toBeVisible();
  });

  await test.step("10. crédits", async () => {
    await menu.credits.click();
    await expect(credits.title).toBeVisible();
    await expect(credits.disclaimer).toBeVisible();
    await credits.back.click();
    await expect(menu.title).toBeVisible();
  });
});
