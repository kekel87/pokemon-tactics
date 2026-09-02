import {
  type BattleEvent,
  BattleEventType,
  type BattleState,
  createPrng,
  Direction,
  EASY_PROFILE,
  HARD_PROFILE,
  type MapDefinition,
  MEDIUM_PROFILE,
  PlayerController,
  PlayerId,
} from "@pokemon-tactic/core";
import { getMoveName, getPokemonName } from "@pokemon-tactic/data";
import type {
  CombatPokemonHandle,
  CombatScene,
  FieldTerrainSpec,
  PresentationContext,
} from "@pokemon-tactic/render-ports";
import type { ChromeInsetProbe, GameStage, UiDomConfig } from "@pokemon-tactic/ui-dom";
import {
  createBattleChrome,
  createBattleLog,
  createBattleLogRow,
  createChromeInsetProbe,
  createCombatMenuButton,
  createFullscreenButton,
  createKeyHint,
  mountGameStage,
  withKeyHint,
} from "@pokemon-tactic/ui-dom";
import {
  AiTeamController,
  type BattleFeedback,
  BattleOrchestrator,
  type BattleSetupResult,
  createFloatingTextSpawner,
  createSandboxBattle,
  DummyAiController,
  type InputContext,
  loadTiledMap,
  preloadCombatSprites,
  sandboxInstanceId,
} from "@pokemon-tactic/view-core";
import {
  beginBattleTelemetry,
  endBattleTelemetry,
  observeBattleTelemetry,
} from "../analytics/battle-telemetry-session.js";
import { type BattleResumeSave, battleResumeStore } from "../app/battle-persistence.js";
import type { Navigate, Screen } from "../app/screen-manager.js";
import type { CombatSetup, ScreenParamsById } from "../app/screens.js";
import { forcedBattleSeed } from "../capture-seed";
import {
  FIELD_TERRAIN_COLOR_ELECTRIC,
  FIELD_TERRAIN_COLOR_GRASSY,
  getTeamColorByPlayerId,
} from "../constants.js";
import { HighlightKind } from "../enums/highlight-kind.js";
import { getLanguage, t } from "../i18n/index.js";
import type { TranslationKey } from "../i18n/types.js";
import {
  activateFocusedControl,
  focusInDirection,
  isModalOpen,
} from "../input/focus-navigation.js";
import { InputSource } from "../input/input-source.js";
import { getInputSystem } from "../input/input-system.js";
import { cameraKeyLabels, combatMenuKeyHint, keyHintOf } from "../input/key-legend.js";
import { LogicalAction } from "../input/logical-action.js";
import { attachPointerSource, type PointerSource } from "../input/pointer-source.js";
import {
  isFullscreen,
  isFullscreenSupported,
  onFullscreenChange,
  toggleFullscreen,
} from "../platform/fullscreen.js";
import type { RendererBackend } from "../renderer-backend.js";
import { initSandboxStudioDom } from "../sandbox-boot.js";
import { getSettings } from "../settings/index.js";
import {
  getCategoryIconUrl,
  getCursorSheetUrl,
  getInputPromptSheetUrl,
  getStatusIconUrl,
  getStatusLabelUrl,
  getTypeIconUrl,
  getWeatherIconUrl,
} from "../team/asset-paths.js";
import { getItemIconUrl, getPortraitUrl } from "../team/team-builder-data.js";
import type { AiProfileKey, SandboxConfig } from "../types/SandboxConfig.js";
import { createCombatMenu } from "../ui/dom/combat-menu.js";
import { type LoadingOverlayHandle, showLoadingOverlay } from "../ui/LoadingOverlay.js";
import { SandboxPanel } from "../ui/SandboxPanel.js";
import { type BattleInputs, buildBattle, resumeBattle } from "./battle-resume.js";
import { type PlacementFlow, type PlacementResult, startPlacementFlow } from "./placement-flow.js";

// confirmAttack defaults to true (plan 123 4d-3): a target click locks the
// target into a confirm step (with preview flash + damage preview); a second
// click confirms, Escape backs out.
const BATTLE_CONFIRM_ATTACK = true;

/**
 * Combat FSM screen (plan 120): owns the game-stage scaffold + Babylon combat
 * scene lifecycle. With a CombatSetup (from team-select) it runs the placement
 * phase (step 6) — the battle loop takes over at step 7. Without one
 * (`?combat=1` dev route) it mounts the Jalon 3 demo content (12 Pokemon, click
 * highlights, two static Champs). The temporary "back to menu" button stands
 * in for the victory overlay (step 8).
 */

// 12 sprites = a max 6v6 combat, to stress 60fps. Mixed shadowSizes (0/1/2)
// keep the grounding comparison; spread across rows to exercise occlusion.
// Flyers exercise the glide fallback chain (Jalon 3d). Demo roster for the
// `?combat=1` dev shortcut (empty when the sandbox studio drives placement).
export const DEMO_POKEMON = [
  { pokemonId: "magnemite", spawn: { x: 2, y: 1 }, team: 1 },
  { pokemonId: "pidgey", spawn: { x: 5, y: 1 }, team: 1 },
  { pokemonId: "pikachu", spawn: { x: 8, y: 1 }, team: 1 },
  { pokemonId: "butterfree", spawn: { x: 11, y: 1 }, team: 1 },
  { pokemonId: "bulbasaur", spawn: { x: 2, y: 6 }, team: 1 },
  { pokemonId: "charmander", spawn: { x: 11, y: 6 }, team: 1 },
  { pokemonId: "blastoise", spawn: { x: 2, y: 7 }, team: 2 },
  { pokemonId: "golbat", spawn: { x: 11, y: 7 }, team: 2 },
  { pokemonId: "dragonite", spawn: { x: 2, y: 12 }, team: 2 },
  // Onix stands on the Electric-field anchor to exercise the pill/Pokémon layering.
  { pokemonId: "onix", spawn: { x: 10, y: 10 }, team: 2 },
  { pokemonId: "gyarados", spawn: { x: 8, y: 12 }, team: 2 },
  { pokemonId: "charizard", spawn: { x: 11, y: 12 }, team: 2 },
];

const DEMO_MOVE_RANGE = 3;
const FIELD_TERRAIN_DEMO_RADIUS = 3;

function manhattanDisk(
  centerX: number,
  centerY: number,
  min: number,
  max: number,
): { x: number; y: number }[] {
  const tiles: { x: number; y: number }[] = [];
  for (let y = centerY - max; y <= centerY + max; y++) {
    for (let x = centerX - max; x <= centerX + max; x++) {
      const distance = Math.abs(x - centerX) + Math.abs(y - centerY);
      if (distance >= min && distance <= max && x >= 0 && y >= 0) {
        tiles.push({ x, y });
      }
    }
  }
  return tiles;
}

function mountDemoContent(combat: CombatScene): void {
  // Jalon 3b demo (battle orchestrator lands at plan 120 step 7): clicking a
  // tile paints a Manhattan move range + outline, plus an attack ring one step
  // out — to verify picking and highlights on the extruded terrain.
  combat.onTileClick((pick) => {
    const move = manhattanDisk(pick.x, pick.y, 0, DEMO_MOVE_RANGE);
    combat.setTileHighlights(HighlightKind.Move, move);
    combat.setTileHighlights(HighlightKind.Attack, manhattanDisk(pick.x, pick.y, 4, 4));
    combat.setTileOutline(move);
  });

  // Jalon 3e demo: two static Champs zones to verify fill, perimeter, DOM pill.
  const champZone = (
    anchor: { x: number; y: number },
    color: number,
    teamColor: number,
    remainingTurns: number,
  ): FieldTerrainSpec => ({
    anchor,
    color,
    teamColor,
    remainingTurns,
    tiles: manhattanDisk(anchor.x, anchor.y, 0, FIELD_TERRAIN_DEMO_RADIUS),
  });
  combat.setFieldTerrains([
    champZone({ x: 4, y: 4 }, FIELD_TERRAIN_COLOR_GRASSY, getTeamColorByPlayerId("player-1"), 5),
    champZone(
      { x: 10, y: 10 },
      FIELD_TERRAIN_COLOR_ELECTRIC,
      getTeamColorByPlayerId("player-2"),
      3,
    ),
  ]);
}

