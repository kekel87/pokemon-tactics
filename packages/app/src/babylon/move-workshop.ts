import "../styles/move-workshop.css";
import {
  type Action,
  ActionKind,
  type BattleEvent,
  Direction,
  type MoveDefinition,
  type MoveFlags,
  PlayerId,
  type Position,
  StatName,
  TargetingKind,
  type TargetingPattern,
} from "@pokemon-tactic/core";
import { getMoveName, getPokemonName, getTypeName, loadData } from "@pokemon-tactic/data";
import {
  type CombatPokemonHandle,
  type CombatScene,
  type PresentationCue,
  PresentationCueKind,
} from "@pokemon-tactic/render-ports";
import {
  type ChromeInsetProbe,
  createChromeInsetProbe,
  mountGameStage,
} from "@pokemon-tactic/ui-dom";
import {
  type BattleOrchestrator,
  type BattleSetupResult,
  CombatSpeed,
  combatClock,
  createSandboxBattle,
  getResolvedAtlas,
  IMPACT_FRAME_MS,
  loadTiledMap,
  moveEffectForm,
  movePose,
  PMD_DEFAULT_FRAME_TICKS,
  PMD_TICK_DURATION_MS,
  type SandboxConfig,
  sandboxInstanceId,
  setCombatSpeed,
  targetRelation,
} from "@pokemon-tactic/view-core";
import type { AtelierConfig } from "../atelier-boot.js";
import { getLanguage, t } from "../i18n/index.js";
import type { TranslationKey } from "../i18n/types.js";
import type { RendererBackend } from "../renderer-backend.js";
import { getSettings } from "../settings/index.js";
import { getCategoryIconUrl, getTypeIconUrl } from "../team/asset-paths.js";
import { el } from "../ui/dom/screens/elements.js";
import {
  attachPointerSourceForScene,
  runBattle,
  spawnBillboardsFromState,
} from "./combat-screen.js";
import { type AttackFrames, MoveWorkshopTimeline } from "./move-workshop-timeline.js";

/** A plain grass board: no liquid or special terrain to muddy what the move looks like. */
const ATELIER_MAP_URL = "assets/maps/dev/atelier.tmj";
const DEFAULT_ATTACKER = "charizard";
/** Bulky and with a Hurt pose, so the reaction reads and the replays never knock it out. */
const DEFAULT_TARGET = "chansey";
/** The attacker stands at the west edge facing east; the targets fill the board in front of it. */
const ATTACKER_TILE: Position = { x: 0, y: 2 };
/**
 * A contact rank, a row behind it and a line further on: a single-target move hits the front one,
 * a line or a cone runs through several, a zone around the attacker catches the contact rank.
 */
const TARGET_TILES: readonly Position[] = [
  { x: 1, y: 2 },
  { x: 2, y: 1 },
  { x: 2, y: 2 },
  { x: 2, y: 3 },
  { x: 3, y: 2 },
  { x: 4, y: 2 },
];
/** Pause between two loops, so one attack's end and the next start don't blur. */
const LOOP_GAP_MS = 700;
interface WorkshopSpeed {
  label: TranslationKey;
  speed: CombatSpeed;
  slowMotion: number;
}

const NORMAL_SPEED: WorkshopSpeed = {
  label: "settings.combatSpeed.normal",
  speed: CombatSpeed.Normal,
  slowMotion: 1,
};
/** The combat speeds, plus two slow motions only the workshop offers. */
const WORKSHOP_SPEEDS: readonly WorkshopSpeed[] = [
  { label: "atelier.speedVerySlow", speed: CombatSpeed.Normal, slowMotion: 0.1 },
  { label: "atelier.speedSlow", speed: CombatSpeed.Normal, slowMotion: 0.25 },
  NORMAL_SPEED,
  { label: "settings.combatSpeed.instant", speed: CombatSpeed.Instant, slowMotion: 1 },
];
/** A scrub never steps more than this many frames (guards a run that never reaches its target). */
const MAX_SEEK_FRAMES = 2000;
/** Flags that say something about how a move LOOKS (the lot 2 effect shapes hang on them). */
const VISUAL_FLAGS: readonly (keyof MoveFlags)[] = [
  "contact",
  "punch",
  "bite",
  "slicing",
  "sound",
  "pulse",
  "bullet",
  "wind",
  "powder",
  "dance",
  "heal",
];

