import { expect, seedSavedTeams, test } from "../../fixtures";
import { MainMenu } from "../../pages/MainMenu";
import { DUEL_ATTACKER_TEAM_ID, DUEL_TEAM_STORAGE } from "../../pages/online-duel";
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

test("§6.3 choix de carte : 9 cartes + « Aléatoire », et la sélection met à jour le détail", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);
  const maps = new MapSelectScreen(page);
  const teams = new TeamSelectScreen(page);

  await menu.goto();
  await menu.combat.click();
  // 🔴 Plus d'escale sur le choix du terrain (plan 208) : on entre droit dans la sélection d'équipe,
  // et c'est le bandeau de partie qui ouvre la modale de carte.
  await mode.local.click();
  await expect(teams.title).toBeVisible();
  await maps.open();

  // Dix lignes : les neuf cartes, PLUS « Aléatoire », qui est une entrée volontaire à côté d'elles
  // et jamais un remplacement du choix explicite.
  await expect(maps.listItems).toHaveCount(10);

  await maps.item("volcano").click();
  await expect(maps.detailName).toHaveText("Volcan Actif");
  await expect(maps.detailMeta).toContainText("×");
  await expect(maps.detailDescription).not.toBeEmpty();

  // Retenue, la carte s'affiche au bandeau de partie — l'écran, lui, n'a pas bougé.
  await maps.confirm.click();
  await expect(teams.title).toBeVisible();
  await expect(teams.mapName).toContainText("Volcan Actif");
});

test("§6.3 choix de carte : la modale se referme sans rien changer", async ({ page }) => {
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);
  const maps = new MapSelectScreen(page);
  const teams = new TeamSelectScreen(page);

  await menu.goto();
  await menu.combat.click();
  await mode.local.click();
  await maps.open();
  await maps.choose("forest");
  await expect(teams.mapName).toContainText("Forêt Dense");

  // Rouvrir, viser une autre carte, puis sortir par Échap : le choix retenu ne bouge pas. C'est le
  // geste qui distingue « regarder » de « changer », et que la télémétrie compte à part.
  await maps.open();
  await maps.item("volcano").click();
  await page.keyboard.press("Escape");
  await expect(maps.title).toBeHidden();
  await expect(teams.mapName).toContainText("Forêt Dense");
});

test("§6.3 « Aléatoire » montre son panneau de tirage, pas un aperçu vide", async ({ page }) => {
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);
  const maps = new MapSelectScreen(page);
  const teams = new TeamSelectScreen(page);

  await menu.goto();
  await menu.combat.click();
  await mode.local.click();
  await maps.open();
  await maps.item("random").click();

  // Un cadre vide se lit comme un écran cassé (retour humain 2026-08-06) : « Aléatoire » n'a aucun
  // terrain à montrer, donc il montre le dé.
  await expect(maps.randomPanel).toBeVisible();

  await maps.confirm.click();
  // Le bandeau annonce « Aléatoire » et NON la carte tirée : personne ne doit savoir sur quoi il
  // tombera pendant qu'il compose son équipe.
  await expect(teams.mapName).toContainText("Aléatoire");
});

/**
 * §6.3 — le panneau du tirage est **caché** dès qu'une vraie carte est visée.
 *
 * 🔴 Le seul des défauts de recette du plan 208 qui soit parfaitement gardable en DOM. `.ms-random`
 * se donne `display: flex` ; la feuille de l'agent utilisateur, elle, ne pose `[hidden] { display:
 * none }` qu'avec une spécificité qui PERD contre toute règle d'auteur. Le dé restait donc affiché
 * par-dessus l'aperçu Babylon quelle que soit la carte regardée — « la preview des cartes ne
 * s'affiche plus, j'ai toujours "Terrain tiré au lancement" » (recette humaine, 2026-09-11).
 *
 * `toBeHidden()` lit la visibilité CALCULÉE, donc il voit la règle gagnante — c'est exactement ce
 * qu'une assertion sur l'attribut `hidden` aurait manqué.
 */