/**
 * Chrome de la phase de placement (plan 189).
 *
 * Le menu de combat naissait dans `runBattle`, donc **après** cette phase : pendant qu'on posait ses
 * Pokemon, il n'existait ni sortie, ni accès aux Paramètres — un joueur qui découvrait là que sa
 * touche tombait mal devait attendre le début du combat. Trou signalé par le plan 187, refermé ici.
 *
 * Une rangée **réduite** : le plein écran et le bouton du menu, **pas** le journal — il n'y a aucun
 * combat dont tenir le journal. Et une seule instance de menu vivante à la fois : celle-ci est
 * détruite au passage de relais, avant que `runBattle` ne monte la sienne.
 */
/** Ce que le chrome de placement rend à `createCombatScreen` : sa destruction, et son ouverture. */
interface PlacementChrome {
  dispose(): void;
  /** Ouvrir le menu — routé par le flux de placement, qui ne possède pas le menu lui-même. */
  open(): boolean;
}

function mountPlacementChrome(options: {
  stage: GameStage;
  onRestart: () => void;
  onQuit: () => void;
}): PlacementChrome {
  const { stage, onRestart, onQuit } = options;
  const combatMenu = createCombatMenu({
    host: stage.screenLayer,
    variant: "placement",
    onRestart,
    // Au placement, la sortie destructrice s'appelle « Quitter » et confirme : rien n'est sauvegardé
    // encore, mais les Pokemon déjà posés sont perdus (plan 189, décisions 4 et 5).
    onAbandon: onQuit,
  });
  const fullscreenButton = createFullscreenButton({
    label: t("settings.fullscreen"),
    isSupported: isFullscreenSupported,
    isFullscreen,
    // Appelé directement depuis le clic, sans `await` en amont : l'activation utilisateur doit encore
    // tenir quand `requestFullscreen()` part.
    onToggle: () => void toggleFullscreen(),
  });
  const stopFullscreenWatch = new AbortController();
  onFullscreenChange(() => fullscreenButton.refresh(), { signal: stopFullscreenWatch.signal });
  const combatMenuButton = createCombatMenuButton({
    label: t("combatMenu.open"),
    onOpen: () => combatMenu.open(),
  });
  const row = createBattleLogRow(
    fullscreenButton.element,
    // Le capuchon de la touche sous le bouton (plan 189, décision 10). Vaut ici comme en combat : la
    // phase de placement est justement celle où on cherche les Paramètres sans savoir par où passer.
    withKeyHint(
      combatMenuButton.element,
      createKeyHint(getInputPromptSheetUrl(), combatMenuKeyHint(), "combat-menu-key-hint"),
    ),
  );
  stage.screenLayer.append(row);
  return {
    // Exposée pour que le flux de placement puisse router `Start` et `Échap` vers ELLE : le flux ne
    // possède pas le menu, il n'en connaît que l'ouverture.
    open: () => combatMenu.open(),
    dispose() {
      stopFullscreenWatch.abort();
      combatMenu.dispose();
      row.remove();
    },
  };
}

async function mountPlacement(
  combat: CombatScene,
  stage: GameStage,
  mapUrl: string,
  setup: CombatSetup,
  onComplete: (result: PlacementResult, map: MapDefinition) => void,
  openCombatMenu?: () => boolean,
): Promise<PlacementFlow> {
  const [loaded] = await Promise.all([loadTiledMap(mapUrl), combat.ready]);
  const format =
    loaded.map.formats.find(
      (candidate) => `${candidate.teamCount}v${candidate.maxPokemonPerTeam}` === setup.formatKey,
    ) ?? loaded.map.formats[0];
  if (!format) {
    throw new Error(`Map "${mapUrl}" has no formats`);
  }
  /*
   * `battle_started` part ICI, au même endroit que le seed (plan 196, décision #857).
   *
   * Contre-intuitif mais décisif : la composition doit voyager au DÉMARRAGE. Chez Showdown, l'usage
   * d'un Pokemon est sa présence dans une équipe, pas le fait qu'il ait agi — si elle partait avec
   * `battle_ended`, toutes les parties abandonnées disparaîtraient des statistiques d'usage, et
   * l'abandon est justement la population qu'on veut mesurer.
   *
   * `telemetryTeams` n'existe que sur le chemin de l'écran de sélection : le bac à sable, la route
   * `?combat=1` et un combat repris n'émettent donc rien, ce qui est le comportement voulu.
   */
  if (setup.telemetryTeams) {
    beginBattleTelemetry({
      mapUrl,
      formatKey: setup.formatKey,
      autoPlacement: setup.autoPlacement,
      telemetryTeams: setup.telemetryTeams,
      teams: setup.teams,
    });
  }
  return startPlacementFlow({
    combat,
    map: loaded.map,
    format,
    teams: setup.teams,
    autoPlacement: setup.autoPlacement,
    /*
     * Le seed est tiré ICI, avant le placement, et le combat reprendra celui-là.
     *
     * Une seule source d'entropie pour toute la partie : le placement en faisait une seconde, sur
     * `Math.random`, donc les douze Pokemon se posaient ailleurs à chaque lancement — et une capture
     * censée être reproductible ne l'était pas.
     */
    randomSeed: randomSeed(),
    openCombatMenu,
    host: stage.screenLayer,
    onComplete: (result) => onComplete(result, loaded.map),
  });
}

/**
 * Wire a built battle into the board/chrome/orchestrator and start the loop
 * (plan 120 step 7b). Shared by the placement path (`startBattleLoop`) and the
 * sandbox boot path (`startSandboxBattle`); the only difference is how the engine
 * is built and which AI hook is installed (`wireTurnReady`). Tile clicks +
 * Escape/Space are routed to the orchestrator (the latter via the AbortController).
 */
