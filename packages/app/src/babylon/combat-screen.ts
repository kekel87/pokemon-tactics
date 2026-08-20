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
  createFullscreenButton,
  mountGameStage,
} from "@pokemon-tactic/ui-dom";
import {
  AiTeamController,
  type BattleFeedback,
  BattleOrchestrator,
  type BattleSetupResult,
  createFloatingTextSpawner,
  createSandboxBattle,
  DummyAiController,
  loadTiledMap,
  preloadCombatSprites,
  sandboxInstanceId,
} from "@pokemon-tactic/view-core";
import { type BattleResumeSave, battleResumeStore } from "../app/battle-persistence.js";
import type { Navigate, Screen } from "../app/screen-manager.js";
import type { CombatSetup, ScreenParamsById } from "../app/screens.js";
import {
  FIELD_TERRAIN_COLOR_ELECTRIC,
  FIELD_TERRAIN_COLOR_GRASSY,
  getTeamColorByPlayerId,
} from "../constants.js";
import { HighlightKind } from "../enums/highlight-kind.js";
import { getLanguage, t } from "../i18n/index.js";
import type { TranslationKey } from "../i18n/types.js";
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
  getStatusIconUrl,
  getStatusLabelUrl,
  getTypeIconUrl,
  getWeatherIconUrl,
} from "../team/asset-paths.js";
import { getItemIconUrl, getPortraitUrl } from "../team/team-builder-data.js";
import type { AiProfileKey, SandboxConfig } from "../types/SandboxConfig.js";
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

async function mountPlacement(
  combat: CombatScene,
  stage: GameStage,
  mapUrl: string,
  setup: CombatSetup,
  onComplete: (result: PlacementResult, map: MapDefinition) => void,
): Promise<PlacementFlow> {
  const [loaded] = await Promise.all([loadTiledMap(mapUrl), combat.ready]);
  const format =
    loaded.map.formats.find(
      (candidate) => `${candidate.teamCount}v${candidate.maxPokemonPerTeam}` === setup.formatKey,
    ) ?? loaded.map.formats[0];
  if (!format) {
    throw new Error(`Map "${mapUrl}" has no formats`);
  }
  return startPlacementFlow({
    combat,
    map: loaded.map,
    format,
    teams: setup.teams,
    autoPlacement: setup.autoPlacement,
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
  // Host-injected i18n / asset-path deps for the reusable DOM chrome (plan 125 Phase 4).
  const uiConfig: UiDomConfig = {
    translate: (key, params) => t(key as TranslationKey, params),
    getLanguage,
    getTypeIconUrl,
    getCategoryIconUrl,
    getWeatherIconUrl,
    getPortraitUrl,
    getItemIconUrl,
  };
  const chrome = createBattleChrome({
    host: stage.screenLayer,
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
  });
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
    },
    teamOf: (id) => {
      const pokemon = battle.state.pokemon.get(id);
      return pokemon ? Number(pokemon.playerId.match(/(\d+)/)?.[1] ?? "1") : null;
    },
    translate: uiConfig.translate,
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
  stage.screenLayer.append(createBattleLogRow(fullscreenButton.element, battleLog.element));
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
      if (event.type === BattleEventType.BattleEnded) {
        onBattleClosed?.();
      }
    },
  };
  const orchestrator = new BattleOrchestrator(
    battle.engine,
    battle.state,
    battle.moveDefinitions,
    board,
    chrome,
    feedback,
    { confirmAttack: BATTLE_CONFIRM_ATTACK, humanPlayerIds, onActionCommitted },
    presentationContext,
  );
  orchestrator.onTurnReady = wireTurnReady(battle);

  // The source travels with the press: a finger aiming a directional pattern needs a preview tap
  // before it commits, a mouse has already hovered (plan 183).
  combat.onTileClick((pick, source) => orchestrator.onTileClick({ x: pick.x, y: pick.y }, source));
  combat.onTileHover((pick) => orchestrator.onTileHover(pick ? { x: pick.x, y: pick.y } : null));
  combat.onCameraRotated((azimuth) => chrome.updateCameraAzimuth(azimuth));
  window.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        orchestrator.onEscape();
      } else if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        orchestrator.onConfirmKey();
      } else if (event.key === "Tab") {
        // Only swallowed while a multi-target confirm is open (plan 175): everywhere else Tab must
        // stay plain focus navigation. ←/→ were unavailable — they already rotate the camera.
        if (orchestrator.onCycleTargetKey(event.shiftKey ? -1 : 1)) {
          event.preventDefault();
        }
      }
    },
    { signal },
  );

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
    // Single entropy source for a live battle: pick one seed here, then the engine's seeded PRNG drives
    // all combat RNG deterministically (replayable; no scattered Math.random).
    seed: randomSeed(),
  };
  const battle = buildBattle(inputs, map);
  return runResolvedBattle({
    backend,
    combat,
    stage,
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
  battle: BattleSetupResult;
  handles: ReadonlyMap<string, CombatPokemonHandle>;
  mapUrl: string;
  inputs: BattleInputs;
  navigate: Navigate;
  signal: AbortSignal;
  onReplay: () => void;
  initialLogEvents?: readonly BattleEvent[];
}): BattleOrchestrator {
  const { backend, combat, stage, battle, handles, mapUrl, inputs, navigate, signal, onReplay } =
    options;
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
  map: MapDefinition;
  config: SandboxConfig;
  onExit: () => void;
  signal: AbortSignal;
  onReplay: () => void;
  /** Report the engine-resolved spawn tiles back to the studio panel. */
  onPositionsResolved?: (resolved: ResolvedSpawn[]) => void;
}): BattleOrchestrator {
  const { backend, combat, stage, map, config, onExit, signal, onReplay, onPositionsResolved } =
    options;
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
  let placement: PlacementFlow | null = null;
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
    placement = await mountPlacement(
      activeCombat,
      activeStage,
      params.mapUrl,
      setup,
      (result, map) => {
        orchestrator = startBattleLoop(
          backend,
          activeCombat,
          activeStage,
          map,
          params.mapUrl,
          setup,
          result,
          navigate,
          abort.signal,
          replay,
        );
      },
    );
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
