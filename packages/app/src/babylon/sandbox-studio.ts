import {
  AiDifficulty,
  createPrng,
  Direction,
  type MapDefinition,
  PlayerId,
  profileForDifficulty,
} from "@pokemon-tactic/core";
import type { CombatScene } from "@pokemon-tactic/render-ports";
import type { ChromeInsetProbe, GameStage } from "@pokemon-tactic/ui-dom";
import { createChromeInsetProbe, mountGameStage } from "@pokemon-tactic/ui-dom";
import {
  AiTeamController,
  type BattleOrchestrator,
  createSandboxBattle,
  DummyAiController,
  loadTiledMap,
  sandboxInstanceId,
} from "@pokemon-tactic/view-core";
import type { Navigate } from "../app/screen-manager.js";
import type { PointerSource } from "../input/pointer-source.js";
import type { RendererBackend } from "../renderer-backend.js";
import { initSandboxStudioDom, teardownSandboxStudioDom } from "../sandbox-studio-dom.js";
import { getSettings } from "../settings/index.js";
import type { AiProfileKey, SandboxConfig } from "../types/SandboxConfig.js";
import { type LoadingOverlayHandle, showLoadingOverlay } from "../ui/LoadingOverlay.js";
import { SandboxPanel } from "../ui/SandboxPanel.js";
import {
  attachPointerSourceForScene,
  randomSeed,
  runBattle,
  spawnBillboardsFromState,
} from "./combat-screen.js";

/**
 * Profil d'une équipe du STUDIO SANDBOX. Le repli sur `"hard"` est propre au studio et reste ici,
 * **explicite au site d'appel** : c'est un outil de développement avec son propre contrat, pas le
 * défaut du jeu. Le défaut du jeu est `DEFAULT_AI_DIFFICULTY` (Moyenne), et il vit dans le core.
 */
function profileForKey(key: AiProfileKey | undefined) {
  return profileForDifficulty(key ?? AiDifficulty.Hard);
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

  // Le bac à sable n'a pas de sauvegarde : son temps de jeu est simplement celui de ce montage.
  const mountedAt = Date.now();

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
    // Le bac à sable n'a pas de configuration de partie : c'est le seul chemin de combat qui lit
    // encore la préférence persistée (plan 198).
    damagePreview: getSettings().damagePreview,
    getElapsedMs: () => Date.now() - mountedAt,
    // A "player" team is human-driven; hotseat (both teams player) hands the viewpoint over with the
    // turn, exactly like `viewerPlayerId` expects.
    humanPlayerIds: config.teams
      .map((team, index) => (team.control === "player" ? teamPlayerId(index) : null))
      .filter((playerId): playerId is PlayerId => playerId !== null),
    wireTurnReady: (built) => {
      const passiveByInstanceId = new Map<string, DummyAiController>();
      const scoredByPlayerId = new Map<PlayerId, AiTeamController>();
      config.teams.forEach((team, teamIndex) => {
        const playerId = teamPlayerId(teamIndex);
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
 * down then hands off to the FSM. `dispose()` also removes the studio chrome.
 *
 * Loaded through a dynamic `import()` behind a compile-time guard in `babylon-boot.ts` (plan 235),
 * so neither this module nor the studio chrome and CSS end up in the production bundle.
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
      teardownSandboxStudioDom();
    },
  };
}