function runBattle(options: {
  backend: RendererBackend;
  combat: CombatScene;
  stage: GameStage;
  /**
   * The ONE probe measuring the timeline's first portrait, owned by `mountContent` (which disposes
   * it). Both consumers read it: the renderer pins the compass to it, the DOM chrome places the
   * control legend on it (plan 185). A second probe would mean two `ResizeObserver` on the same
   * element and two reference boxes — and a lifecycle nobody owns.
   */
  insets: ChromeInsetProbe;
  battle: BattleSetupResult;
  handles: ReadonlyMap<string, CombatPokemonHandle>;
  onExit: () => void;
  signal: AbortSignal;
  onReplay: () => void;
  wireTurnReady: (battle: BattleSetupResult) => BattleOrchestrator["onTurnReady"];
  /**
   * Fog ennemi (plan 176): withhold enemy exact HP / unrevealed held item / Substitute HP, and read
   * the forecast's damage in % of max HP. Always on in a real battle (it is a rule, not a setting);
   * the sandbox studio drives it from `config.fogOfWar`.
   */
  enemyInfoHidden: boolean;
  /** Players a human drives — the fog reads through their eyes, never the acting AI's (plan 176). */
  humanPlayerIds: readonly string[];
  /**
   * Events of a battle rebuilt from its saved action log (plan 181). Pushed into the log ONLY, so a
   * resumed battle comes back with its history — never through `feedback`, which would re-spawn every
   * damage number of the whole battle over the sprites.
   */
  initialLogEvents?: readonly BattleEvent[];
  /** Called after each action the engine accepted — the hook the resume save hangs on (plan 181). */
  onActionCommitted?: () => void;
  /** Called once the battle can no longer be resumed: it ended, or the player walked away. */
  onBattleClosed?: () => void;
}): BattleOrchestrator {
  const {
    backend,
    combat,
    stage,
    insets,
    battle,
    handles,
    onExit,
    signal,
    onReplay,
    wireTurnReady,
    enemyInfoHidden,
    humanPlayerIds,
    initialLogEvents,
    onActionCommitted,
    onBattleClosed,
  } = options;
  const board = backend.createBattleBoardView(combat, handles);
  const inputSystem = getInputSystem();
  // Host-injected i18n / asset-path deps for the reusable DOM chrome (plan 125 Phase 4).
  const uiConfig: UiDomConfig = {
    translate: (key, params) => t(key as TranslationKey, params),
    getLanguage,
    getTypeIconUrl,
    getCategoryIconUrl,
    getWeatherIconUrl,
    getInputPromptSheetUrl,
    getCursorSheetUrl,
    getCameraKeyLabels: cameraKeyLabels,
    getPortraitUrl,
    getItemIconUrl,
  };
  const chrome = createBattleChrome({
    host: stage.screenLayer,
    insets,
    onExit: () => {
      // Leaving for the menu abandons the battle: its save must go with it, or the menu would offer to
      // resume a battle the player just quit.
      onBattleClosed?.();
      onExit();
    },
    onReplay: () => {
      // "Replay" restarts the whole placement→battle flow from scratch; the old log describes a battle
      // that no longer exists.
      onBattleClosed?.();
      onReplay();
    },
    config: uiConfig,
    /*
     * Capuchons de défilement de l'ordre de jeu (plan 189), un à chaque extrémité de la liste : c'est
     * là que le défilement se produit, donc là que la direction du capuchon veut dire quelque chose.
     * Affichés en permanence — la liste déborde toujours, 4K comprise (décision 7).
     */
    timelineKeyHints: {
      scrollUp: createKeyHint(
        getInputPromptSheetUrl(),
        keyHintOf(LogicalAction.ScrollTimelineUp),
        "timeline-scroll-up-key-hint",
      ),
      scrollDown: createKeyHint(
        getInputPromptSheetUrl(),
        keyHintOf(LogicalAction.ScrollTimelineDown),
        "timeline-scroll-down-key-hint",
      ),
    },
    // Keyboard and gamepad navigate by focus, and every phase rebuilds the menu — so the fresh menu
    // has to take the focus back, or navigation restarts from nothing at each step (plan 184).
    // Which menus take it is the chrome's call: only the two the arrows navigate (see
    // `restoreMenuFocus`), never a board phase's lone « Annuler ».
    shouldAutoFocusMenu: () => inputSystem?.tracker.isFocusDriven() === true,
  });
  /*
   * Menu de combat (plan 187). Né ici, et nulle part ailleurs : `runBattle` est la seule fonction qui
   * possède à la fois le `screenLayer`, les deux sorties du chrome et la registration d'entrée du
   * combat — les trois choses dont ce menu a besoin. Les trois chemins de combat (placement, reprise,
   * sandbox) passent par elle, donc tous les trois l'obtiennent.
   *
   * Ce n'est PAS une pause : rien n'est suspendu à l'ouverture (voir `combat-menu.ts`).
   */
  const combatMenu = createCombatMenu({
    host: stage.screenLayer,
    // Abandonner et Recommencer détruisent la partie : ils purgent la sauvegarde comme le fait le
    // dialogue de victoire. C'est ce que leur confirmation annonce.
    onAbandon: () => {
      onBattleClosed?.();
      onExit();
    },
    onRestart: () => {
      onBattleClosed?.();
      onReplay();
    },
    // Quitter, lui, sort SANS purger — la partie reste reprenable depuis le menu principal. Fourni
    // seulement quand une sauvegarde existe : `onBattleClosed` n'est passé que par le vrai combat
    // (`store.clear()`), pas par le studio sandbox. Là-bas, l'entrée ne s'affiche donc pas plutôt
    // que de promettre une reprise sans rien à reprendre.
    onQuitKeepingSave: onBattleClosed === undefined ? undefined : () => onExit(),
  });
  signal.addEventListener("abort", () => combatMenu.dispose(), { once: true });

  const language = getLanguage();
  // Shared name resolvers for the log + floating texts (instance id → localised names).
  const pokemonNameOf = (id: string): string => {
    const pokemon = battle.state.pokemon.get(id);
    return pokemon ? getPokemonName(pokemon.definitionId, language) : id;
  };
  const abilityNameOf = (id: string): string | null =>
    battle.abilityRegistry.get(id)?.name[language] ?? null;
  const itemNameOf = (id: string): string | null =>
    battle.itemRegistry.get(id)?.name[language] ?? null;

  const battleLog = createBattleLog({
    context: {
      getPokemonName: pokemonNameOf,
      getMoveName: (moveId) => getMoveName(moveId, language),
      getAbilityName: abilityNameOf,
      getItemName: itemNameOf,
      language,
      translate: uiConfig.translate,
    },
    teamOf: (id) => {
      const pokemon = battle.state.pokemon.get(id);
      return pokemon ? Number(pokemon.playerId.match(/(\d+)/)?.[1] ?? "1") : null;
    },
    translate: uiConfig.translate,
    /*
     * Les capuchons de touche du journal (plan 189, décision 8) : celui qui l'ouvre dans son en-tête,
     * ceux qui le font défiler en pied de liste — et ces deux-là ne s'affichent que quand elle déborde.
     *
     * Les positions sortent du magasin de bindings, jamais écrites en dur : un remappage doit changer
     * ce que le joueur voit ici, sinon la légende mentirait dès la première touche déplacée.
     */
    keyHints: {
      scrollUp: createKeyHint(
        getInputPromptSheetUrl(),
        keyHintOf(LogicalAction.ScrollLogUp),
        "log-scroll-up-key-hint",
      ),
      scrollDown: createKeyHint(
        getInputPromptSheetUrl(),
        keyHintOf(LogicalAction.ScrollLogDown),
        "log-scroll-down-key-hint",
      ),
    },
  });
  // Bouton plein écran à gauche du journal (plan 180-a) : second point d'entrée, celui des
  // réglages obligeant à quitter le combat — or c'est en plein combat, sur téléphone, que la barre
  // d'URL coûte le plus. Il vit dans la même rangée que le journal pour rester collé à son bord
  // gauche quelle que soit sa largeur (replié, plafonné à 40vw, élargi sur téléphone).
  const fullscreenButton = createFullscreenButton({
    label: t("settings.fullscreen"),
    isSupported: isFullscreenSupported,
    isFullscreen,
    // Appelé directement depuis le clic, sans `await` en amont : l'activation utilisateur doit
    // encore tenir quand `requestFullscreen()` part.
    onToggle: () => void toggleFullscreen(),
  });
  // Le bouton disparaît une fois en plein écran, y compris sur une sortie qu'il n'a pas déclenchée
  // (Échap, geste système) — d'où l'abonnement plutôt qu'un simple rafraîchissement au clic.
  // Branché sur le `signal` du combat, comme les autres écouteurs de cette fonction : la sortie de
  // l'écran le retire, sinon un combat quitté en laisserait un derrière lui à chaque partie.
  onFullscreenChange(() => fullscreenButton.refresh(), { signal });
  // Entrée tactile du menu de combat (plan 187) : un téléphone n'a ni `Échap` ni `Start`. Entre le
  // plein écran et le journal (retour humain 2026-08-25) — la rangée existe, rien n'y flotte de plus.
  const combatMenuButton = createCombatMenuButton({
    label: t("combatMenu.open"),
    onOpen: () => combatMenu.open(),
  });
  stage.screenLayer.append(
    createBattleLogRow(
      fullscreenButton.element,
      // Chaque bouton du chrome annonce sa touche SOUS lui (plan 189, décision 10) — les deux ici,
      // dans la rangée, parce que c'est elle qui empile un bouton et son indice.
      withKeyHint(
        combatMenuButton.element,
        createKeyHint(getInputPromptSheetUrl(), combatMenuKeyHint(), "combat-menu-key-hint"),
      ),
      // Sous le PANNEAU et non dans son en-tête : replié, le journal *est* son bouton, donc l'indice
      // tombe pile dessous — et il ne peut pas être rogné par l'`overflow: hidden` du panneau.
      withKeyHint(
        battleLog.element,
        createKeyHint(
          getInputPromptSheetUrl(),
          keyHintOf(LogicalAction.ToggleBattleLog),
          "log-open-key-hint",
        ),
      ),
    ),
  );
  /*
   * Le bouton du menu n'est actif que quand le menu peut RÉELLEMENT s'ouvrir : hors verrou
   * d'animation (décision 14) et sans autre modale à l'écran (décision 15). Une seule règle, relue
   * par les deux endroits qui la font changer — sinon les deux écritures dépendent de leur ordre
   * d'exécution, et `enterBattleOver` change justement le contexte AVANT d'ouvrir la victoire.
   *
   * Sans ce grisage, le bouton reste cliquable et l'ouverture est refusée en silence : c'est le seul
   * appareil qui n'a aucun autre retour, et on tape trois fois dessus en croyant à un bug (décision 18).
   */
  let inputContext: InputContext = "locked";
  const refreshCombatMenuButton = (): void => {
    combatMenuButton.setEnabled(inputContext !== "locked" && !isModalOpen());
  };
  refreshCombatMenuButton();
  // Host-injected presentation deps (plan 125, décision #4): the orchestrator +
  // view-builders + floating-text mapper stay renderer-agnostic; the app-shell
  // wires the real i18n / settings / asset-path here.
  const presentationContext: PresentationContext = {
    translate: (key, params) => t(key as TranslationKey, params),
    getLanguage,
    getPortraitUrl,
    getItemIconUrl,
    getItemName: itemNameOf,
    getAbilityName: abilityNameOf,
    getPokemonTypes: (definitionId) => battle.pokemonDefinitions.get(definitionId)?.types ?? [],
    getTypeIconUrl,
    getStatusIconUrl,
    getStatusLabelUrl,
    isDamagePreviewEnabled: () => getSettings().damagePreview,
    isEnemyInfoHidden: () => enemyInfoHidden,
  };
  const spawnFloatingText = createFloatingTextSpawner(combat, battle.state, {
    getPokemonName: pokemonNameOf,
    getAbilityName: abilityNameOf,
    getItemName: itemNameOf,
    getCurrentHp: (id) => battle.state.pokemon.get(id)?.currentHp ?? 0,
    translate: presentationContext.translate,
    getLanguage: presentationContext.getLanguage,
  });
  // History of a resumed battle: the log alone, and before the live feed starts, so the restored lines
  // sit above whatever happens next.
  for (const event of initialLogEvents ?? []) {
    battleLog.report(event);
  }
  const feedback: BattleFeedback = {
    report: (event) => {
      battleLog.report(event);
      spawnFloatingText(event);
      // Télémétrie (plan 196) : point unique et exhaustif du flux d'événements, déjà utilisé par
      // `onBattleClosed`. No-op quand aucune partie n'a été ouverte (bac à sable, reprise).
      observeBattleTelemetry(event);
      if (event.type === BattleEventType.BattleEnded) {
        // Le match nul (plan 191) passe ici aussi : `winnerId` vaut alors `null`.
        endBattleTelemetry();
        onBattleClosed?.();
      }
    },
  };
  /**
   * Le combat peut se terminer **menu ouvert** — l'IA achève le dernier Pokemon du joueur pendant
   * qu'il lit ses réglages. Le menu s'efface alors devant le dialogue de victoire, qui porte ses
   * propres sorties (plan 187).
   *
   * Décoré ici, au seul endroit où le chrome est remis à l'orchestrateur, qui l'appelle en un point
   * unique : la couverture est donc exhaustive, sans que le menu écoute les événements du combat ni
   * que `view-core` apprenne son existence.
   */
  const chromeWithMenuAwareVictory: typeof chrome = {
    ...chrome,
    showVictory: (winnerId) => {
      combatMenu.close();
      // Le menu refuse de s'ouvrir tant que la victoire est à l'écran (décision 15) : le bouton doit
      // donc le DIRE, sinon on tape trois fois dessus en croyant à un bug (décision 18). Le contexte
      // `battle_over` valant `menu` et non `locked`, la bascule ci-dessous ne l'aurait pas couvert.
      chrome.showVictory(winnerId);
      // Après l'ouverture, pour que la règle voie la modale qui vient d'apparaître.
      refreshCombatMenuButton();
    },
  };
  const orchestrator = new BattleOrchestrator(
    battle.engine,
    battle.state,
    battle.moveDefinitions,
    board,
    chromeWithMenuAwareVictory,
    feedback,
    { confirmAttack: BATTLE_CONFIRM_ATTACK, humanPlayerIds, onActionCommitted },
    presentationContext,
  );
  orchestrator.onTurnReady = wireTurnReady(battle);
  /**
   * À l'ouverture d'une phase de plateau, le curseur repart du Pokemon actif (retour humain
   * 2026-08-21) : le reprendre là où on l'avait laissé au tour d'avant était déroutant — on visait
   * depuis un coin de la carte sans rapport avec le mon qui joue.
   *
   * Seulement au clavier / à la manette : au pointeur, le curseur suit la souris de toute façon, et
   * le repositionner sous elle serait un saut visuel gratuit.
   */
  orchestrator.onInputContextChanged = (context) => {
    // Avant le filtre ci-dessous : le grisage du bouton compte au DOIGT, précisément là où
    // `isFocusDriven()` est faux.
    inputContext = context;
    refreshCombatMenuButton();
    if (inputSystem?.tracker.isFocusDriven() !== true) {
      return;
    }
    // Tour de l'IA / résolution d'une action : plus rien n'est pointable, donc le curseur s'efface —
    // le laisser sur le Pokemon du tour précédent affichait en plus sa fiche en prévision, comme si
    // on visait encore quelque chose (retour humain 2026-08-21).
    if (context === "locked") {
      combat.pinCursor(null);
      chrome.updateCursorPanel(null);
      chrome.updateTileInfo(null);
      return;
    }
    if (context !== "board") {
      return;
    }
    const focus = combat.cameraFocusTile();
    if (focus) {
      combat.pinCursor(focus);
    }
  };

  // The source travels with the press: a finger aiming a directional pattern needs a preview tap
  // before it commits, a mouse has already hovered (plan 183).
  combat.onTileClick((pick, source) => orchestrator.onTileClick({ x: pick.x, y: pick.y }, source));
  combat.onTileHover((pick) => orchestrator.onTileHover(pick ? { x: pick.x, y: pick.y } : null));
  combat.onCameraRotated((azimuth) => chrome.updateCameraAzimuth(azimuth));

  // Keyboard / gamepad (plan 184). Replaces the `keydown` listener this used to be: the arrows now
  // drive a real board cursor, and the routing between the board and the DOM menu comes from the
  // orchestrator's phase instead of each listener guessing from `event.key`.
  const unregisterInput = inputSystem?.register({
    context: () => orchestrator.inputContext(),
    board: {
      moveCursor: (direction) => {
        // Ordre explicite, du plus spécifique au plus général (retour humain 2026-08-21) :
        // 1. un sélecteur d'orientation ouvert (fin de tour) : la flèche le VISE ;
        if (combat.aimDirectionPicker(direction)) {
          return;
        }
        // 2. une visée de pattern directionnel (cône, ligne, fauche, charge) : le curseur reste sur
        //    le lanceur et seule l'empreinte tourne — on y choisit une direction, pas une case.
        const aimCenter = orchestrator.directionalAimCenter();
        if (aimCenter) {
          // Le curseur se pose SUR le lanceur : la rotation doit se lire comme tournant autour de
          // lui, et un curseur resté ailleurs (ou nulle part) rendait la phase illisible.
          combat.pinCursor(aimCenter);
          const grid = combat.gridDirectionFrom(aimCenter, direction);
          if (grid !== null) {
            orchestrator.aimDirectionalPattern(grid);
          }
          return;
        }
        // 3. sinon : le curseur de case marche.
        combat.moveCursor(direction);
      },
      confirmCursorTile: () => {
        // The facing picker answers Confirm itself: that phase has no `onTileClick` case at all, so
        // without this the keyboard could open the end-of-turn facing choice and never answer it.
        if (combat.confirmDirectionPicker()) {
          return true;
        }
        // C'est la PHASE qui décide de ce dont Confirm a besoin (case sous le curseur, direction
        // visée, ou rien du tout à l'étape de confirmation) — donc c'est l'orchestrateur qui tranche.
        return orchestrator.onBoardConfirm(combat.cursorTile());
      },
      cancel: () => {
        // The open facing picker gets first refusal, then the phase cancel — the explicit
        // arbitration that replaced `combat-scene.ts`'s `stopImmediatePropagation()`.
        if (combat.cancelDirectionPicker()) {
          return true;
        }
        // Même garde que côté menu : une modale ouverte possède `Échap` (aujourd'hui la victoire est
        // en contexte `menu`, donc ce chemin ne la voit pas — le garde est là pour que ça reste vrai
        // si une phase de plateau venait à coexister avec une modale).
        if (isModalOpen()) {
          return true;
        }
        // Rien à annuler (plateau au repos) → `Échap` ouvre le menu de combat (plan 187 décision 7).
        // C'est l'orchestrateur qui dit la vérité, pas une liste de phases écrite ici.
        return orchestrator.onEscape() || combatMenu.open();
      },
      cycleTarget: (delta) => orchestrator.onCycleTargetKey(delta),
      rotateCamera: (step) => combat.rotateCamera(step),
      panCamera: (deltaX, deltaY) => combat.panCameraByPixels(deltaX, deltaY),
      zoomCamera: (step) => combat.zoomCamera(step),
      setZoomLevel: (index) => combat.setZoomLevel(index),
      scrollLog: (delta) => battleLog.scrollByStep(delta),
      toggleLog: () => battleLog.toggleCollapsed(),
      scrollTimeline: (delta) => chrome.scrollTimeline(delta),
      openCombatMenu: () => combatMenu.open(),
    },
    menu: {
      focusMove: (direction) => {
        // Dialogue de victoire ouvert : c'est LUI le menu (Rejouer / Retour au menu). Le navigateur y
        // piège le focus, donc parcourir le menu d'actions derrière n'aurait aucun effet — et à la
        // manette, sans `Tab`, la modale était inatteignable (retour humain 2026-08-21).
        if (isModalOpen()) {
          focusInDirection(direction);
          return;
        }
        // Le menu de combat est une colonne : seules les flèches verticales le parcourent.
        if (direction === "up") {
          chrome.focusMenuStep(-1);
        } else if (direction === "down") {
          chrome.focusMenuStep(1);
        }
      },
      confirm: () => {
        // À la MANETTE, aucune activation native ne suit : un appui de pad n'est pas un événement
        // clavier, donc si on ne clique pas nous-mêmes, A ne fait rien du tout sur un menu (retour
        // humain 2026-08-21). Au clavier, à l'inverse, le navigateur active le bouton focalisé et
        // réclamer la touche ici l'en empêcherait.
        const onGamepad = inputSystem?.tracker.current() === InputSource.Gamepad;
        if (isModalOpen()) {
          return onGamepad ? activateFocusedControl() : false;
        }
        if (onGamepad) {
          if (chrome.activateFocusedMenuItem()) {
            return true;
          }
        } else if (chrome.isMenuFocused()) {
          return false;
        }
        orchestrator.onConfirmKey();
        return true;
      },
      cancel: () => {
        // Le dialogue de victoire possède `Échap` : on AVALE la touche pour qu'il ne se ferme pas.
        //
        // Sans ce garde, la phase `battle_over` (contexte `menu`) laissait `cancel` renvoyer false —
        // rien à annuler, et `open()` refuse tant qu'un `dialog` est là (décision 15) — donc le
        // routeur ne faisait pas `preventDefault()` et la fermeture NATIVE d'`Échap` emportait
        // Rejouer / Retour au menu. `showVictory` n'étant appelé qu'une fois, l'écran de résultat
        // était perdu pour de bon. Avant le plan 187, le `return true` inconditionnel masquait ça.
        if (isModalOpen()) {
          return true;
        }
        // Menu d'actions RACINE : il n'y a plus rien à annuler, donc `Échap` y ouvre le menu de
        // combat (plan 187 décision 7) — le seul endroit du flux où la touche était sans effet.
        return orchestrator.onEscape() || combatMenu.open();
      },
    },
  });
  signal.addEventListener("abort", () => unregisterInput?.(), { once: true });

  orchestrator.start();
  return orchestrator;
}