interface MoveRow {
  move: MoveDefinition;
  name: string;
  button: HTMLButtonElement;
}

/**
 * Atelier des attaques (plan 233, `pnpm dev:atelier`): a dedicated dev screen to watch any move
 * through the real combat path. The scene and the map are mounted once; « Rejouer » builds a fresh
 * engine and orchestrator on that same scene — no loading screen, full HP every time. The combat
 * chrome is hidden: the panel on the left is the whole interface.
 */
export function mountMoveWorkshop(
  host: HTMLElement,
  config: AtelierConfig,
  backend: RendererBackend,
): { dispose(): void } {
  document.body.dataset.atelier = "true";
  const language = getLanguage();
  const gameData = loadData();
  const compare = new Intl.Collator(language).compare;
  const abort = new AbortController();
  const signal = abort.signal;

  let attacker = config.attacker ?? DEFAULT_ATTACKER;
  let target = config.target ?? DEFAULT_TARGET;
  /** Aim the farthest target in reach instead of the nearest, to watch a projectile fly. */
  let aimFar = false;
  let loop = false;
  let speedIndex = WORKSHOP_SPEEDS.indexOf(NORMAL_SPEED);
  const currentSpeed = (): WorkshopSpeed => WORKSHOP_SPEEDS[speedIndex] ?? NORMAL_SPEED;
  const applySpeed = (): void => {
    setCombatSpeed(currentSpeed().speed);
    combatClock.setSlowMotion(currentSpeed().slowMotion);
  };
  applySpeed();

  // The panel takes its grid column BEFORE the stage mounts: the stage sizes its canvas on mount.
  const panel = el("aside", "aw-panel", "atelier-panel");
  host.before(panel);
  const timeline = new MoveWorkshopTimeline((atMs) => requestSeek(atMs));
  host.after(timeline.element);

  const stage = mountGameStage(host);
  const insets: ChromeInsetProbe = createChromeInsetProbe(stage.stage);
  const combat: CombatScene = backend.createCombatScene({
    canvas: stage.canvas,
    mapUrl: ATELIER_MAP_URL,
    pokemon: [],
    timelineFirstCell: () => insets.firstCell(),
  });
  const pointerSource = attachPointerSourceForScene(stage.canvas, combat);
  const mapReady = Promise.all([loadTiledMap(ATELIER_MAP_URL), combat.ready]).then(
    ([loaded]) => loaded.map,
  );

  let battleAbort = new AbortController();
  let orchestrator: BattleOrchestrator | null = null;
  let handles = new Map<string, CombatPokemonHandle>();
  /** Attacker + target species of the sprites on the board, reused while they don't change. */
  let spawnedCast: string | null = null;
  let awaitingAttackEnd = false;

  const title = el("h1", "aw-title");
  title.textContent = t("atelier.title");

  const search = el("input", "aw-search", "atelier-search");
  search.type = "search";
  search.placeholder = t("atelier.search");

  const moves = [...gameData.moves].sort((a, b) =>
    compare(getMoveName(a.id, language), getMoveName(b.id, language)),
  );
  const typeFilter = filterSelect(
    "atelier-filter-type",
    "atelier.allTypes",
    [...new Set(moves.map((move) => move.type))]
      .map((type) => ({ value: type, label: getTypeName(type, language) }))
      .sort((a, b) => compare(a.label, b.label)),
  );
  const categoryFilter = filterSelect(
    "atelier-filter-category",
    "atelier.allCategories",
    [...new Set(moves.map((move) => move.category))].map((category) => ({
      value: category,
      label: t(`moveCategory.${category}` as TranslationKey),
    })),
  );
  const patternFilter = filterSelect(
    "atelier-filter-pattern",
    "atelier.allPatterns",
    Object.values(TargetingKind).map((kind) => ({ value: kind, label: patternLabel(kind) })),
  );
  const styleFilter = filterSelect(
    "atelier-filter-style",
    "atelier.allStyles",
    VISUAL_FLAGS.map((flag) => ({
      value: flag,
      label: t(`atelier.flag.${flag}` as TranslationKey),
    })),
  );
  const filters = el("div", "aw-filters");
  filters.append(typeFilter, categoryFilter, patternFilter, styleFilter);

  const count = el("p", "aw-count", "atelier-count");
  const list = el("ul", "aw-list", "atelier-list");
  const rows: MoveRow[] = moves.map((move) => {
    const name = getMoveName(move.id, language);
    const button = el("button", "aw-move", `atelier-move-${move.id}`);
    button.type = "button";
    button.dataset.moveId = move.id;
    button.append(
      icon(getTypeIconUrl(move.type), "aw-type-icon"),
      textSpan(name, "aw-move-name"),
      icon(getCategoryIconUrl(move.category), "aw-category-icon"),
      textSpan(patternLabel(move.targeting.kind), "aw-move-pattern"),
    );
    const item = el("li");
    item.append(button);
    list.append(item);
    return { move, name, button };
  });
  let selected: MoveRow | null = null;

  const sheet = el("section", "aw-sheet", "atelier-sheet");

  const transportButton = (
    testId: string,
    text: string,
    label: TranslationKey,
  ): HTMLButtonElement => {
    const button = el("button", "tb-btn aw-transport-button", testId);
    button.type = "button";
    button.textContent = text;
    button.setAttribute("aria-label", t(label));
    button.title = t(label);
    return button;
  };
  const restart = transportButton("atelier-restart", "⏮", "atelier.restart");
  const previousFrame = transportButton("atelier-previous-frame", "◀|", "atelier.previousFrame");
  const playPause = transportButton("atelier-play-pause", "", "atelier.playPause");
  const nextFrame = transportButton("atelier-next-frame", "|▶", "atelier.nextFrame");
  const speedButton = el("button", "tb-btn aw-speed", "atelier-speed");
  speedButton.type = "button";
  const loopLabel = el("label", "aw-loop");
  const loopBox = el("input", undefined, "atelier-loop");
  loopBox.type = "checkbox";
  loopLabel.append(loopBox, textSpan(t("atelier.loop")));
  timeline.controls.prepend(restart, previousFrame, playPause, nextFrame, speedButton, loopLabel);
  const keysHint = el("p", "aw-hint");
  keysHint.textContent = t("atelier.keysHint");

  const pokemonOptions = gameData.pokemon
    .map((pokemon) => ({ value: pokemon.id, label: getPokemonName(pokemon.id, language) }))
    .sort((a, b) => compare(a.label, b.label));
  const attackerSelect = pokemonSelect("atelier-attacker", attacker);
  const targetSelect = pokemonSelect("atelier-target", target);
  const aimFarLabel = el("label", "aw-loop");
  const aimFarBox = el("input", undefined, "atelier-aim-far");
  aimFarBox.type = "checkbox";
  aimFarLabel.append(aimFarBox, textSpan(t("atelier.aimFar")));
  const cast = el("div", "aw-cast");
  cast.append(
    labelled(t("atelier.attacker"), attackerSelect),
    labelled(t("atelier.target"), targetSelect),
    aimFarLabel,
  );

  panel.append(title, search, filters, count, list, sheet, keysHint, cast);

  const visibleRows = (): MoveRow[] => rows.filter((row) => !row.button.parentElement?.hidden);

  const applyFilters = (): void => {
    const query = search.value.trim().toLocaleLowerCase(language);
    let shown = 0;
    for (const row of rows) {
      const visible =
        (query === "" || row.name.toLocaleLowerCase(language).includes(query)) &&
        (typeFilter.value === "" || row.move.type === typeFilter.value) &&
        (categoryFilter.value === "" || row.move.category === categoryFilter.value) &&
        (patternFilter.value === "" || row.move.targeting.kind === patternFilter.value) &&
        (styleFilter.value === "" ||
          row.move.flags?.[styleFilter.value as keyof MoveFlags] === true);
      const item = row.button.parentElement;
      if (item) {
        item.hidden = !visible;
      }
      shown += visible ? 1 : 0;
    }
    count.textContent = t("atelier.count", { shown, total: rows.length });
  };

  const select = (row: MoveRow): void => {
    selected?.button.removeAttribute("aria-current");
    selected = row;
    row.button.setAttribute("aria-current", "true");
    row.button.scrollIntoView({ block: "nearest" });
    renderSheet(sheet, row.move, row.name);
    void prime();
  };

  const step = (delta: number): void => {
    const shown = visibleRows();
    if (shown.length === 0) {
      return;
    }
    const index = selected ? shown.indexOf(selected) : -1;
    const next = shown[(index + delta + shown.length) % shown.length];
    if (next) {
      select(next);
      next.button.focus();
    }
  };

  /** The attack played out: ▶ then restarts from zero. */
  const attackEnded = (): boolean => {
    const position = timeline.position();
    const end = timeline.endMs();
    return position !== null && end !== null && position >= end;
  };

  const refreshPlayPause = (): void => {
    const label = combatClock.isPaused || attackEnded() ? "▶" : "⏸";
    if (playPause.textContent !== label) {
      playPause.textContent = label;
    }
  };

  const refreshSpeedLabel = (): void => {
    speedButton.textContent = t("atelier.speedLabel", { speed: t(currentSpeed().label) });
  };

  /** Fresh engine + orchestrator on the mounted scene, then the attacker strikes on its own turn. */
  async function play(): Promise<void> {
    const row = selected;
    if (!row) {
      return;
    }
    battleAbort.abort();
    battleAbort = new AbortController();
    const battleSignal = battleAbort.signal;
    orchestrator?.dispose();
    // The dead run's pending waits (its attack's safety net…) must not fire into the new one.
    combatClock.clearTimers();
    orchestrator = null;
    // Nor its effects still in flight (a projectile half-way, a fading puff).
    combat.clearMoveEffects();

    const map = await mapReady;
    if (battleSignal.aborted) {
      return;
    }
    const targetTiles = targetTilesFor(row.move);
    const battle = createSandboxBattle(
      battleConfig(row.move.id, attacker, target, targetTiles),
      map,
    );
    const cast = `${attacker}|${target}`;
    if (cast === spawnedCast) {
      // Same Pokémon: put the sprites back in place instead of respawning them — a respawn
      // reloads their atlases and makes every replay (and every scrub backwards) flicker.
      for (const pokemon of battle.state.pokemon.values()) {
        const handle = handles.get(pokemon.id);
        handle?.setKnockedOut(false);
        // Back to the resting pose: no hit-stop, flash, blink or Hurt pose left from the last run.
        handle?.resetPresentation();
        handle?.moveTo(pokemon.position);
        handle?.setFacing(pokemon.orientation);
        handle?.updateHp(pokemon.currentHp, pokemon.maxHp);
      }
    } else {
      for (const handle of handles.values()) {
        combat.removePokemon(handle);
      }
      handles = spawnBillboardsFromState(combat, battle.state);
      spawnedCast = cast;
    }
    await combat.whenReady();
    if (battleSignal.aborted) {
      return;
    }
    awaitingAttackEnd = true;
    timeline.prepare(
      [row.move.id, attacker, target, aimFar, currentSpeed().speed === CombatSpeed.Instant].join(
        "|",
      ),
      currentSpeed().speed === CombatSpeed.Instant
        ? { durationsMs: [], hitFrame: null }
        : attackFrames(row.move, attacker),
      animationFrames(target, "Hurt").durationsMs,
    );
    orchestrator = runBattle({
      backend,
      combat,
      stage,
      insets,
      battle,
      handles,
      onExit: () => undefined,
      signal: battleSignal,
      onReplay: () => void play(),
      wireTurnReady: (built) => {
        // Speed stages don't decide the first turn: a slower attacker would leave a target to act
        // first, and the workshop would wait for it forever. The targets pass until the attacker
        // has struck — twice for a two-turn move (charge, then release) — then the run stops on a
        // target's turn.
        const turnsNeeded = row.move.twoTurnCharge === true ? 2 : 1;
        let attackerTurns = 0;
        return (activePokemonId) => {
          if (activePokemonId === attackerInstanceId(attacker) && attackerTurns < turnsNeeded) {
            attackerTurns++;
            return strike(built, row.move.id, aimFar);
          }
          return attackerTurns >= turnsNeeded ? false : passTurn(built);
        };
      },
      enemyInfoHidden: false,
      damagePreview: false,
      humanPlayerIds: [PlayerId.Player1],
      getElapsedMs: () => 0,
      onPresentationCue: onCue,
      turnCries: false,
    });
  }

  function onCue(cue: PresentationCue): void {
    timeline.onCue(cue);
    if (cue.kind === PresentationCueKind.AttackEnd && awaitingAttackEnd) {
      awaitingAttackEnd = false;
      if (loop && !combatClock.isPaused) {
        setTimeout(() => {
          if (!signal.aborted) {
            void play();
          }
        }, LOOP_GAP_MS);
      }
    }
  }

  /**
   * Run the attack once silently — paused clock, stepped to its end in one go, nothing painted — so
   * the sequence knows its full length before the first visible frame, then play it from zero.
   */
  async function prime(): Promise<void> {
    combatClock.setPaused(true);
    await play();
    for (let frame = 0; frame < MAX_SEEK_FRAMES && timeline.endMs() === null; frame++) {
      if (signal.aborted || pendingSeekMs !== null) {
        return;
      }
      combat.stepFrame(IMPACT_FRAME_MS);
      await flushMicrotasks();
    }
    restartAttack();
  }

  /** From the start, running. */
  function restartAttack(): void {
    combatClock.setPaused(false);
    refreshPlayPause();
    void play();
  }

  function togglePlay(): void {
    if (attackEnded()) {
      restartAttack();
      return;
    }
    combatClock.setPaused(!combatClock.isPaused);
    refreshPlayPause();
  }

  // Scrub: the latest request wins; one seek runs at a time.
  let pendingSeekMs: number | null = null;
  let seeking = false;
  function requestSeek(atMs: number): void {
    pendingSeekMs = atMs;
    if (seeking) {
      return;
    }
    seeking = true;
    void (async () => {
      while (pendingSeekMs !== null && !signal.aborted) {
        const target = pendingSeekMs;
        pendingSeekMs = null;
        await seek(target);
      }
      seeking = false;
    })();
  }

  /**
   * Pause and bring the attack to `targetMs`: forward by stepping the paused combat clock frame by
   * frame; backward by replaying from the start (the run is deterministic) and stepping up to it.
   */
  async function seek(targetMs: number): Promise<void> {
    combatClock.setPaused(true);
    refreshPlayPause();
    const position = timeline.position();
    if (position === null || targetMs < position) {
      await play();
    }
    for (let frame = 0; frame < MAX_SEEK_FRAMES; frame++) {
      if (signal.aborted || pendingSeekMs !== null) {
        return;
      }
      const at = timeline.position();
      if (at !== null && at >= targetMs) {
        return;
      }
      combat.stepFrame(at === null ? IMPACT_FRAME_MS : Math.min(IMPACT_FRAME_MS, targetMs - at));
      // Let the orchestrator's promise chain run between two frames, as it would live — in
      // microtasks only, so the browser never paints a half-way frame of the scrub.
      await flushMicrotasks();
    }
  }

  /** To the previous / next frame of the attacker's sprite (a cell of the sequence). */
  function stepByFrame(direction: 1 | -1): void {
    requestSeek(timeline.frameBoundary(timeline.position() ?? 0, direction));
  }

  search.addEventListener("input", applyFilters, { signal });
  for (const filter of [typeFilter, categoryFilter, patternFilter, styleFilter]) {
    filter.addEventListener("change", applyFilters, { signal });
  }
  list.addEventListener(
    "click",
    (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".aw-move");
      const row = rows.find((candidate) => candidate.button === button);
      if (row) {
        select(row);
      }
    },
    { signal },
  );
  restart.addEventListener("click", () => requestSeek(0), { signal });
  playPause.addEventListener("click", togglePlay, { signal });
  previousFrame.addEventListener("click", () => stepByFrame(-1), { signal });
  nextFrame.addEventListener("click", () => stepByFrame(1), { signal });
  speedButton.addEventListener(
    "click",
    () => {
      speedIndex = (speedIndex + 1) % WORKSHOP_SPEEDS.length;
      applySpeed();
      refreshSpeedLabel();
    },
    { signal },
  );
  loopBox.addEventListener(
    "change",
    () => {
      loop = loopBox.checked;
    },
    { signal },
  );
  attackerSelect.addEventListener(
    "change",
    () => {
      attacker = attackerSelect.value;
      void prime();
    },
    { signal },
  );
  targetSelect.addEventListener(
    "change",
    () => {
      target = targetSelect.value;
      void prime();
    },
    { signal },
  );
  aimFarBox.addEventListener(
    "change",
    () => {
      aimFar = aimFarBox.checked;
      void prime();
    },
    { signal },
  );
  // The workshop owns its keys: ↑/↓ walk the filtered list, ←/→ step a frame, Space plays/pauses.
  document.addEventListener(
    "keydown",
    (event) => {
      const typing = event.target === search;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        step(event.key === "ArrowDown" ? 1 : -1);
      } else if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && !typing) {
        stepByFrame(event.key === "ArrowRight" ? 1 : -1);
      } else if (event.key === " " && !typing) {
        togglePlay();
      } else {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    },
    { signal },
  );

  refreshSpeedLabel();
  // The visual end can come after the last cue (a blink outlasting the action): follow it each frame.
  let playPauseFrame = 0;
  const followPlayPause = (): void => {
    refreshPlayPause();
    playPauseFrame = requestAnimationFrame(followPlayPause);
  };
  followPlayPause();
  applyFilters();
  const initial = rows.find((row) => row.move.id === config.move) ?? rows[0];
  if (initial) {
    select(initial);
  }

  return {
    dispose: () => {
      abort.abort();
      cancelAnimationFrame(playPauseFrame);
      battleAbort.abort();
      orchestrator?.dispose();
      pointerSource?.dispose();
      combat.dispose();
      insets.dispose();
      stage.dispose();
      panel.remove();
      timeline.dispose();
      combatClock.setPaused(false);
      combatClock.setSlowMotion(1);
      // The workshop's speed must not leak into a later battle: back to the player's setting.
      setCombatSpeed(getSettings().combatSpeed);
      delete document.body.dataset.atelier;
    },
  };

  function filterSelect(
    testId: string,
    allLabel: TranslationKey,
    options: readonly { value: string; label: string }[],
  ): HTMLSelectElement {
    const filter = el("select", "aw-filter", testId);
    filter.append(new Option(t(allLabel), ""));
    for (const option of options) {
      filter.append(new Option(option.label, option.value));
    }
    return filter;
  }

  function pokemonSelect(testId: string, value: string): HTMLSelectElement {
    const choice = el("select", "aw-filter", testId);
    for (const option of pokemonOptions) {
      choice.append(new Option(option.label, option.value));
    }
    choice.value = value;
    return choice;
  }
}

