import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { MainMenu } from "../../pages/MainMenu";
import { Responsive } from "../../pages/responsive";
import {
  BattleModeScreen,
  ControlsScreen,
  CreditsScreen,
  MapSelectScreen,
  SettingsScreen,
  TeamSelectScreen,
} from "../../pages/screens";
import { MyTeamsScreen, PokemonEdit, PokemonPicker, TeamEditScreen } from "../../pages/teamBuilder";

// Cahier §6.10 — plancher tactile des écrans de MENU (plan 206).
//
// Le plancher de 30 px sous `pointer: coarse` n'était gardé que sur le chrome de combat
// (`combat/responsive-chrome.spec.ts` §4.16) — or c'est hors combat que la mesure du plan 206 a
// trouvé ses écarts, et les pires : lignes de cartes à 20,8 px, cases du pied de la sélection
// d'équipe à 19 px, curseurs d'EV à 16 px, 81 cases de l'écran des contrôles à 28 px. `--target-min`
// est depuis UN seul réglage (`tokens.css`), donc un seul garde-fou le prouve sur tous les écrans.
//
// `hasTouch: true` est ce qui met `pointer: coarse` en vigueur dans Chromium — sans lui le token
// vaut 24 px et ce fichier ne testerait pas le plancher qu'il prétend tenir. Contre-épreuve jouée
// sur le CSS d'AVANT (plan 206) : les trois tests tombent, en nommant 83 contrôles sur l'écran des
// contrôles, 9 lignes de cartes et 3 boutons de « Mes équipes » à 568×320 — et, la sonde recadrée
// sur la seule 4K, les segments à 26 px et les curseurs d'EV à 16 px que le backlog disait « figés
// en 4K ». Un plancher qui passerait des deux côtés ne garderait rien.
//
// On mesure la **hit-area**, pas le rendu : un `<label>` qui enveloppe une case est tapable en
// entier, donc c'est lui la cible (`.claude/rules/multi-input.md` §3). Le confort réel au doigt
// reste 👁 (téléphone réel).

/** `--target-min` sous `pointer: coarse` (`tokens.css`, plan 206). */
const TARGET_MIN = 30;

/**
 * Les trois bornes des cinq viewports de référence (`.claude/rules/multi-input.md` §4) qui changent
 * quelque chose ici : de part et d'autre du seuil « étroit » du projet
 * (`height < 500px, width < 900px`, qui rebase les tokens d'espacement), puis la 4K — où le backlog
 * signalait des contrôles restés figés pendant que leurs voisins grandissaient. Les deux viewports
 * intermédiaires (667×375, 1920×1080) tombent du même côté de chaque seuil qu'un de ceux-ci et
 * n'ajouteraient que du temps.
 */
const VIEWPORTS = [
  { width: 568, height: 320 },
  { width: 1024, height: 768 },
  { width: 2560, height: 1440 },
] as const;

/**
 * Rejoue la sonde sur l'écran monté à chacune des trois tailles, puis rend la plus étroite — c'est
 * elle qui sert à la navigation, pour que chaque écran soit atteint dans les mêmes conditions.
 * Un redimensionnement ne remonte rien, donc le balayage coûte trois `evaluate` et pas trois boots.
 */
async function expectTouchFloorHeld(page: Page, screen: string): Promise<void> {
  const responsive = new Responsive(page);
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await expect
      .poll(() => responsive.undersizedTouchTargets(TARGET_MIN), {
        message: `${screen} — ${viewport.width}×${viewport.height}`,
      })
      .toEqual([]);
  }
  await page.setViewportSize(VIEWPORTS[0]);
}