/** EASY AI (seeded) for the given AI-controlled player ids (placement path). */
function wireScoredAi(
  battle: BattleSetupResult,
  aiPlayerIds: readonly PlayerId[],
): BattleOrchestrator["onTurnReady"] {
  if (aiPlayerIds.length === 0) {
    return null;
  }
  const aiControllers = new Map<string, AiTeamController>();
  for (const playerId of aiPlayerIds) {
    aiControllers.set(
      playerId,
      new AiTeamController(
        battle.engine,
        playerId,
        EASY_PROFILE,
        createPrng(Date.now()),
        battle.moveDefinitions,
      ),
    );
  }
  return (activePokemonId) => {
    const pokemon = battle.state.pokemon.get(activePokemonId);
    const ai = pokemon ? aiControllers.get(pokemon.playerId) : undefined;
    return ai ? ai.playTurn() : false;
  };
}

/** Build the engine from the finished placement and run the loop (team-select path). */
function startBattleLoop(
  backend: RendererBackend,
  combat: CombatScene,
  stage: GameStage,
  insets: ChromeInsetProbe,
  map: MapDefinition,
  mapUrl: string,
  setup: CombatSetup,
  result: PlacementResult,
  navigate: Navigate,
  signal: AbortSignal,
  onReplay: () => void,
): BattleOrchestrator {
  const inputs: BattleInputs = {
    setup,
    placementTeams: result.placementTeams,
    placements: result.placements,
    /*
     * Le seed du placement, repris tel quel : une seule source d'entropie par partie, placement
     * compris. C'est ce que cette ligne prétendait déjà être — elle en tirait en fait un SECOND, et le
     * placement, lui, n'en avait aucun.
     */
    seed: result.seed,
  };
  const battle = buildBattle(inputs, map);
  return runResolvedBattle({
    backend,
    combat,
    stage,
    insets,
    battle,
    handles: result.handles,
    mapUrl,
    inputs,
    navigate,
    signal,
    onReplay,
  });
}