/** The fight the workshop stages: the attacker alone on one side, sturdy slow targets on the other. */
function battleConfig(
  moveId: string,
  attacker: string,
  target: string,
  targetTiles: readonly Position[],
): SandboxConfig {
  return {
    teams: [
      {
        control: "player",
        members: targetTiles.map((position) => ({
          pokemon: target,
          position,
          direction: Direction.West,
          // Sturdy, so the replays never knock them out (who acts first is settled by passing).
          statStages: { [StatName.Defense]: 6, [StatName.SpDefense]: 6 },
        })),
      },
      {
        control: "player",
        members: [
          {
            pokemon: attacker,
            moves: [moveId],
            position: ATTACKER_TILE,
            direction: Direction.East,
            statStages: { [StatName.Accuracy]: 6 },
          },
        ],
      },
    ],
    rngMode: "deterministic",
    seed: 1,
  };
}

/** The attacker's attack animation frame by frame — the one the combat plays for this move. */
function attackFrames(move: MoveDefinition, attacker: string): AttackFrames {
  return animationFrames(attacker, movePose(move));
}

/** One animation of a species' sprite, frame by frame (falls back to Attack, as the combat does). */
function animationFrames(species: string, animation: string): AttackFrames {
  const animations = getResolvedAtlas(species).atlasJson.meta.animations ?? {};
  const meta = animations[animation] ?? (animation === "Hurt" ? undefined : animations.Attack);
  return {
    durationsMs: (meta?.durations ?? []).map(
      (ticks) => Math.max(1, ticks || PMD_DEFAULT_FRAME_TICKS) * PMD_TICK_DURATION_MS,
    ),
    hitFrame: meta?.hitFrame ?? null,
  };
}