test("§6.3 le panneau du tirage se cache sur une carte nommée et revient sur « Aléatoire »", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);
  const maps = new MapSelectScreen(page);

  await menu.goto();
  await menu.combat.click();
  await mode.local.click();
  await maps.open();

  // À l'ouverture, la carte courante est une vraie carte : l'aperçu doit être découvert.
  await expect(maps.randomPanel).toBeHidden();

  await maps.item("random").click();
  await expect(maps.randomPanel).toBeVisible();

  // LA ligne du correctif : viser une carte nommée redécouvre l'aperçu.
  await maps.item("volcano").click();
  await expect(maps.randomPanel).toBeHidden();

  // Et le dé revient — le panneau est bien basculé dans les deux sens, pas détruit une fois.
  await maps.item("random").click();
  await expect(maps.randomPanel).toBeVisible();
});

/**
 * §6.4 — changer de carte **ne détruit pas** la composition en cours.
 *
 * C'est le motif même du plan 208 : la carte est devenue une modale précisément pour qu'on puisse en
 * changer sans repartir de zéro. Le reste de la suite ne prouve que la survie de l'ÉCRAN ; ici on
 * prouve la survie de son CONTENU — le format retenu et l'équipe assignée.
 *
 * Le format est changé d'abord, exprès : `onFormatChange` rebâtit les camps, donc l'ordre inverse
 * effacerait l'équipe pour une raison qui n'a rien à voir avec la carte.
 */
test("§6.4 changer de carte garde le format retenu et l'équipe déjà assignée", async ({ page }) => {
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);
  const maps = new MapSelectScreen(page);
  const teams = new TeamSelectScreen(page);

  await seedSavedTeams(page, DUEL_TEAM_STORAGE);

  await menu.goto();
  await menu.combat.click();
  await mode.local.click();
  await expect(teams.title).toBeVisible();
  await expect(teams.mapName).toContainText("Arène Simple");

  // Un format AUTRE que le défaut : un écran remonté de zéro retomberait sur le premier segment,
  // donc un format inchangé ne dirait rien si on restait sur celui d'origine.
  const defaultFormat = await teams.activeFormatSegment.innerText();
  await expect(teams.formatSegmentButtons.nth(1)).toBeVisible();
  await teams.formatSegmentButtons.nth(1).click();
  const chosenFormat = await teams.activeFormatSegment.innerText();
  expect(chosenFormat).not.toBe(defaultFormat);

  await teams.pickSavedTeam(0, DUEL_ATTACKER_TEAM_ID);
  await expect(teams.teamButton(0)).toContainText("Duel — Alakazam");

  await maps.open();
  await maps.choose("volcano");
  await expect(teams.mapName).toContainText("Volcan Actif");

  // Le camp 1 porte TOUJOURS la même équipe : `data-state` vaut « saved » et non « empty », qui est
  // ce qu'un camp rebâti afficherait.
  await expect(teams.teamButton(0)).toHaveAttribute("data-state", "saved");
  await expect(teams.teamButton(0)).toContainText("Duel — Alakazam");
  // Et le format survit au changement de terrain, la nouvelle carte l'offrant aussi.
  await expect(teams.activeFormatSegment).toHaveText(chosenFormat);
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
  await maps.open();
  await maps.item("simple-arena").click();

  // De vraies pressions depuis la ligne voisine, jamais un `.focus()` sur la cible : c'est le
  // CHEMIN qui est en question (`.claude/rules/multi-input.md`).
  await page.keyboard.press("ArrowDown");

  // Le détail suit la sélection clavier, et l'entrée retenue porte `aria-current`.
  await expect(maps.detailName).toHaveText("Forêt Dense");
  await expect(maps.item("forest")).toHaveAttribute("aria-current", "true");

  // La liste BOUCLE, et « Aléatoire » la ferme depuis le 2026-09-13 : remonter d'un cran depuis la
  // première carte y atterrit. C'est ce qui garantit que le tirage reste atteignable aux flèches
  // sans traverser les neuf cartes.
  await maps.item("simple-arena").click();
  await page.keyboard.press("ArrowUp");
  await expect(maps.item("random")).toHaveAttribute("aria-current", "true");
});

test("§6.4 sélection d'équipe : sélecteur de format + contrôles présents", async ({ page }) => {
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);
  const teams = new TeamSelectScreen(page);
  await menu.goto();
  await menu.combat.click();
  await mode.local.click();
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
  const teams = new TeamSelectScreen(page);

  await menu.goto();
  await menu.combat.click();
  await mode.local.click();

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
  const teams = new TeamSelectScreen(page);

  await menu.goto();
  await menu.combat.click();
  await mode.local.click();
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
  const teams = new TeamSelectScreen(page);

  await menu.goto();
  await menu.combat.click();
  await mode.local.click();
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