/**
 * Wire a built real battle (fresh or resumed) into the loop and keep its resume save up to date.
 *
 * Single point on purpose: the resumed path must not become a second combat path that drifts from the
 * live one. The only thing it does differently is arrive with a history (`initialLogEvents`) and with
 * billboards spawned from engine state rather than from the placement phase.
 */
function runResolvedBattle(options: {
  backend: RendererBackend;
  combat: CombatScene;
  stage: GameStage;
  /** See `runBattle`: the single chrome-inset probe, owned by `mountContent`. */
  insets: ChromeInsetProbe;
  battle: BattleSetupResult;
  handles: ReadonlyMap<string, CombatPokemonHandle>;
  mapUrl: string;
  inputs: BattleInputs;
  navigate: Navigate;
  signal: AbortSignal;
  onReplay: () => void;
  initialLogEvents?: readonly BattleEvent[];
}): BattleOrchestrator {
  const {
    backend,
    combat,
    stage,
    insets,
    battle,
    handles,
    mapUrl,
    inputs,
    navigate,
    signal,
    onReplay,
  } = options;
  const store = battleResumeStore();
  const persist = (): void => {
    const replay = battle.engine.exportReplay();
    store.save({
      mapUrl,
      setup: inputs.setup,
      placementTeams: inputs.placementTeams,
      placements: inputs.placements,
      seed: replay.seed,
      actions: replay.actions,
    });
  };
  // Saved before the first action too: a reload right after placement should resume the battle that was
  // just set up, not send the player back through team-select.
  persist();
  const aiPlayerIds = inputs.placementTeams
    .filter((team) => team.controller === PlayerController.Ai)
    .map((team) => team.playerId);
  return runBattle({
    backend,
    combat,
    stage,
    insets,
    battle,
    handles,
    signal,
    onReplay,
    initialLogEvents: options.initialLogEvents,
    onExit: () => navigate("main-menu", undefined),
    wireTurnReady: (built) => wireScoredAi(built, aiPlayerIds),
    // A real battle always withholds enemy information (plan 176) — no player-facing opt-out.
    enemyInfoHidden: true,
    humanPlayerIds: inputs.placementTeams
      .filter((team) => team.controller === PlayerController.Human)
      .map((team) => team.playerId),
    onActionCommitted: persist,
    onBattleClosed: () => store.clear(),
  });
}