/** Promise chains awaited between two scrub frames are at most this deep. */
const MICROTASK_FLUSH_DEPTH = 32;

/** Let pending promise chains run without yielding to the browser (no paint in between). */
async function flushMicrotasks(): Promise<void> {
  for (let depth = 0; depth < MICROTASK_FLUSH_DEPTH; depth++) {
    await Promise.resolve();
  }
}

/**
 * Where the targets stand for this move: the formation, pushed back one tile for a dash so the
 * attacker actually charges before the blow (with a target in contact it would have no run-up).
 */
function targetTilesFor(move: MoveDefinition): readonly Position[] {
  if (move.targeting.kind !== TargetingKind.Dash || move.targeting.maxDistance < 2) {
    return TARGET_TILES;
  }
  return TARGET_TILES.map((tile) => ({ x: tile.x + 1, y: tile.y }));
}

/** A target's turn before the attack: end it in place, facing the attacker. */
function passTurn(built: BattleSetupResult): BattleEvent[] {
  const endTurn = built.engine
    .getLegalActions(PlayerId.Player1)
    .find((action) => action.kind === ActionKind.EndTurn && action.direction === Direction.West);
  if (!endTurn) {
    return [];
  }
  const result = built.engine.submitAction(PlayerId.Player1, endTurn);
  return result.success ? result.events : [];
}

