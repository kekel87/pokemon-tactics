import { expect, test } from "../../fixtures";
import { MainMenu } from "../../pages/MainMenu";
import { BattleModeScreen, MapSelectScreen, TeamSelectScreen } from "../../pages/screens";

// Cahier §6.2 / §6.3 / §6.4 — écrans DOM hors combat (modes, carte, sélection d'équipe).

test("§6.2 mode de combat : Local et En ligne actifs, Tutoriel désactivé", async ({ page }) => {
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);

  await menu.goto();
  await menu.combat.click();

  await expect(mode.local).toBeEnabled();
  // « En ligne » ouvre l'écran `lobby` depuis le plan 199 ; seul le Tutoriel reste à faire.
  await expect(mode.online).toBeEnabled();
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

// Cahier §6.4 — plan 198. Ce contrôle vivait en §6.7 (`settings.spec`) sur la seule prévisualisation
// de dégâts : il a suivi le paramètre, et couvre désormais les DEUX cases. « Placement auto » n'était
// pas persisté du tout avant ce plan (simple variable locale), donc la seconde moitié est neuve.
test("§6.4 sélection d'équipe : les 2 paramètres de partie persistent (pt-settings) et sont relus", async ({
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

  // Les deux sont cochées par défaut.
  await expect(teams.autoPlacement).toBeChecked();
  await expect(teams.damagePreview).toBeChecked();

  await teams.autoPlacement.uncheck();
  await teams.damagePreview.uncheck();

  const stored = await page.evaluate(() => localStorage.getItem("pt-settings"));
  expect(stored).toBeTruthy();
  expect(JSON.parse(stored ?? "{}")).toMatchObject({
    autoPlacement: false,
    damagePreview: false,
  });

  /*
   * RECHARGER, et pas seulement ressortir de l'écran.
   *
   * Une simple sortie/retour rappelle bien la factory d'écran (`ScreenManager` fait dispose puis
   * mount), mais `getSettings()` rendrait la copie EN MÉMOIRE que `updateSettings` vient d'écrire :
   * le test passerait même si `localStorage.setItem` ne faisait rien. Le rechargement force le
   * chemin réellement neuf — `initSettings()` au boot, qui repeuple depuis le magasin.
   */
  await page.reload();
  await menu.combat.click();
  await mode.local.click();
  await maps.confirm.click();
  await expect(teams.title).toBeVisible();

  await expect(teams.autoPlacement).not.toBeChecked();
  await expect(teams.damagePreview).not.toBeChecked();
});

/**
 * §6.4 — les deux paramètres de partie sont **atteignables aux flèches**, pas seulement par `Tab`.
 *
 * La navigation du projet est **spatiale** (`focusInDirection`) : un contrôle focalisable peut très
 * bien rester injoignable s'il est isolé dans un coin. Le test part donc d'un contrôle voisin et
 * presse de vraies touches — il ne focalise **jamais** la cible lui-même, ce qui court-circuiterait
 * précisément ce qu'il prouve (`.claude/rules/multi-input.md`).
 *
 * `Space` sur une case est une activation **native** du navigateur : c'est bien ce chemin-là qu'on
 * vérifie, pas un `click()` synthétique.
 */
test("§6.4 sélection d'équipe : les flèches atteignent les 2 paramètres, Espace les bascule", async ({
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

  const focusedTestId = () =>
    page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.testid ?? null);

  // Départ sur le bouton d'équipe du camp 1, au-dessus du pied d'écran.
  await teams.teamButton(0).focus();
  expect(await focusedTestId()).toBe("player-team-button");

  /*
   * Descendre jusqu'au pied, en marchant plutôt qu'en comptant les appuis.
   *
   * Le nombre de ↓ dépend du FORMAT : chaque camp intercalé entre le point de départ et le pied
   * ajoute un arrêt, et le format par défaut de la carte peut changer. En 2v6 il en faut deux — le
   * premier ↓ passe du bouton d'équipe du camp 1 à celui du camp 2, qui partagent le `data-testid`
   * `player-team-button` et ne se distinguent que par `data-slot-index`. Une assertion sur le seul
   * testid après un appui unique lit donc « rien n'a bougé » alors que le focus a bien avancé : la
   * première rédaction de ce test est tombée exactement là-dessus.
   */
  const MAX_STEPS = 8;
  let landed: string | null = null;
  for (let step = 0; step < MAX_STEPS; step++) {
    await page.keyboard.press("ArrowDown");
    landed = await focusedTestId();
    if (landed !== null && /^team-select-(auto-placement|damage-preview)$/.test(landed)) {
      break;
    }
  }
  expect(landed).toMatch(/^team-select-(auto-placement|damage-preview)$/);

  /*
   * Normalise le point de départ sur la case de GAUCHE — ce n'est pas une assertion : selon le
   * format, la boucle a pu atterrir directement dessus, et un ← sans voisin ne bouge pas le focus,
   * donc l'assertion passerait sans rien démontrer.
   */
  await page.keyboard.press("ArrowLeft");
  expect(await focusedTestId()).toBe("team-select-auto-placement");

  // CELLE-CI est porteuse : les deux cases se joignent bien horizontalement.
  await page.keyboard.press("ArrowRight");
  expect(await focusedTestId()).toBe("team-select-damage-preview");

  // Espace bascule la case focalisée — et le focus ne saute pas au `<body>`.
  await expect(teams.damagePreview).toBeChecked();
  await page.keyboard.press("Space");
  await expect(teams.damagePreview).not.toBeChecked();
  expect(await focusedTestId()).toBe("team-select-damage-preview");
});
