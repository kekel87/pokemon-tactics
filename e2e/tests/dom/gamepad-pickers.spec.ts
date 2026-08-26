import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import {
  connectPad,
  focusedTagName,
  focusedTestId,
  holdPadUntil,
  PadButton,
  tapPadButton,
  withFakeGamepad,
} from "../../pages/gamepad";
import { MainMenu } from "../../pages/MainMenu";
import { MyTeamsScreen, PokemonEdit, PokemonPicker, TeamEditScreen } from "../../pages/teamBuilder";

// Cahier §6.13 — la manette dans le Team Builder et ses sélecteurs (plan 188, volet 2).
//
// Ce que ces tests couvrent est exactement ce que le gate ne voyait pas : des `<div>` cliquables
// passent lint, typecheck et toute la suite existante, tout en étant INVISIBLES au focus. Un
// sélecteur où l'on ne peut rien choisir à la manette était donc un état parfaitement vert.
//
// ⚠️ La modale doit être ouverte AU PAD, pas à la souris. `focusPickerEntry` décide du focus d'entrée
// d'après la source ACTIVE : ouvrir au clic laisse la souris active, et le focus va alors au champ de
// recherche — ce qui est le bon comportement pour une souris. Un test qui cliquerait pour ouvrir
// testerait donc le cas souris en croyant tester le pad. (Erreur commise à la première écriture.)

/** menu → Constructeur d'équipe → nouvelle équipe, puis la manette prend la main. */
async function openTeamEditWithPad(page: Page): Promise<TeamEditScreen> {
  const menu = new MainMenu(page);
  const myTeams = new MyTeamsScreen(page);
  const edit = new TeamEditScreen(page);
  await menu.goto();
  await menu.teamBuilder.click();
  await myTeams.newTeam.click();
  // Le poller démarre ici, une fois l'`InputSystem` en place — pas sur `load`, qui est une course.
  await connectPad(page);
  return edit;
}

/** Ouvre le sélecteur de Pokemon d'un slot par une pression A, pad actif. */
async function openPickerWithPad(page: Page, edit: TeamEditScreen): Promise<PokemonPicker> {
  const picker = new PokemonPicker(page);
  // Le focus est posé sur le slot, puis A l'active : c'est `activateFocusedControl` qui clique, donc
  // la source active est bien la manette au moment où la modale se monte.
  await edit.slot(1).focus();
  await tapPadButton(page, PadButton.A);
  await expect(picker.title).toBeVisible();
  return picker;
}

test("§6.13 à la manette, le sélecteur s'ouvre sur un résultat — pas dans le champ de recherche", async ({
  page,
}) => {
  await withFakeGamepad(page);
  const edit = await openTeamEditWithPad(page);
  await openPickerWithPad(page, edit);

  // Le cul-de-sac d'avant : le focus atterrissait dans `<input type="text">`, où une manette ne peut
  // ni taper ni comprendre pourquoi rien ne répond.
  await expect.poll(() => focusedTagName(page)).toBe("BUTTON");
  expect(await focusedTestId(page)).toBe("pokemon-cell");
});

test("§6.13 à la manette, on remonte de la grille aux filtres, puis on choisit un Pokemon", async ({
  page,
}) => {
  await withFakeGamepad(page);
  const edit = await openTeamEditWithPad(page);
  const picker = await openPickerWithPad(page, edit);

  // Remonter depuis la grille atteint la rangée de filtres — inatteignable avant le plan 188, les
  // chips étant des `<div>` sans `tabindex`. C'est la rangée de GÉNÉRATION qui est juste au-dessus de
  // la grille, la navigation étant spatiale : viser les filtres de type sauterait une rangée.
  await tapPadButton(page, PadButton.DpadUp);
  await expect.poll(() => focusedTestId(page)).toBe("pokemon-gen-filter");

  // Redescendre ramène sur la grille, et A choisit : le geste complet, sans souris.
  await tapPadButton(page, PadButton.DpadDown);
  await expect.poll(() => focusedTestId(page)).toBe("pokemon-cell");
  await tapPadButton(page, PadButton.A);

  await expect(picker.dialog).toBeHidden();
  await expect(edit.slot(2)).toBeVisible();
});

test("§6.13 B referme le sélecteur, là où Échap n'existe pas sur une manette", async ({ page }) => {
  await withFakeGamepad(page);
  const edit = await openTeamEditWithPad(page);
  const picker = await openPickerWithPad(page, edit);

  await tapPadButton(page, PadButton.B);

  await expect(picker.dialog).toBeHidden();
});

test("§6.13 à la manette, ← → règlent un curseur de PS et on peut le quitter par ↑ ↓", async ({
  page,
}) => {
  await withFakeGamepad(page);
  const edit = await openTeamEditWithPad(page);
  const picker = await openPickerWithPad(page, edit);
  await picker.cells.first().click();
  await expect(picker.dialog).toBeHidden();

  const pokemonEdit = new PokemonEdit(page);
  await expect(pokemonEdit.name).toBeVisible();
  await connectPad(page);

  // Le bug que ce test a fini par attraper n'était PAS dans le curseur : `applyToControl` appelait
  // `stepUp` détaché de son receveur, ce qui levait `Illegal invocation`, ce qui tuait la boucle du
  // poller manette — donc toute la manette, jusqu'au rechargement. Le symptôme observé était « les
  // curseurs ne bougent pas et je reste bloqué dessus ».
  const slider = page.getByTestId("pokemon-edit-sp-slider").first();
  await slider.focus();
  const before = await slider.inputValue();
  await holdPadUntil(page, PadButton.DpadRight, async () => (await slider.inputValue()) !== before);
  expect(Number(await slider.inputValue())).toBeGreaterThan(Number(before));

  // Et l'axe VERTICAL n'est pas revendiqué : il faut toujours pouvoir sortir du contrôle.
  const focusedIsSlider = async () => (await focusedTestId(page)) === "pokemon-edit-sp-slider";
  await holdPadUntil(page, PadButton.DpadDown, async () => !(await focusedIsSlider()));
});
