import {
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
import type { GameStage, UiDomConfig } from "@pokemon-tactic/ui-dom";
import { createBattleChrome, createBattleLog, mountGameStage } from "@pokemon-tactic/ui-dom";
import {
  AiTeamController,
  type BattleFeedback,
  BattleOrchestrator,
  type BattleSetupResult,
  createBattleFromPlacements,
  createFloatingTextSpawner,
  createSandboxBattle,
  DummyAiController,
  loadTiledMap,
  preloadCombatSprites,
  sandboxInstanceId,
} from "@pokemon-tactic/view-core";
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
import type { RendererBackend } from "../renderer-backend.js";
import { initSandboxStudioDom } from "../sandbox-boot.js";
import { getSettings } from "../settings/index.js";
import { getCategoryIconUrl, getTypeIconUrl, getWeatherIconUrl } from "../team/asset-paths.js";
import { buildTeamOverrides } from "../team/build-overrides.js";
import { getPortraitUrl } from "../team/team-builder-data.js";
import type { AiProfileKey, SandboxConfig } from "../types/SandboxConfig.js";
import { type LoadingOverlayHandle, showLoadingOverlay } from "../ui/LoadingOverlay.js";
import { SandboxPanel } from "../ui/SandboxPanel.js";
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
}): BattleOrchestrator {
  const { backend, combat, stage, battle, handles, onExit, signal, onReplay, wireTurnReady } =
    options;
  const board = backend.createBattleBoardView(combat, handles);
  // Host-injected i18n / asset-path deps for the reusable DOM chrome (plan 125 Phase 4).
  const uiConfig: UiDomConfig = {
    translate: (key, params) => t(key as TranslationKey, params),
    getLanguage,
    getTypeIconUrl,
    getCategoryIconUrl,
    getWeatherIconUrl,
    getPortraitUrl,
  };
  const chrome = createBattleChrome({
    host: stage.screenLayer,
    onExit,
    onReplay,
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
  stage.screenLayer.append(battleLog.element);
  // Host-injected presentation deps (plan 125, décision #4): the orchestrator +
  // view-builders + floating-text mapper stay renderer-agnostic; the app-shell
  // wires the real i18n / settings / asset-path here.
  const presentationContext: PresentationContext = {
    translate: (key, params) => t(key as TranslationKey, params),
    getLanguage,
    getPortraitUrl,
    getItemName: itemNameOf,
    getAbilityName: abilityNameOf,
    isDamagePreviewEnabled: () => getSettings().damagePreview,
  };
  const spawnFloatingText = createFloatingTextSpawner(combat, battle.state, {
    getPokemonName: pokemonNameOf,
    getAbilityName: abilityNameOf,
    getItemName: itemNameOf,
    getCurrentHp: (id) => battle.state.pokemon.get(id)?.currentHp ?? 0,
    translate: presentationContext.translate,
    getLanguage: presentationContext.getLanguage,
  });
  const feedback: BattleFeedback = {
    report: (event) => {
      battleLog.report(event);
      spawnFloatingText(event);
    },
  };
  const orchestrator = new BattleOrchestrator(
    battle.engine,
    battle.state,
    battle.moveDefinitions,
    board,
    chrome,
    feedback,
    { confirmAttack: BATTLE_CONFIRM_ATTACK },
    presentationContext,
  );
  orchestrator.onTurnReady = wireTurnReady(battle);

  combat.onTileClick((pick) => orchestrator.onTileClick({ x: pick.x, y: pick.y }));
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
  setup: CombatSetup,
  result: PlacementResult,
  navigate: Navigate,
  signal: AbortSignal,
  onReplay: () => void,
): BattleOrchestrator {
  const battle = createBattleFromPlacements({
    map,
    teams: result.placementTeams,
    placements: result.placements,
    // Single entropy source for a live battle: pick one seed here, then the engine's seeded
    // PRNG drives all combat RNG deterministically (replayable; no scattered Math.random).
    seed: randomSeed(),
    // Carry the team-builder customisation (moves, ability, item, nature, EVs)
    // into combat — keyed by instance id ("p1-pikachu") like the placements.
    ...buildTeamOverrides({ teams: setup.teams }),
  });
  const aiPlayerIds = result.placementTeams
    .filter((team) => team.controller === PlayerController.Ai)
    .map((team) => team.playerId);
  return runBattle({
    backend,
    combat,
    stage,
    battle,
    handles: result.handles,
    onExit: () => navigate("main-menu", undefined),
    signal,
    onReplay,
    wireTurnReady: (built) => wireScoredAi(built, aiPlayerIds),
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
  const handles = new Map<string, CombatPokemonHandle>();
  // Spawn every member, including one that starts fainted (hp:0 ally for Vœu Soin / revive
  // scenarios): the initial syncBoard poses it knocked-out, and a later revive re-shows it.
  for (const pokemon of battle.state.pokemon.values()) {
    const handle = combat.addPokemon({
      pokemonId: pokemon.definitionId,
      spawn: pokemon.position,
      team: pokemon.playerId === PlayerId.Player1 ? 1 : 2,
    });
    handle.setFacing(pokemon.orientation);
    handles.set(pokemon.id, handle);
  }

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
    const activeCombat = backend.createCombatScene({
      canvas: activeStage.canvas,
      mapUrl,
      pokemon: [],
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
    const activeCombat = backend.createCombatScene({
      canvas: activeStage.canvas,
      mapUrl: params.mapUrl,
      pokemon: params.setup ? [] : DEMO_POKEMON,
    });
    combat = activeCombat;
    overlay.setProgress(0.2);

    const setup = params.setup;
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
