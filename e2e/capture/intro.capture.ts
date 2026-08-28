import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { PadButton, tapPadButton, withFakeGamepad } from "../pages/gamepad";
import { BeatRecorder, CAPTURE_DIR, resetCaptureDir } from "./beats";
import {
  actionMenuLabels,
  activeEnemyDistance,
  activePokemonId,
  activeSide,
  casterTile,
  configureSides,
  FastTurnOutcome,
  Instruction,
  instruction,
  isBattleOver,
  padAimAndConfirm,
  padBackToActionMenu,
  padFocusAction,
  padFocusMove,
  padMoveTowardEnemy,
  padPlayFastTurn,
  padRotateCamera,
  padZoomIn,
  settleTurn,
  sprites,
  type Tile,
  waitForActionMenu,
} from "./combat-pad";
import { EnglishScreens } from "./en-locators";
import {
  connectCapturePad,
  padActivate,
  padBack,
  padMove,
  padMoveTo,
  padMoveUntil,
  padReach,
  padSelectUntil,
} from "./pad-nav";
import { buildSideByPokemonId, CAPTURE_SIDE_1, seedCaptureTeams } from "./teams";

/** Nom de carte → nom de fichier de capture (accents et espaces sortis). */
function slugify(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/*
 * Séquence d'intro du jeu (plan 194) — bande-annonce et captures, en une passe reproductible.
 *
 * Ce n'est PAS un test : rien n'est asservi à une assertion de comportement. Les `expect` présents ne
 * servent qu'à attendre qu'un écran soit réellement monté avant de le filmer — filmer un écran à
 * moitié peint donnerait une image inutilisable.
 *
 * Reproductible par deux leviers :
 * - les équipes sont injectées dans `localStorage` (identiques à chaque run, horodatage figé)
 * - `?seed=` fixe le PRNG du combat, donc les mêmes dégâts, critiques et ratés
 *
 * Se lance par `pnpm capture:intro`, jamais dans le gate — voir `playwright.capture.config.ts`.
 */

/** Seed du combat filmé. Le changer change la séquence : à figer une fois qu'un run plaît. */
const BATTLE_SEED = 424242;

/*
 * La sélection de carte fait DÉFILER la variété avant de se poser, plutôt que de montrer une seule
 * arène : on descend sur les deux cartes suivantes, puis on remonte sur « Arène Simple » pour jouer.
 *
 * Arbitrage de l'humain : Arène Simple est la carte la plus LISIBLE, donc la bonne pour montrer les
 * mécaniques en combat — mais la montrer seule ne dirait rien de la variété des terrains.
 */
const BROWSED_MAPS = ["Forest", "Cramped Cave"] as const;
const BATTLE_MAP = "Simple Arena";

/** Ce que la séquence CHANGE sous l'œil du spectateur, dans l'éditeur d'équipe. */
const SWAPPED_IN = "Mewtwo";
/** Libellé de la carte du 1ᵉʳ slot : nom + types concaténés, tel que le DOM le rend. */
const FIRST_SLOT_LABEL = "CharizardFireFlying";
const SWAPPED_ITEM = "Expert Belt";
/*
 * Attaque vérifiée APPRENABLE PAR MEWTWO et implémentée. « Dragon Pulse » valait pour Dracaufeu :
 * sur Mewtwo la recherche ne renvoyait rien, la liste était vide, et la navigation butait sur le
 * dernier filtre sans candidat en dessous — c'est ce qui bloquait, pas la navigation elle-même.
 */
const SWAPPED_MOVE = "Aura Sphere";

/*
 * Les formats défilent avant de revenir au 2J × 6 : c'est ce qui dit « ça ne joue pas qu'en duel ».
 * Libellés produits par `formatLabel()` — `${teamCount}J × ${maxPokemonPerTeam}`.
 */
/** Libellés des deux formats montrés — servent à VÉRIFIER lequel est actif, pas à viser un segment. */
const MAX_FORMAT_LABEL = "12J × 1";
const BATTLE_FORMAT_LABEL = "2J × 6";

test("séquence d'intro", async ({ page }) => {
  await resetCaptureDir();
  // La langue de l'app suit `pt-lang`, pas seulement la locale du navigateur — les deux sont posées.
  await page.addInitScript(() => localStorage.setItem("pt-lang", "en"));
  await seedCaptureTeams(page);
  const recorder = new BeatRecorder(page, Date.now());

  /*
   * Cibles de focus lues sur les ATTRIBUTS de l'élément focalisé, et non sur son texte.
   *
   * Le texte ne suffit pas dans une liste ni dans une colonne de cartes : la signature de focus
   * embarque le contenu du parent et du grand-parent, qui contient celui de tous les frères. Deux
   * assignations se sont faites sur la mauvaise ligne avant qu'on lise les attributs.
   */
  const focusedAttributes = (attributes: Record<string, string>): (() => Promise<boolean>) => {
    return () =>
      page.evaluate((expected) => {
        const active = document.activeElement as HTMLElement | null;
        if (!active) {
          return false;
        }
        return Object.entries(expected).every(([key, value]) => active.dataset[key] === value);
      }, attributes);
  };

  // ---------------------------------------------------------------- 1. L'éditeur d'équipe
  const ui = new EnglishScreens(page);
  /*
   * La manette synthétique s'installe AVANT le premier `goto` : `withFakeGamepad` passe par
   * `addInitScript`, qui ne s'applique qu'à la navigation suivante. Installée après, la manette n'existe
   * simplement pas — la croix reste sans effet et `holdPadUntil` échoue au bout de ses 60 frames.
   */
  await withFakeGamepad(page);
  /*
   * Le seed voyage dans l'URL du BOOT, et pas seulement au moment du combat : `forcedBattleSeed()`
   * relit `window.location.search` quand l'écran de combat se monte, et l'application ne réécrit
   * jamais son URL (les écrans sont internes). Poser `?seed=` ici suffit donc pour tout le parcours.
   *
   * `MainMenu.goto()` n'est pas réutilisable : il navigue vers « / » nu, donc sans seed — et ses
   * libellés sont français. Seule son attente de splash est reprise.
   */
  await page.goto(`/?seed=${BATTLE_SEED}`);
  await page.getByTestId("splash").waitFor({ state: "detached" });
  await expect(ui.battle).toBeVisible();
  await connectCapturePad(page);
  await recorder.holdForPacing(900);
  await recorder.capture("menu-principal", "Pokémon Tactics");

  /*
   * Navigation à la manette : le liseré descend d'entrée en entrée, visible à l'image.
   *
   * Le premier cran atterrit sur « Combat » et non sur « Aventure » — mesuré via `focus-trace.txt`,
   * pas supposé. Deux crans suffisent donc pour « Constructeur d'équipe ». Cette trace est écrite à
   * chaque run : si une entrée de menu est ajoutée, elle dira immédiatement où le focus atterrit.
   */
  await padMoveTo(page, "down", "Battle");
  await recorder.holdForPacing(600);
  await recorder.capture("focus-combat", "Play with a controller");
  await padMoveTo(page, "down", "Team Builder");
  await recorder.holdForPacing(700);
  await recorder.capture("focus-constructeur");

  await padActivate(page, () => ui.teamCard("Blaze & Psy").isVisible());
  await expect(ui.teamCard("Blaze & Psy")).toBeVisible();
  await recorder.holdForPacing(900);
  await recorder.capture("mes-equipes", "Build your team");

  // Ouvrir un build déjà peuplé : on MONTRE la fiche, on ne la remplit pas.
  await padMoveTo(page, "down", "Edit|Blaze & Psy");
  await recorder.holdForPacing(800);
  await recorder.capture("focus-equipe");
  await padActivate(page, () => ui.filledSlot("Charizard").isVisible());
  await recorder.holdForPacing(900);
  await recorder.capture("equipe-6v6", "Six Pokémon, four moves each");

  /*
   * La fiche d'un Pokemon : son modèle, ses attaques, son objet, son talent. Montrée VITE — s'attarder
   * dessus casse le rythme (retour humain 2026-08-28), l'écran suivant est plus intéressant.
   */
  await padMoveTo(page, "right", FIRST_SLOT_LABEL);
  await recorder.capture("focus-slot");
  await padActivate(page, () => ui.pokemonName.isVisible());
  await expect(ui.moveRows.first()).toBeVisible();
  await recorder.holdForPacing(900);
  await recorder.capture("fiche-pokemon", "Ability, held item, nature");

  // --- On CHANGE des choses : une vitrine doit montrer qu'on manipule, pas qu'on contemple.

  /*
   * 1. On CHOISIT un Pokemon : le 6ᵉ slot est vide (l'équipe est semée à cinq), on le remplit.
   *
   * Ouvrir un slot vide donne directement la grille des 151 Pokemon — plus lisible que « vider puis
   * remettre », et ça évite le bouton « × », qui ne s'active pas au dpad.
   *
   * D'abord le choisir, ENSUITE l'équiper — l'ordre dans lequel on construit vraiment un Pokemon.
   */
  await padMoveTo(page, "right", "team-slot-card|Slot 6", 16);
  await recorder.holdForPacing(400);
  await recorder.capture("focus-empty-slot", "Complete your team");
  await padActivate(page, () => ui.pokemonCells.first().isVisible());
  await recorder.holdForPacing(1300);
  await recorder.capture("pokemon-picker", "151 first-generation Pokémon");

  await ui.dialogSearch.pressSequentially(SWAPPED_IN, { delay: 90 });
  await recorder.holdForPacing(900);
  await recorder.capture("pokemon-search", "Search and filter");
  await padMoveTo(page, "down", `pokemon-cell|${SWAPPED_IN}`, 6);
  await recorder.holdForPacing(700);
  await padActivate(page, () => ui.filledSlot(SWAPPED_IN).isVisible());
  await recorder.holdForPacing(1300);
  await recorder.capture("pokemon-added", `${SWAPPED_IN} joins the team`);

  /*
   * Rejoindre le panneau de gauche, où vivent l'objet et les attaques.
   *
   * La navigation du jeu est SPATIALE (`focusInDirection`) : elle prend le contrôle le plus proche
   * dans la direction pressée, avec une pénalité ×2 hors axe, et ne boucle pas. La carte du 6ᵉ slot
   * étant à DROITE de l'écran, « bas » y trouve la colonne des statistiques — pas l'objet, qui est à
   * gauche. On longe donc la rangée vers la gauche SANS valider (déplacer le focus ne change pas le
   * Pokemon actif, seul `A` le ferait), puis on descend depuis le premier slot.
   */
  // Libellé EXACT de la carte, pas « team-slot-card|Charizard » : le contexte d'une carte contient le
  // texte de toute la rangée (grand-parent), donc ce filtre matchait n'importe quelle carte — le focus
  // ne bougeait jamais.
  await padMoveTo(page, "left", FIRST_SLOT_LABEL, 20);
  await recorder.holdForPacing(500);

  /*
   * 2. On lui donne un objet.
   *
   * « bas » depuis la première carte de la rangée descend dans le panneau d'édition, où vivent l'objet
   * et les attaques — c'est le chemin qui marche, mesuré. Descendre depuis la carte du slot qu'on vient
   * de remplir, lui, part dans la colonne des statistiques.
   */
  await padMoveTo(page, "down", "pokemon-edit-item-value", 12);
  await recorder.holdForPacing(800);
  await recorder.capture("focus-objet");
  await padActivate(page, () => ui.dialog.isVisible());
  await recorder.holdForPacing(1300);
  await recorder.capture("choix-objet", "A held item changes everything");

  /*
   * La recherche plutôt que 30 crans de dpad : la liste d'objets est alphabétique et longue
   * (« Ceinture Pro » arrive après toutes les baies). Descendre jusque-là serait interminable à
   * l'image — et taper montre au passage que la recherche existe.
   *
   * `pressSequentially` et non `fill` : on veut voir les lettres s'écrire.
   */
  await ui.dialogSearch.pressSequentially("Expert", { delay: 90 });
  await recorder.holdForPacing(700);
  await recorder.capture("recherche-objet", "Every held item in the game");

  await padMoveTo(page, "down", `item-picker-row|${SWAPPED_ITEM}`, 12);
  await recorder.holdForPacing(900);
  await padActivate(page, async () => !(await ui.dialog.isVisible()));
  await recorder.holdForPacing(1100);
  await recorder.capture("objet-change", SWAPPED_ITEM);

  // 3. Et une attaque.
  await padMoveTo(page, "down", "pokemon-edit-move-row", 30);
  await recorder.holdForPacing(800);
  await recorder.capture("focus-attaque");
  await padActivate(page, () => ui.dialog.isVisible());
  await recorder.holdForPacing(1400);
  await recorder.capture("choix-attaque", "Four moves to pick");

  await ui.dialogSearch.pressSequentially("Aura", { delay: 90 });
  await recorder.holdForPacing(700);
  await recorder.capture("recherche-attaque");

  await padMoveTo(page, "down", `|${SWAPPED_MOVE}`, 12);
  await recorder.holdForPacing(900);
  await padActivate(page, async () => !(await ui.dialog.isVisible()));
  await recorder.holdForPacing(1200);
  await recorder.capture("attaque-changee", SWAPPED_MOVE);

  /*
   * 4. Le build — APPLIQUÉ, pas seulement montré (retour humain 2026-08-28 : « j'aimerais vraiment que
   *    tu choisisses un build à la fin »).
   *
   * Le Pokemon qui vient d'être ajouté arrive à 0/66 : les six curseurs et le budget sont à l'écran.
   * On applique ensuite le preset « Spec Sweeper », qui convient à Mewtwo, et les barres bougent à
   * l'image — c'est ça qui dit ce qu'est un build.
   *
   * La rangée de presets EST atteignable à la manette : depuis la colonne des statistiques, « bas »
   * y descend. Un ancien constat disait le contraire (« l'anneau de focus n'y mène pas ») ; il portait
   * en fait sur la sortie de cette rangée, pas sur son accès.
   */
  await expect(ui.statRows.first()).toBeVisible();
  await recorder.holdForPacing(1200);
  await recorder.capture("build-stats", "Spend your stat points");

  /*
   * En deux temps : « bas » descend jusqu'à la RANGÉE de builds (elle est atteignable, contrairement à
   * ce qu'un ancien constat affirmait), puis « droite » la parcourt — la rangée est horizontale, donc
   * insister vers le bas n'y déplace plus rien.
   */
  await padMoveUntil(
    page,
    "down",
    "rangée des builds",
    focusedAttributes({ testid: "pokemon-edit-preset" }),
    16,
  );
  await padMoveUntil(
    page,
    "right",
    "preset:spec-sweeper",
    focusedAttributes({ testid: "pokemon-edit-preset", presetId: "spec-sweeper" }),
    5,
  );
  await recorder.holdForPacing(700);
  await recorder.capture("focus-build");
  /*
   * L'effet se lit sur le CURSEUR de points, pas sur la valeur de statistique affichée : celle-ci est
   * la stat calculée (base + nature + points), donc « 32 » n'y apparaît pas. Le preset « Spec Sweeper »
   * met 32 points en Attaque Spéciale — c'est ce que dit le curseur.
   */
  await padActivate(
    page,
    async () =>
      (await page
        .locator('[data-testid="pokemon-edit-sp-slider"][data-stat="spAttack"]')
        .inputValue()) === "32",
  );
  await recorder.holdForPacing(1600);
  await recorder.capture("build-applique", "A build in one press");

  // ---------------------------------------------------------------- 2. Lancer le combat
  // Retour : B remonte d'un écran, comme la manette le fait vraiment.
  await padBack(page, () => ui.teamCard("Blaze & Psy").isVisible());
  await recorder.holdForPacing(600);
  await padBack(page, () => ui.battle.isVisible());
  await recorder.holdForPacing(700);

  await padMoveTo(page, "up", "Battle");
  await recorder.holdForPacing(600);
  await padActivate(page, () => ui.local.isVisible());
  await recorder.holdForPacing(900);
  await recorder.capture("mode-combat", "Turn-based tactical battles");

  await padMoveTo(page, "down", "Local");
  await recorder.holdForPacing(700);
  await padActivate(page, () => ui.confirmMap.isVisible());
  await recorder.holdForPacing(900);
  await recorder.capture("choix-carte", "Nine arenas, each with its own terrain");

  /*
   * Un cran vers le bas, puis un autre, lentement — chaque arrêt recharge l'aperçu 3D, donc chaque
   * arrêt est un plan. Deux cartes suffisent à dire la variété ; en parcourir neuf serait long et
   * répétitif à l'image.
   */
  for (const mapName of BROWSED_MAPS) {
    await padSelectUntil(
      page,
      "down",
      async () => (await ui.mapDetailName.textContent())?.includes(mapName) === true,
      3,
    );
    await recorder.holdForPacing(1500);
    await recorder.capture(`map-${slugify(mapName)}`);
  }

  // …puis on remonte sur la première, la plus lisible, celle où le combat se lira le mieux.
  await padSelectUntil(
    page,
    "up",
    async () => (await ui.mapDetailName.textContent())?.includes(BATTLE_MAP) === true,
    4,
  );
  await recorder.holdForPacing(1000);
  await recorder.capture("carte-retenue", "An arena to learn on");

  /*
   * Pas de navigation vers « Choisir cette carte » : sur cet écran, `A` sans bouton focalisé appelle
   * directement `confirmSelection()` (le consommateur de l'écran le dit explicitement). Chercher le
   * bouton au dpad serait impossible — le focus DOM n'y bouge jamais.
   */
  await recorder.holdForPacing(600);
  await padActivate(page, () => ui.launch.isVisible());
  await expect(ui.launch).toBeVisible();
  await recorder.holdForPacing(900);
  await recorder.capture("selection-equipe", "Set up both sides");

  /*
   * Un seul aller-retour : on pousse jusqu'au format le plus spectaculaire (douze camps), puis on
   * revient à celui du combat.
   *
   * Le retour se fait par la GAUCHE, et c'est nouveau : le liseré restait jusqu'ici sur la rangée de
   * formats seulement par accident, parce que changer de format le renvoyait sur « ◀ Retour » à
   * l'autre bout de l'écran. Ce défaut est corrigé (le `data-testid` manquant du sélecteur de format,
   * signalé comme un bug visuel par l'humain le 2026-08-28), donc le focus reste où il est et le
   * mouvement se lit enfin comme un aller-retour.
   */
  const activeFormatIs = (label: string) => () =>
    ui.formatSegments
      .locator('[data-state="active"]')
      .evaluate((node, expected) => node.textContent?.trim() === expected, label)
      .catch(() => false);
  /*
   * On COMPTE les segments lus dans le DOM au lieu de viser un segment par sa valeur.
   *
   * Viser le libellé (« 12J × 1 ») a échoué, viser `data-format-key` (« 12v1 ») aussi, sans qu'aucun
   * des deux ne dise pourquoi — et chaque essai coûtait un run de cinq minutes. Le nombre de segments,
   * lui, se lit sans ambiguïté, et l'index du segment focalisé aussi : « aller au dernier » devient
   * « presser droite (total − index − 1) fois ». Rien à deviner, et ça reste vrai si la carte change
   * de liste de formats.
   */
  const segments = ui.formatSegments.locator('[data-testid="format-segment"]');
  await padMoveUntil(
    page,
    "right",
    "la rangée des formats",
    focusedAttributes({ testid: "format-segment" }),
    6,
  );
  const focusedFormatIndex = (): Promise<number> =>
    page.evaluate(() => {
      const row = document.querySelector('[data-testid="format-segments"]');
      const all = [...(row?.querySelectorAll('[data-testid="format-segment"]') ?? [])];
      return all.indexOf(document.activeElement as Element);
    });
  const segmentCount = await segments.count();
  for (let step = (await focusedFormatIndex()) + 1; step < segmentCount; step++) {
    await padMove(page, "right");
  }
  await recorder.capture("focus-format-max");
  await padActivate(page, activeFormatIs(MAX_FORMAT_LABEL));
  await recorder.holdForPacing(1200);
  await recorder.capture("format-max", "Up to twelve players");

  for (let step = await focusedFormatIndex(); step > 0; step--) {
    await padMove(page, "left");
  }
  await padActivate(page, activeFormatIs(BATTLE_FORMAT_LABEL));
  await recorder.holdForPacing(1100);
  await recorder.capture("format-retenu", "Six versus six");

  // La modale de choix d'équipe, tenue assez longtemps pour être lue.
  /*
   * Depuis la rangée des formats, on descend vers la carte du camp 1.
   *
   * `padReach` essaie plusieurs directions parce que le chemin a changé : tant que le sélecteur de
   * format perdait le focus, on y arrivait par la droite depuis « ◀ Retour ». Le focus restant
   * désormais dans la rangée, « droite » n'en sort plus du tout.
   */
  await padReach(
    page,
    "carte du camp 1",
    focusedAttributes({ testid: "player-team-button", slotIndex: "0" }),
    ["down", "left", "right"],
  );
  await recorder.holdForPacing(500);
  await recorder.capture("focus-camp");
  await padActivate(page, () => page.getByRole("dialog").isVisible());
  await recorder.holdForPacing(1300);
  await recorder.capture("modale-equipe", "Your saved teams");

  await padMoveUntil(
    page,
    "down",
    "team-row:Blaze & Psy",
    focusedAttributes({ testid: "team-row", teamId: "capture-flammes-psy" }),
  );
  await recorder.holdForPacing(800);
  await padActivate(page, async () => !(await page.getByRole("dialog").isVisible()));
  await recorder.holdForPacing(900);
  await recorder.capture("equipe-assignee");

  /*
   * ---------------------------------------------------------------- 3. Deux camps FIXES
   *
   * Le camp 2 passe à « Humain », et on lui assigne une équipe SAUVEGARDÉE.
   *
   * Pas un détail de mise en scène : un camp laissé à l'IA se voit attribuer une équipe TIRÉE AU
   * HASARD (`buildInitialSlots` → `generateRandomTeam`), que le seed d'URL n'atteint pas — il n'alimente
   * que le moteur de combat. La séquence donnerait donc un adversaire différent à chaque run, et les
   * captures ne seraient plus reproductibles. Deux camps humains, c'est aussi le scénario joueur
   * contre joueur que la recette réclamait.
   */
  const player2Human = page
    .locator('[data-testid="player-controller"][data-slot-index="1"][data-controller="human"]')
    .and(page.locator('[data-state="active"]'));
  const player2Empty = page.locator(
    '[data-testid="player-team-button"][data-slot-index="1"][data-state="empty"]',
  );
  /*
   * En TROIS temps, et pas un de moins — mesuré dans `focus-trace.txt`, pas supposé.
   *
   * « bas » depuis le bouton d'équipe du camp 1 ne s'arrête PAS sur la rangée Humain / IA du camp 2 :
   * il file droit sur son bouton d'équipe. La navigation est spatiale et pénalise l'écart hors axe
   * (×2), or les deux segments sont des demi-largeurs décentrées alors que le bouton d'équipe est
   * pleine largeur, donc centré — c'est lui qui gagne. On y va, puis on rejoint la rangée
   * horizontalement (« droite » atteint 🤖 IA), et « gauche » se pose sur 🎮 Humain.
   */
  await padMoveUntil(
    page,
    "down",
    "player-team-button:slot 1",
    focusedAttributes({ testid: "player-team-button", slotIndex: "1" }),
    4,
  );
  await padMoveUntil(
    page,
    "right",
    "player-controller:slot 1",
    focusedAttributes({ testid: "player-controller", slotIndex: "1" }),
    4,
  );
  await padMoveUntil(
    page,
    "left",
    "player-controller:slot 1 human",
    focusedAttributes({ testid: "player-controller", slotIndex: "1", controller: "human" }),
    4,
  );
  await recorder.holdForPacing(500);
  await recorder.capture("focus-joueur2", "Two players, one screen");
  await padActivate(page, () => player2Human.isVisible());
  await recorder.holdForPacing(600);
  await recorder.capture("joueur2-humain");

  // « droite » et non « bas » : depuis un segment de contrôle, le bouton d'équipe de la même carte
  // est à droite dans l'ordre spatial — « bas » sortirait de la carte.
  await padMoveUntil(
    page,
    "right",
    "player-team-button:slot 1",
    focusedAttributes({ testid: "player-team-button", slotIndex: "1" }),
    4,
  );
  await recorder.holdForPacing(600);
  await padActivate(page, () => page.getByRole("dialog").isVisible());
  await recorder.holdForPacing(1100);
  await recorder.capture("modale-equipe-2", "Pick the opposing team");
  await padMoveUntil(
    page,
    "down",
    "team-row:Fangs & Fists",
    focusedAttributes({ testid: "team-row", teamId: "capture-crocs-poings" }),
    8,
  );
  await recorder.holdForPacing(700);
  await padActivate(page, async () => !(await page.getByRole("dialog").isVisible()));
  await expect(player2Empty).toHaveCount(0);
  await recorder.holdForPacing(1000);
  await recorder.capture("camps-prets", "Blaze & Psy versus Fangs & Fists");

  // ---------------------------------------------------------------- 4. Le combat
  await padMoveTo(page, "down", "Start ▶", 10);
  await recorder.holdForPacing(700);
  await recorder.capture("focus-lancer");
  /*
   * Le signal « le combat a démarré » est le MENU D'ACTIONS, pas la scène.
   *
   * `__ptE2e__.isReady()` ne vaut rien ici : l'écran de choix de carte construit son aperçu 3D avec
   * `createCombatScene`, donc le hook est déjà installé et répond `true` — et il y SURVIT, car
   * `dispose()` ne le retire pas. La première version de cette étape voyait donc « scène prête »
   * sans avoir lancé quoi que ce soit : A n'était jamais pressé, et la capture suivante montrait
   * encore l'écran de sélection d'équipe.
   */
  /*
   * Qui est de quel camp : la capture le DIT au pilote, elle ne le laisse pas deviner. `spriteStates()`
   * ne renvoie que des identifiants de définition (« snorlax »), sans camp — voir `configureSides`.
   * Mewtwo est ajouté au camp 1 pendant la séquence, donc il ne vient pas du roster figé.
   */
  configureSides(buildSideByPokemonId([SWAPPED_IN.toLowerCase()]));
  await padActivate(page, async () => (await ui.launch.count()) === 0);
  // Le placement est AUTOMATIQUE (case cochée par défaut) : les douze Pokemon se posent seuls dans
  // leurs zones de départ, et on entre droit dans le premier tour.
  await waitForActionMenu(page);
  await recorder.holdForPacing(1000);
  /*
   * Un cran de zoom, gardé pour tout le combat : le zoom par défaut est « Moyen », calé pour jouer, et
   * il laisse un grand vide autour du plateau — invisible manette en main, criant sur une image de
   * 1920×1080. Vu sur la première capture de combat, pas déduit.
   */
  await padZoomIn(page);
  await recorder.holdForPacing(800);

  /*
   * ---------------------------------------------------------------- 5. Le combat : UN tour
   *
   * Périmètre posé par l'humain (2026-08-28) : « un déplacement, une attaque, une rotation de caméra,
   * une fin de tour et ça va très bien », dans un combat DÉJÀ ENGAGÉ, et **sans montrer le tour de
   * l'adversaire**.
   *
   * Tout tient donc dans un seul tour du camp 1 — c'est ce qui garantit qu'aucun tour adverse ne s'y
   * glisse. Les tours qui amènent les camps au contact, eux, sont joués **sans être filmés** : ils
   * démarrent aux deux bouts du plateau, une quinzaine de cases, quand une attaque porte à quatre.
   */
  const TURN_BUDGET = 40;

  /**
   * Joue des tours SANS rien filmer, jusqu'à ce que la situation voulue se présente.
   *
   * `optional` sert au repli : on cherche d'abord le tour IDÉAL (le lanceur qu'on préfère), et si le
   * budget s'épuise on se contente du premier tour jouable, au lieu de faire échouer tout le montage.
   */
  const advanceUntil = async (
    what: string,
    ready: () => Promise<boolean>,
    options: { budget?: number; optional?: boolean } = {},
  ): Promise<boolean> => {
    const budget = options.budget ?? TURN_BUDGET;
    for (let turn = 0; turn < budget; turn++) {
      await waitForActionMenu(page);
      if (await ready()) {
        return true;
      }
      if ((await padPlayFastTurn(page)) === FastTurnOutcome.Over) {
        throw new Error(`le combat s'est terminé avant « ${what} »`);
      }
    }
    if (options.optional === true) {
      return false;
    }
    throw new Error(`« ${what} » jamais atteint en ${budget} tours`);
  };

  /*
   * Le tour filmé se choisit sur une FOURCHETTE de distance, pas sur « à portée ».
   *
   * À une case de l'adversaire, le déplacement dure deux images et se lit comme une téléportation
   * (retour humain 2026-08-28 : « il se téléporte là »). Trop loin, l'attaque du même tour n'a plus
   * personne à viser. Entre quatre et huit cases, le Pokemon marche pendant une seconde et reste à
   * portée après s'être avancé.
   */
  const WALKABLE_MIN = 4;
  const WALKABLE_MAX = 8;
  const filmableTurn = async (pokemonId?: string): Promise<boolean> => {
    if ((await activeSide(page)) !== CAPTURE_SIDE_1) {
      return false;
    }
    if (pokemonId !== undefined && (await activePokemonId(page)) !== pokemonId) {
      return false;
    }
    if (!(await actionMenuLabels(page)).includes("Move")) {
      return false;
    }
    const distance = await activeEnemyDistance(page);
    return distance !== null && distance >= WALKABLE_MIN && distance <= WALKABLE_MAX;
  };
  /*
   * On PRÉFÈRE un lanceur, on ne l'impose pas.
   *
   * Le tour filmé n'est pas écrit : il est sélectionné par des conditions, donc changer une condition
   * change le Pokemon, l'attaque, et tout le combat qui suit — c'est ce qui a fait passer la séquence
   * de Mewtwo / Ball'Aura à Alakazam / Psykokinésie entre deux versions, à seed identique (retour humain
   * 2026-08-28 : « pourquoi t'as changé complètement le combat »). Nommer le lanceur rend la
   * bande-annonce stable d'un run à l'autre ; le repli évite qu'un tour qui ne se présente pas fasse
   * échouer tout le montage.
   */
  const PREFERRED_CASTER = SWAPPED_IN.toLowerCase();
  const foundPreferred = await advanceUntil(
    `un tour de ${SWAPPED_IN}, à distance de marche`,
    () => filmableTurn(PREFERRED_CASTER),
    { budget: 24, optional: true },
  );
  if (!foundPreferred) {
    await advanceUntil("un tour de notre camp, à distance de marche", () => filmableTurn());
  }

  await recorder.holdForPacing(1400);
  await recorder.capture("combat", "");

  /*
   * 1. La caméra : un quart de tour, la signature visuelle qu'aucune capture statique ne rend.
   *
   * Dans CE sens (−1) : l'autre plaçait Léviator devant Mewtwo et cachait le Pokemon qui joue (retour
   * humain 2026-08-28). Le sens de rotation est donc un choix de cadrage, pas un détail.
   */
  await padRotateCamera(page, -1);
  await recorder.holdForPacing(1500);
  await recorder.capture("rotation-camera", "");

  // 2. Le déplacement : le menu, les cases accessibles, le glissé.
  await padFocusAction(page, "Move");
  await recorder.holdForPacing(900);
  await recorder.capture("menu-actions", "");
  await padActivate(page, async () => (await instruction(page)) === Instruction.selectDestination);
  await recorder.holdForPacing(1000);
  await recorder.capture("cases-accessibles", "");
  // Portée large : on veut atterrir AU CONTACT, sinon l'attaque du même tour n'aura personne à viser.
  /*
   * Le repère englobe TOUT le déplacement : la validation de la case, le glissé, et la pause qui suit.
   *
   * Sans lui, le beat n'aurait porté que sa pause de cadence — or `padMoveTowardEnemy` attend le retour
   * du menu d'actions, donc la fin du glissé, avant de rendre la main. Le montage ne gardait alors que
   * l'après, et le Pokemon paraissait se téléporter.
   */
  recorder.mark();
  if (!(await padMoveTowardEnemy(page, 6))) {
    throw new Error("aucune destination acceptée pour le déplacement filmé");
  }
  await recorder.holdForPacing(1200);
  await recorder.capture("deplacement", "", { sinceMark: true });

  // 3. L'attaque, dans le MÊME tour : se déplacer ne consomme pas l'action (vérifié par sonde).
  const moveTooltip = page.getByTestId("move-tooltip");
  let chosenMove = "";
  let hit: Tile | null = null;
  /*
   * On essaie les attaques utilisables l'une après l'autre.
   *
   * « Utilisable » (`data-enabled`) veut dire que le jeu a trouvé au moins une cible — pas forcément
   * un ADVERSAIRE : une attaque qui ne porte que sur un allié compte comme utilisable, et la visée
   * échouait alors après avoir déjà pris ses captures (mesuré avec Ball'Aura).
   */
  for (let attempt = 0; attempt < 4 && hit === null; attempt++) {
    await waitForActionMenu(page);
    await padFocusAction(page, "Attack");
    await recorder.holdForPacing(400);
    await padActivate(page, () => moveTooltip.isVisible());
    chosenMove = await padFocusMove(page, undefined, 12, attempt);
    await expect(moveTooltip).toBeVisible();
    // 1,4 s et non 2,2 : l'infobulle doit se lire, pas s'installer (retour humain 2026-08-28, « trop
    // mou »). Les valeurs restent lisibles à l'arrêt sur image, et la capture du beat les garde.
    await recorder.holdForPacing(1400);
    await recorder.capture("infobulle-attaque", "");

    await padActivate(page, async () => (await instruction(page)) !== null);
    const caster = await casterTile(page);
    hit = await padAimAndConfirm(page, caster);
    if (hit === null) {
      await padBackToActionMenu(page);
    }
  }
  if (hit === null) {
    throw new Error("aucune attaque du Pokemon filmé ne pouvait viser un adversaire");
  }
  await recorder.holdForPacing(1000);
  await recorder.capture("visee", "");
  await expect.poll(() => instruction(page)).toBe(Instruction.confirm);
  await recorder.holdForPacing(2400);
  await recorder.capture("prevision-degats", "");

  await tapPadButton(page, PadButton.A);
  // La capture tombe volontairement DANS l'animation : étiquettes de dégâts, barre de PV qui tombe.
  await recorder.holdForPacing(700);
  await recorder.capture("impact", "");
  await settleTurn(page);
  await recorder.holdForPacing(1300);
  await recorder.capture("apres-impact", "");

  /*
   * 4. La fin de tour : « Attendre » et son choix d'orientation.
   *
   * C'est la seule étape du jeu qui demande une orientation — un déplacement, lui, part directement
   * (mesuré par sonde). Elle clôt le tour, et la séquence s'arrête là.
   */
  await advanceUntil(
    "un tour de notre camp à clore",
    async () =>
      (await activeSide(page)) === CAPTURE_SIDE_1 &&
      (await actionMenuLabels(page)).includes("Wait"),
  );
  await padFocusAction(page, "Wait");
  await recorder.holdForPacing(900);
  await padActivate(page, async () => (await instruction(page)) === Instruction.selectFacing);
  await recorder.holdForPacing(1600);
  await recorder.capture("fin-de-tour", "");
  await tapPadButton(page, PadButton.A);
  await settleTurn(page);
  await recorder.holdForPacing(1400);
  await recorder.capture("tour-suivant", "");

  const outcome = {
    battleOver: await isBattleOver(page),
    spritesLeft: (await sprites(page)).length,
    filmedMove: chosenMove,
  };

  await writeFile(
    join(CAPTURE_DIR, "beats.json"),
    JSON.stringify({ seed: BATTLE_SEED, outcome, beats: recorder.manifest() }, null, 2),
    "utf8",
  );
});
