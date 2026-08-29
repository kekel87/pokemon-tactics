import { expect, test } from "../../fixtures";
import { EnglishScreens } from "../../pages/en-locators";
import { MainMenu } from "../../pages/MainMenu";
import { BattleModeScreen, MapSelectScreen, TeamSelectScreen } from "../../pages/screens";

/*
 * Cahier §6.3 / §6.4 — i18n des écrans de préparation au combat.
 *
 * Deux textes y étaient bâtis hors du dictionnaire : les étiquettes de terrain d'une carte (un
 * `string[]` français en dur dans `maps-registry.ts`) et le libellé d'un format (« 2J × 6 »,
 * gabarit en dur dans `FormatPicker.ts`). Ils fuitaient donc en français dans l'UI anglaise, à
 * côté d'un nom et d'une description qui, eux, étaient bien traduits.
 *
 * La suite tourne en `fr-FR` (locale épinglée), donc le passage à l'anglais se fait par le bouton
 * de langue du menu — le geste du joueur, et le seul qui existe : aucun écran de préparation ne
 * porte de bascule de langue.
 *
 * Les localisateurs par `data-testid` (`MapSelectScreen`, `TeamSelectScreen`) sont indépendants de
 * la langue et servent dans les deux sens ; seuls les localisateurs par libellé viennent de
 * `EnglishScreens`.
 */

test("§6.3 choix de carte : les étiquettes de terrain s'affichent en français", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  const battleMode = new BattleModeScreen(page);
  const maps = new MapSelectScreen(page);

  await menu.goto();
  await menu.combat.click();
  await battleMode.local.click();

  // « Grotte Exiguë » : la seule carte dont les deux étiquettes se traduisent en mots différents
  // (« couloirs » → corridors, « dénivelé » → elevation), donc celle où une fuite se voit.
  await maps.listItems.nth(2).click();
  await expect(maps.detailName).toHaveText("Grotte Exiguë");

  await expect(maps.detailMeta).toContainText("12×12");
  await expect(maps.detailMeta).toContainText("couloirs, dénivelé");
});

test("§6.3 choix de carte : les étiquettes de terrain suivent la bascule en anglais", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  const maps = new MapSelectScreen(page);
  const english = new EnglishScreens(page);

  await menu.goto();
  await menu.languageToggle.click(); // FR → EN
  await english.battle.click();
  await english.local.click();

  await maps.listItems.nth(2).click();
  await expect(maps.detailName).toHaveText("Cramped Cave");

  await expect(maps.detailMeta).toContainText("corridors, elevation");
  // La méta portait le nom ET les étiquettes : le français fuitait dans la seconde moitié d'une
  // ligne dont la première était traduite, ce qu'une assertion sur la seule chaîne anglaise
  // laisserait passer si les deux jeux d'étiquettes venaient à être concaténés.
  await expect(maps.detailMeta).not.toContainText("couloirs");
});

test("§6.4 sélection d'équipe : le libellé de format suit la langue (2P × 6)", async ({ page }) => {
  const menu = new MainMenu(page);
  const teams = new TeamSelectScreen(page);
  const english = new EnglishScreens(page);

  await menu.goto();
  await menu.languageToggle.click(); // FR → EN
  await english.battle.click();
  await english.local.click();
  await english.confirmMap.click();

  // « P » comme Players, pas le « J » de Joueurs : l'initiale suit la locale, comme le titre de
  // rangée « Players × Pokemon ».
  await expect(teams.activeFormatSegment).toHaveText("2P × 6");
  await expect(teams.formatSegmentButtons.nth(1)).toHaveText("3P × 4");

  // Changer de format reconstruit tout l'écran : les libellés sont relus au rendu, ils ne peuvent
  // donc pas retomber dans la locale d'origine.
  await teams.formatSegmentButtons.nth(1).click();
  await expect(teams.activeFormatSegment).toHaveText("3P × 4");
});