test.describe("§6.10 plancher tactile des écrans de menu", () => {
  test.use({ viewport: VIEWPORTS[0], hasTouch: true });

  test("§6.10 menu, paramètres, contrôles et crédits tiennent le plancher", async ({ page }) => {
    const menu = new MainMenu(page);
    const settings = new SettingsScreen(page);
    const controls = new ControlsScreen(page);
    const credits = new CreditsScreen(page);

    await menu.goto();
    await expect(menu.title).toBeVisible();
    await expectTouchFloorHeld(page, "menu principal");

    await menu.settings.click();
    await expect(settings.title).toBeVisible();
    await expectTouchFloorHeld(page, "paramètres");

    // L'écran des contrôles est le plus peuplé du jeu : 5 sections × 3 colonnes de boutons de
    // capture. Ils vivaient sur un `clamp()` dont le bas — 28 px — était sous le plancher, et c'est
    // ce bas qui décide en paysage téléphone (2.8vmin n'y vaut que 9 px) : 81 cases fautives.
    await settings.controls.click();
    await expect(controls.title).toBeVisible();
    await expectTouchFloorHeld(page, "écran des contrôles");

    // Crédits : un seul contrôle, « Retour », que `flex-shrink` écrasait jusqu'à son `min-height`.
    // On repasse par le menu plutôt que de remonter la pile — le chemin d'arrivée n'est pas ce
    // qu'on teste, et l'écran des contrôles n'a pas de bouton de sortie propre.
    await menu.goto();
    await menu.credits.click();
    await expect(credits.title).toBeVisible();
    await expectTouchFloorHeld(page, "crédits");
  });

  test("§6.10 mode de combat, choix de la carte et sélection d'équipe tiennent le plancher", async ({
    page,
  }) => {
    const menu = new MainMenu(page);
    const battleMode = new BattleModeScreen(page);
    const maps = new MapSelectScreen(page);
    const teamSelect = new TeamSelectScreen(page);

    await menu.goto();
    await menu.combat.click();
    await expect(battleMode.title).toBeVisible();
    await expectTouchFloorHeld(page, "mode de combat");

    // Les 9 lignes de cartes défilent dans une colonne étroite et n'avaient aucun `min-height` :
    // 20,8 px, le pire écart mesuré du jeu.
    await battleMode.local.click();
    await expect(maps.title).toBeVisible();
    await expect(maps.listItems).toHaveCount(9);
    await expectTouchFloorHeld(page, "choix de la carte");

    // Segments de format, cases « Placement auto » / « Prévisualisation dégâts » et « Lancer ▶ » —
    // les trois familles nommées par le backlog, sur le même écran.
    await maps.confirm.click();
    await expect(teamSelect.title).toBeVisible();
    await expect(teamSelect.launch).toBeVisible();
    await expectTouchFloorHeld(page, "sélection d'équipe");

    // Le sélecteur d'équipe est un `<dialog>` monté sur `<body>` : ses lignes ne sont pas dans
    // l'arbre de l'écran, donc rien de ce qu'il contient n'est mesuré tant qu'il est fermé.
    await teamSelect.teamButton(0).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectTouchFloorHeld(page, "sélecteur d'équipe");
  });

  test("§6.10 constructeur d'équipe, éditeur et sélecteur de Pokemon tiennent le plancher", async ({
    page,
  }) => {
    const menu = new MainMenu(page);
    const teams = new MyTeamsScreen(page);
    const slots = new TeamEditScreen(page);
    const picker = new PokemonPicker(page);
    const edit = new PokemonEdit(page);

    await menu.goto();
    await menu.teamBuilder.click();
    await expect(teams.newTeam).toBeVisible();
    await expectTouchFloorHeld(page, "mes équipes");

    await teams.newTeam.click();
    await expect(slots.slot(1)).toBeVisible();
    await expectTouchFloorHeld(page, "édition d'équipe");

    // Le sélecteur : ses puces de type et sa croix de fermeture se resserrent sur écran étroit par
    // des variables propres à la modale, que le plancher doit reprendre (`max(…, --target-min)`).
    await slots.slot(1).click();
    await expect(picker.title).toBeVisible();
    await expectTouchFloorHeld(page, "sélecteur de Pokemon");

    // Fiche d'un Pokemon assigné : la moitié des familles fautives du plan n'existent qu'ici
    // (curseurs d'EV à 16 px, lignes de capacité, options de talent, croix de slot, bouton de genre,
    // et le « D » de remise à zéro d'une ligne d'EV, fautif par sa LARGEUR et pas par sa hauteur).
    await picker.search.fill("flo");
    await picker.cell("Florizarre").click();
    await expect(slots.filledSlot("Florizarre")).toBeVisible();
    await expect(edit.name).toHaveText("Florizarre");
    await expectTouchFloorHeld(page, "fiche d'un Pokemon");
  });
});