/**
 * Spawn one billboard per Pokémon straight from engine state, for the two paths that have no placement
 * phase to walk (the sandbox studio and a resumed battle). Poses each mon where the engine says it
 * stands right now — mid-battle positions and K.O.s included; the initial `syncBoard` lays a fainted
 * one down, and a later revive re-shows it.
 *
 * The team number is read from the instance-id prefix, like the placement path does (`p3-` is team 3),
 * NOT from `playerId === Player1 ? 1 : 2`: formats go up to `12v1` (twelve teams of one — `formatKey`
 * is `{teamCount}v{maxPokemonPerTeam}`), and the number drives the team colour and the X-ray
 * silhouette. Hard-coding two teams silently repainted players 3+ in the enemy's colour.
 */
function spawnBillboardsFromState(
  combat: CombatScene,
  state: BattleState,
): Map<string, CombatPokemonHandle> {
  const handles = new Map<string, CombatPokemonHandle>();
  for (const pokemon of state.pokemon.values()) {
    const handle = combat.addPokemon({
      pokemonId: pokemon.definitionId,
      spawn: pokemon.position,
      team: Number(pokemon.id.match(/^p(\d+)-/)?.[1] ?? 1),
    });
    handle.setFacing(pokemon.orientation);
    handles.set(pokemon.id, handle);
  }
  return handles;
}

/**
 * Resume path (plan 181): rebuild the battle from its saved action log, spawn the billboards from the
 * resulting engine state, and hand it to the same loop as a fresh battle.
 *
 * Throws if the log cannot be replayed; the caller drops the save and falls back to the menu.
 */
function startResumedBattle(
  backend: RendererBackend,
  combat: CombatScene,
  stage: GameStage,
  insets: ChromeInsetProbe,
  map: MapDefinition,
  save: BattleResumeSave,
  navigate: Navigate,
  signal: AbortSignal,
  onReplay: () => void,
): BattleOrchestrator {
  const inputs: BattleInputs = {
    setup: save.setup,
    placementTeams: save.placementTeams,
    placements: save.placements,
    seed: save.seed,
  };
  const { battle, logEvents } = resumeBattle(inputs, save.actions, map);
  return runResolvedBattle({
    backend,
    combat,
    stage,
    insets,
    battle,
    handles: spawnBillboardsFromState(combat, battle.state),
    mapUrl: save.mapUrl,
    inputs,
    navigate,
    signal,
    onReplay,
    initialLogEvents: logEvents,
  });
}

function randomSeed(): number {
  // Scénario de capture (plan 194) : `?seed=` fixe le combat pour que deux runs produisent les mêmes
  // images. Inerte hors DEV/E2E — voir `capture-seed.ts` pour la garde.
  const forced = forcedBattleSeed();
  if (forced !== null) {
    return forced;
  }
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}

const AI_PROFILE_BY_KEY = {
  easy: EASY_PROFILE,
  medium: MEDIUM_PROFILE,
  hard: HARD_PROFILE,
} as const;

function profileForKey(key: AiProfileKey | undefined) {
  return AI_PROFILE_BY_KEY[key ?? "hard"];
}

/** Sandbox team index → engine player id (Équipe 1 = Player1, Équipe 2 = Player2). */
function teamPlayerId(teamIndex: number): PlayerId {
  return teamIndex === 0 ? PlayerId.Player1 : PlayerId.Player2;
}

/** Resolved spawn tile reported back to the studio panel, keyed by team + member index. */
export interface ResolvedSpawn {
  teamIndex: number;
  memberIndex: number;
  position: { x: number; y: number };
}

/**
 * Random RNG mode → a fresh seed every mount (incl. replay), so probabilistic
 * effects vary. Deterministic mode (or an explicit `seed` from e2e) → keep it.
 * Legacy configs with neither field default to random, matching the panel toggle.
 */
function resolveSandboxSeed(config: SandboxConfig): number {
  const random =
    config.rngMode === "random" || (config.rngMode === undefined && config.seed === undefined);
  return random ? randomSeed() : (config.seed ?? 0);
}

/**
 * Sandbox boot path (plan 120 step 9, plan 167 teams): spawn every team member's
 * billboard from the sandbox engine state (no placement phase) and run the loop.
 * Per-team control: "player" = human; "passive" = one `DummyAiController` per member
 * (single defensive move + face a fixed direction); "scored" = one seeded
 * `AiTeamController` per team (the real heuristic scorer, deterministic via `config.seed`).
 */