function attackerInstanceId(attacker: string): string {
  return sandboxInstanceId(1, 0, attacker);
}

/**
 * The attacker's turn: play the move on the best target — a tile holding a target, on the
 * attacker's own row first, nearest first (farthest first with `aimFar`) — then end the turn facing
 * the targets.
 */
function strike(built: BattleSetupResult, moveId: string, aimFar: boolean): BattleEvent[] {
  const events: BattleEvent[] = [];
  const occupied = new Set(
    [...built.state.pokemon.values()]
      .filter((pokemon) => pokemon.playerId === PlayerId.Player1)
      .map((pokemon) => `${pokemon.position.x},${pokemon.position.y}`),
  );
  const score = (action: Action): number => {
    if (action.kind !== ActionKind.UseMove) {
      return Number.NEGATIVE_INFINITY;
    }
    const { x, y } = action.targetPosition;
    const onTarget = occupied.has(`${x},${y}`) ? 1000 : 0;
    const reach = Math.abs(x - ATTACKER_TILE.x);
    return onTarget - Math.abs(y - ATTACKER_TILE.y) * 10 + (aimFar ? reach : -reach);
  };
  const moveActions = built.engine
    .getLegalActions(PlayerId.Player2)
    .filter((action) => action.kind === ActionKind.UseMove && action.moveId === moveId)
    .sort((a, b) => score(b) - score(a));
  const best = moveActions[0];
  if (best) {
    const result = built.engine.submitAction(PlayerId.Player2, best);
    if (result.success) {
      events.push(...result.events);
    }
  }
  const endTurn = built.engine
    .getLegalActions(PlayerId.Player2)
    .find((action) => action.kind === ActionKind.EndTurn && action.direction === Direction.East);
  if (endTurn) {
    const result = built.engine.submitAction(PlayerId.Player2, endTurn);
    if (result.success) {
      events.push(...result.events);
    }
  }
  return events;
}