function startSandboxBattle(options: {
  backend: RendererBackend;
  combat: CombatScene;
  stage: GameStage;
  /** See `runBattle`: the single chrome-inset probe, owned by `mountContent`. */
  insets: ChromeInsetProbe;
  map: MapDefinition;
  config: SandboxConfig;
  onExit: () => void;
  signal: AbortSignal;
  onReplay: () => void;
  /** Report the engine-resolved spawn tiles back to the studio panel. */
  onPositionsResolved?: (resolved: ResolvedSpawn[]) => void;
}): BattleOrchestrator {
  const {
    backend,
    combat,
    stage,
    insets,
    map,
    config,
    onExit,
    signal,
    onReplay,
    onPositionsResolved,
  } = options;
  const seed = resolveSandboxSeed(config);
  const battle = createSandboxBattle({ ...config, seed }, map);
  // Includes a member that starts fainted (hp:0 ally for Vœu Soin / revive scenarios).
  const handles = spawnBillboardsFromState(combat, battle.state);

  const resolved: ResolvedSpawn[] = [];
  config.teams.forEach((team, teamIndex) => {
    team.members.forEach((member, memberIndex) => {
      const instance = battle.state.pokemon.get(
        sandboxInstanceId(teamIndex, memberIndex, member.pokemon),
      );
      if (instance) {
        resolved.push({ teamIndex, memberIndex, position: instance.position });
      }
    });
  });
  onPositionsResolved?.(resolved);

  return runBattle({
    backend,
    combat,
    stage,
    insets,
    battle,
    handles,
    onExit,
    signal,
    onReplay,
    // Studio default is OFF (debugging wants exact figures); the checkbox turns the fog on. The panel
    // remounts the whole scene on every config change, so no live update path is needed.
    enemyInfoHidden: config.fogOfWar === true,
    // A "player" team is human-driven; hotseat (both teams player) hands the viewpoint over with the
    // turn, exactly like `viewerPlayerId` expects.
    humanPlayerIds: config.teams
      .map((team, index) => (team.control === "player" ? teamPlayerId(index) : null))
      .filter((playerId): playerId is PlayerId => playerId !== null),
    wireTurnReady: (built) => {
      const passiveByInstanceId = new Map<string, DummyAiController>();
      const scoredByPlayerId = new Map<PlayerId, AiTeamController>();
      config.teams.forEach((team, teamIndex) => {
        const playerId = teamIndex === 0 ? PlayerId.Player1 : PlayerId.Player2;
        if (team.control === "passive") {
          team.members.forEach((member, memberIndex) => {
            const id = sandboxInstanceId(teamIndex, memberIndex, member.pokemon);
            passiveByInstanceId.set(
              id,
              new DummyAiController(
                built.engine,
                id,
                member.defensiveMove ?? null,
                member.direction ?? Direction.South,
              ),
            );
          });
        } else if (team.control === "scored") {
          scoredByPlayerId.set(
            playerId,
            new AiTeamController(
              built.engine,
              playerId,
              profileForKey(team.aiProfile),
              createPrng(seed),
              built.moveDefinitions,
            ),
          );
        }
      });
      if (passiveByInstanceId.size === 0 && scoredByPlayerId.size === 0) {
        return null;
      }
      return (activePokemonId) => {
        const passive = passiveByInstanceId.get(activePokemonId);
        if (passive) {
          return passive.playTurn();
        }
        const active = built.state.pokemon.get(activePokemonId);
        const scored = active ? scoredByPlayerId.get(active.playerId) : undefined;
        return scored ? scored.playTurn() : false;
      };
    },
  });
}

const SANDBOX_DEFAULT_MAP_URL = "assets/maps/dev/sandbox-flat.tmj";

/** Resolve the sandbox map url (kept document-relative so it works under any deploy base). */
/**
 * Bind the mouse/touch gestures of a freshly created scene (plan 184 étape E). Skipped when the
 * input system is absent (a boot path that never called `initInputSystem`), which leaves the scene
 * inert rather than half-wired.
 */
function attachPointerSourceForScene(
  canvas: HTMLCanvasElement,
  scene: CombatScene,
): PointerSource | null {
  const system = getInputSystem();
  if (!system) {
    return null;
  }
  return attachPointerSource({ canvas, scene, tracker: system.tracker });
}

function sandboxMapUrl(config: SandboxConfig): string {
  return config.mapUrl ?? SANDBOX_DEFAULT_MAP_URL;
}

/**
 * Sandbox Studio (plan 123 — the `pnpm dev:sandbox` studio).
 * Owns the editor chrome (header / player + dummy columns / battle strip via
 * `SandboxPanel`) plus the game-stage + combat-scene lifecycle, skipping the menus
 * and the placement phase. Every config change tears the battle down and re-mounts
 * it from the new config. "Replay" re-mounts the same config; "Back to menu" tears
 * down then hands off to the FSM.
 */
export function mountSandboxStudio(
  host: HTMLElement,
  initialConfig: SandboxConfig,
  navigate: Navigate,
  backend: RendererBackend,
): { dispose(): void } {
  initSandboxStudioDom(host);
  let panel: SandboxPanel | null = null;
  let stage: GameStage | null = null;
  let combat: CombatScene | null = null;
  let pointerSource: PointerSource | null = null;
  let orchestrator: BattleOrchestrator | null = null;
  let loading: LoadingOverlayHandle | null = null;
  /** Measures the left chrome column so the compass parks clear of it (plan 183). */
  let insetProbe: ChromeInsetProbe | null = null;
  let abort = new AbortController();
  let disposed = false;

  function teardownBattle(): void {
    abort.abort();
    loading?.cancel();
    loading = null;
    orchestrator?.dispose();
    orchestrator = null;
    pointerSource?.dispose();
    pointerSource = null;
    combat?.dispose();
    combat = null;
    insetProbe?.dispose();
    insetProbe = null;
    stage?.dispose();
    stage = null;
  }

  async function mountContent(config: SandboxConfig): Promise<void> {
    abort = new AbortController();
    const localAbort = abort;
    loading = showLoadingOverlay(host);
    const overlay = loading;
    const mapUrl = sandboxMapUrl(config);
    const activeStage = mountGameStage(host);
    stage = activeStage;
    // The compass is pinned near the left edge, where the turn timeline sits: it asks the chrome how
    // wide that column actually is rather than assuming (plan 183).
    insetProbe?.dispose();
    insetProbe = createChromeInsetProbe(activeStage.stage);
    const probe = insetProbe;
    const activeCombat = backend.createCombatScene({
      canvas: activeStage.canvas,
      mapUrl,
      pokemon: [],
      timelineFirstCell: () => probe.firstCell(),
    });
    combat = activeCombat;
    // Mouse and touch gestures live in the app's input layer, next to the keyboard and the gamepad
    // (plan 184 étape E): the scene keeps picking, projection and the camera, not the rules.
    pointerSource?.dispose();
    pointerSource = attachPointerSourceForScene(activeStage.canvas, activeCombat);
    overlay.setProgress(0.2);
    const [loaded] = await Promise.all([loadTiledMap(mapUrl), activeCombat.ready]);
    if (localAbort.signal.aborted) {
      overlay.cancel();
      return;
    }
    overlay.setProgress(0.6);
    orchestrator = startSandboxBattle({
      backend,
      combat: activeCombat,
      stage: activeStage,
      insets: probe,
      map: loaded.map,
      config,
      onExit: () => {
        teardownBattle();
        navigate("main-menu", undefined);
      },
      signal: localAbort.signal,
      onReplay: () => remount(config),
      onPositionsResolved: (resolved) => panel?.setResolvedPositions(resolved),
    });
    // Sandbox auto-spawns immediately → wait for those sprite atlases too before fading.
    await activeCombat.whenReady();
    if (localAbort.signal.aborted) {
      overlay.cancel();
      return;
    }
    overlay.setProgress(1);
    await overlay.finish();
  }

  function remount(config: SandboxConfig): void {
    if (disposed) {
      return;
    }
    teardownBattle();
    panel?.destroy();
    panel = new SandboxPanel(config, (next) => remount(next));
    void mountContent(config);
  }

  remount(initialConfig);

  return {
    dispose: () => {
      disposed = true;
      teardownBattle();
      panel?.destroy();
      panel = null;
    },
  };
}

export function createCombatScreen(navigate: Navigate, backend: RendererBackend): Screen<"combat"> {
  let stage: GameStage | null = null;
  let combat: CombatScene | null = null;
  let pointerSource: PointerSource | null = null;
  let placement: PlacementFlow | null = null;
  /** Chrome de la phase de placement (plan 189) : détruit au passage de relais à `runBattle`. */
  let placementChrome: PlacementChrome | null = null;
  let orchestrator: BattleOrchestrator | null = null;
  let loading: LoadingOverlayHandle | null = null;
  /** Measures the left chrome column so the compass parks clear of it (plan 183). */
  let insetProbe: ChromeInsetProbe | null = null;
  // Recreated on every (re)mount so a "Replay" tears down the previous keyboard
  // listeners cleanly (plan 120 step 8 — disposal parity with an FSM transition).
  let abort = new AbortController();

  function teardown(): void {
    abort.abort();
    loading?.cancel();
    loading = null;
    orchestrator?.dispose();
    orchestrator = null;
    placement?.dispose();
    placement = null;
    placementChrome?.dispose();
    placementChrome = null;
    pointerSource?.dispose();
    pointerSource = null;
    combat?.dispose();
    combat = null;
    insetProbe?.dispose();
    insetProbe = null;
    stage?.dispose();
    stage = null;
  }

  async function mountContent(
    host: HTMLElement,
    params: ScreenParamsById["combat"],
  ): Promise<void> {
    abort = new AbortController();
    const localAbort = abort;
    loading = showLoadingOverlay(host);
    const overlay = loading;
    const activeStage = mountGameStage(host);
    stage = activeStage;
    const setup = params.setup;
    const resume = params.resume;
    // A resumed battle carries the map it was played on; `params.mapUrl` and `resume.mapUrl` agree
    // today, but the saved one is the authority — the engine is rebuilt from it.
    const mapUrl = resume?.mapUrl ?? params.mapUrl;
    insetProbe?.dispose();
    insetProbe = createChromeInsetProbe(activeStage.stage);
    const probe = insetProbe;
    const activeCombat = backend.createCombatScene({
      canvas: activeStage.canvas,
      mapUrl,
      pokemon: setup || resume ? [] : DEMO_POKEMON,
      timelineFirstCell: () => probe.firstCell(),
    });
    combat = activeCombat;
    // Mouse and touch gestures live in the app's input layer, next to the keyboard and the gamepad
    // (plan 184 étape E): the scene keeps picking, projection and the camera, not the rules.
    pointerSource?.dispose();
    pointerSource = attachPointerSourceForScene(activeStage.canvas, activeCombat);
    overlay.setProgress(0.2);

    if (resume) {
      // Everything that can fail sits inside the try: a map fetch that dies on a flaky mobile network
      // — the very situation this feature serves — would otherwise strand the player under a loading
      // veil forever, save intact, failing again at every attempt.
      try {
        const [loaded] = await Promise.all([loadTiledMap(mapUrl), activeCombat.ready]);
        if (localAbort.signal.aborted) {
          overlay.cancel();
          return;
        }
        overlay.setProgress(0.6);
        // Only the sprite atlases have to be warm before the billboards appear, exactly as on the
        // placement path — the battle itself already has its position.
        await preloadCombatSprites(resume.setup.teams.flatMap((team) => team.pokemonDefinitionIds));
        if (localAbort.signal.aborted) {
          overlay.cancel();
          return;
        }
        orchestrator = startResumedBattle(
          backend,
          activeCombat,
          activeStage,
          probe,
          loaded.map,
          resume,
          navigate,
          abort.signal,
          // "Replay" from a resumed battle restarts its setup from the top — same placement→battle flow
          // as a fresh battle, minus the stale log.
          () => {
            teardown();
            void mountContent(host, { mapUrl: resume.mapUrl, setup: resume.setup });
          },
        );
      } catch (error) {
        // Nothing restorable: a log the engine rejects (changed data), a battle that turned out to be
        // already won, or a map/sprite fetch that failed. Drop the save and go back to the menu rather
        // than leave the player in a half-built battle or under an endless loading veil.
        // biome-ignore lint/suspicious/noConsole: diagnostic-only — a replay that fails is silent to the player (they land on the menu), and this is the only trace of why
        console.warn("[resume] battle replay failed, dropping the save:", error);
        battleResumeStore().clear();
        overlay.cancel();
        navigate("main-menu", undefined);
        return;
      }
      overlay.setProgress(1);
      await overlay.finish();
      return;
    }
    if (!setup) {
      mountDemoContent(activeCombat);
      await activeCombat.whenReady();
      if (localAbort.signal.aborted) {
        overlay.cancel();
        return;
      }
      overlay.setProgress(1);
      await overlay.finish();
      return;
    }
    // Placement is interactive, so the overlay fades once the map is paintable (not after the
    // player finishes placing) — but first warm the team sprite atlases so placed Pokémon appear
    // textured with no white-plane flash.
    await activeCombat.ready;
    if (localAbort.signal.aborted) {
      overlay.cancel();
      return;
    }
    overlay.setProgress(0.6);
    await preloadCombatSprites(setup.teams.flatMap((team) => team.pokemonDefinitionIds));
    if (localAbort.signal.aborted) {
      overlay.cancel();
      return;
    }
    overlay.setProgress(1);
    await overlay.finish();
    // "Replay" re-runs the whole placement→battle flow with the same config — an
    // internal re-mount, NOT an FSM navigation (plan 120 victory contract).
    const replay = (): void => {
      teardown();
      void mountContent(host, params);
    };
    /*
     * Monté AVANT le placement, détruit dès que le combat prend la main (plan 189).
     *
     * « Quitter » rend la main au menu principal sans rien purger : aucune sauvegarde n'existe encore,
     * le combat n'a pas commencé. « Recommencer » repasse par `replay`, donc par cette même phase.
     */
    placementChrome = mountPlacementChrome({
      stage: activeStage,
      onRestart: replay,
      onQuit: () => {
        teardown();
        navigate("main-menu", undefined);
      },
    });
    const placementFlow = await mountPlacement(
      activeCombat,
      activeStage,
      params.mapUrl,
      setup,
      (result, map) => {
        // Passage de relais : jamais deux menus vivants, sinon deux registrations se disputeraient
        // `Start` et le joueur en ouvrirait un au hasard.
        placementChrome?.dispose();
        placementChrome = null;
        orchestrator = startBattleLoop(
          backend,
          activeCombat,
          activeStage,
          probe,
          map,
          params.mapUrl,
          setup,
          result,
          navigate,
          abort.signal,
          replay,
        );
      },
      // Le flux route `Start` et `Échap` vers le menu que le chrome ci-dessus possède. Lu à l'appel et
      // non capturé : `placementChrome` est remis à null au passage de relais, et l'ouverture doit
      // cesser avec lui plutôt que de rouvrir un menu détruit.
      () => placementChrome?.open() ?? false,
    );
    /*
     * ⚠️ Le seul `await` de cette fonction qui n'avait pas sa garde, et le seul dont la fenêtre soit
     * devenue ATTEIGNABLE avec ce plan (signalé en revue de code, 2026-08-26).
     *
     * Le voile de chargement est déjà retiré quand `mountPlacement` part chercher la carte, et le
     * chrome du placement — donc « Quitter » et « Recommencer » — est à l'écran pendant ce fetch. Sans
     * cette garde, quitter là déclenchait `teardown()` puis laissait la promesse résoudre par-dessus :
     * un flux de placement monté sur une scène déjà disposée, avec sa registration d'entrée jamais
     * dépilée.
     */
    if (localAbort.signal.aborted) {
      placementFlow.dispose();
      return;
    }
    placement = placementFlow;
  }

  return {
    mount(host, params) {
      return mountContent(host, params);
    },
    dispose() {
      teardown();
    },
  };
}