function renderSheet(sheet: HTMLElement, move: MoveDefinition, name: string): void {
  const language = getLanguage();
  const heading = el("h2", "aw-sheet-title");
  heading.textContent = name;
  const facts = el("dl", "aw-facts");
  const flags = VISUAL_FLAGS.filter((flag) => move.flags?.[flag]).map((flag) =>
    t(`atelier.flag.${flag}` as TranslationKey),
  );
  const entries: [TranslationKey, string][] = [
    ["atelier.type", getTypeName(move.type, language)],
    ["atelier.category", t(`moveCategory.${move.category}` as TranslationKey)],
    ["atelier.power", move.power > 0 ? String(move.power) : "—"],
    ["atelier.accuracy", move.accuracy > 0 ? t("atelier.percent", { value: move.accuracy }) : "—"],
    ["atelier.pattern", patternLabel(move.targeting.kind)],
    ["atelier.range", rangeLabel(move.targeting)],
    ["atelier.flags", flags.length > 0 ? flags.join(", ") : "—"],
    [
      "atelier.effect",
      t(`atelier.form.${moveEffectForm(move, targetRelation(move))}` as TranslationKey),
    ],
  ];
  for (const [label, value] of entries) {
    const term = el("dt");
    term.textContent = t(label);
    const detail = el("dd");
    detail.textContent = value;
    facts.append(term, detail);
  }
  sheet.replaceChildren(heading, facts);
}

function patternLabel(kind: string): string {
  return t(`pattern.${kind}` as TranslationKey);
}

/** Reach of a targeting pattern, in tiles. */
function rangeLabel(pattern: TargetingPattern): string {
  switch (pattern.kind) {
    case TargetingKind.Single:
    case TargetingKind.Cone:
    case TargetingKind.Blast:
    case TargetingKind.Teleport:
    case TargetingKind.GroundTarget:
      return span(pattern.range.min, pattern.range.max);
    case TargetingKind.HitAndRun:
      return span(pattern.hitRange.min, pattern.hitRange.max);
    case TargetingKind.Line:
      return String(pattern.length);
    case TargetingKind.Dash:
      return String(pattern.maxDistance);
    case TargetingKind.Zone:
      return t("atelier.radius", { radius: pattern.radius });
    case TargetingKind.Cross:
      return String(pattern.size);
    default:
      return "—";
  }
}

function span(min: number, max: number): string {
  return min === max ? String(min) : `${min}–${max}`;
}

function icon(src: string, className: string): HTMLImageElement {
  const image = el("img", className);
  image.src = src;
  image.alt = "";
  return image;
}

function textSpan(text: string, className?: string): HTMLSpanElement {
  const node = el("span", className);
  node.textContent = text;
  return node;
}

function labelled(text: string, control: HTMLElement): HTMLLabelElement {
  const label = el("label", "aw-labelled");
  label.append(textSpan(text), control);
  return label;
}
