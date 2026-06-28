import {
  type Action,
  ActionKind,
  AURA_RADIUS,
  type BattleEngine,
  type BattleEvent,
  BattleEventType,
  type BattleState,
  Category,
  type Direction,
  directionFromTo,
  enumerateHitAndRunRetreatTiles,
  FieldTerrain,
  type MoveDefinition,
  manhattanDistance,
  moveCtTempo,
  type PokemonInstance,
  PokemonType,
  type Position,
  resolveBlastImpactTile,
  resolveTargeting,
  SemiInvulnerableState,
  StatusType,
  stepInDirection,
  TargetingKind,
  Weather,
} from "@pokemon-tactic/core";
import { AnimationCategory, moveAnimationCategory } from "@pokemon-tactic/data";
import { getTeamColorByPlayerId } from "@pokemon-tactic/render-ports";
import { AnimationQueue } from "./AnimationQueue.js";
import { buildInfoPanelView, buildTimelineView, buildWeatherView } from "./battle-views.js";
import {
  AURA_INDICATOR_SYMBOL,
  BATTLE_TEXT_QUEUE_DELAY_MS,
  CHARGING_INDICATOR_ID,
  CHARGING_INDICATOR_SYMBOL,
  DAMAGE_FLASH_TOTAL_MS,
  DISTORTION_ZONE_COLOR,
  FIELD_TERRAIN_COLOR_ELECTRIC,
  FIELD_TERRAIN_COLOR_GRASSY,
  FIELD_TERRAIN_COLOR_MISTY,
  FIELD_TERRAIN_COLOR_PSYCHIC,
  PERISH_AURA_INDICATOR_SYMBOL,
} from "./constants.js";
import { moveIntent, selfPreviewRadius } from "./move-intent.js";

/**
 * Battle loop orchestrator (plan 120 step 7b) — the engine-agnostic input FSM.
 * It owns the nine combat input states, calls
 * the core for every rule (legal actions, action submission, retreat tiles) and
 * sequences the resulting events through an `AnimationQueue`. It talks ONLY to
 * the three ports below, so it imports nothing from any renderer.
 *
 * Scope (décision: minimal loop): the board is re-synced from engine state after
 * each action (sprites snap to their final tile, KO'd Pokémon faint in place),
 * with a short pacing delay so multi-step/AI turns stay watchable. Fluid path
 * tweens, HP bars, status icons and floating text land at 4b/4c.
 */

import type {
  AttackSubmenuMoveView,
  BattleChrome,
  BattleFeedback,
  BattleOrchestratorConfig,
  BlockedMoveTag,
  BoardAuraIndicator,
  BoardDamageEstimate,
  BoardView,
  DirectionPickerHandle,
  PresentationContext,
  SemiInvulnerableDisplay,
} from "@pokemon-tactic/render-ports";

// Ports + chrome/board view-models live in the renderer contract package (plan
// 125). Re-exported here so existing importers keep resolving while the
// orchestrator moves to `@pokemon-tactic/view-core` in a later phase.
export type {
  ActionMenuView,
  AttackPreviewKind,
  AttackSubmenuMoveView,
  AttackSubmenuView,
  BattleChrome,
  BattleFeedback,
  BattleInstruction,
  BattleOrchestratorConfig,
  BlockedMoveTag,
  BoardAuraIndicator,
  BoardDamageEstimate,
  BoardFieldTerrain,
  BoardHighlight,
  BoardView,
  DirectionPickerCallbacks,
  DirectionPickerHandle,
  SelectedMoveView,
  SemiInvulnerableDisplay,
  TurnInfoView,
} from "@pokemon-tactic/render-ports";

/** Pacing between board-affecting events in the minimal loop (not a tween — a beat to follow the action). */
const BATTLE_STEP_DELAY_MS = 180;

/** Zone identity colour per field terrain ("Champs"). */
const FIELD_TERRAIN_COLOR: Record<FieldTerrain, number> = {
  [FieldTerrain.Grassy]: FIELD_TERRAIN_COLOR_GRASSY,
  [FieldTerrain.Electric]: FIELD_TERRAIN_COLOR_ELECTRIC,
  [FieldTerrain.Misty]: FIELD_TERRAIN_COLOR_MISTY,
  [FieldTerrain.Psychic]: FIELD_TERRAIN_COLOR_PSYCHIC,
};

/** Predicted slots shown in the Charge-Time timeline (deep enough to see a mon's repeated turns). */
const CT_TIMELINE_SLOTS = 48;

type InputState =
  | { phase: "action_menu" }
  | { phase: "select_move_destination" }
  | { phase: "attack_submenu" }
  | { phase: "select_attack_target"; moveId: string }
  | { phase: "confirm_attack"; moveId: string; action: Action }
  | { phase: "select_retreat_target"; moveId: string; action: Action; retreatTiles: Position[] }
  | { phase: "select_direction" }
  | { phase: "animating" }
  | { phase: "battle_over"; winnerId: string | null };

const BOARD_EVENT_TYPES = new Set<string>([
  BattleEventType.PokemonMoved,
  BattleEventType.PokemonDashed,
  BattleEventType.Teleported,
  BattleEventType.HitAndRunRetreat,
  // PokemonKo / PokemonEliminated are handled explicitly in applyEvents (they pace
  // the beat on the real Faint animation length, not the fixed step delay).
  // A cancelled charge (caster KO'd / target gone before turn 2): re-sync at the
  // cancel beat so the ⚡ indicator clears, the flyer lands and the caster snaps
  // back, instead of only correcting on the final sync (parity GameController).
  BattleEventType.MoveCancelled,
  // Terrain-inflicted status (e.g. ending a turn on a marsh → poisoned): re-sync at
  // the event beat so the status icon shows immediately, not only on the final sync.
  BattleEventType.TerrainStatusApplied,
]);

function semiInvulnerableDisplay(
  state: PokemonInstance["semiInvulnerableState"],
): SemiInvulnerableDisplay {
  if (state === SemiInvulnerableState.Flying) {
    return "flying";
  }
  return state === undefined ? null : "underground";
}

export class BattleOrchestrator {
  /** AI hook (set by the host). Returns the active Pokémon's queued events, or `false` for a human turn. */
  onTurnReady: ((activePokemonId: string) => BattleEvent[] | false) | null = null;

  private readonly queue = new AnimationQueue();
  private inputState: InputState = { phase: "animating" };
  private legalActions: Action[] = [];
  private picker: DirectionPickerHandle | null = null;
  private hoveredTile: Position | null = null;
  /** Enemy whose reachable-tile range is currently painted on hover (null = none). */
  private hoveredEnemyRangePokemonId: string | null = null;
  private previewDirection: Direction | null = null;
  /** Tiles of the current attack-target preview footprint (drives the confirm-phase flash). */
  private previewTiles: readonly Position[] = [];
  private disposed = false;

  constructor(
    private readonly engine: BattleEngine,
    private readonly state: BattleState,
    private readonly moveDefinitions: ReadonlyMap<string, MoveDefinition>,
    private readonly board: BoardView,
    private readonly chrome: BattleChrome,
    private readonly feedback: BattleFeedback,
    private readonly config: BattleOrchestratorConfig,
    private readonly context: PresentationContext,
  ) {}

  /** Drain startup events (weather/abilities) then hand the first turn to the FSM. */
  start(): void {
    const startupEvents = this.engine.consumeStartupEvents();
    if (startupEvents.length > 0) {
      this.enqueueEvents(startupEvents, () => this.refreshUI());
    } else {
      this.refreshUI();
    }
  }

  dispose(): void {
    this.disposed = true;
    this.picker?.dispose();
    this.picker = null;
    this.board.setActive(null);
    this.chrome.hideMenus();
    this.chrome.updateInfoPanel(null);
    this.chrome.updateWeather(null);
  }

  // --- Raw input entry points (wired by the combat screen: picking + keyboard) ---

  onTileClick(tile: Position): void {
    const phase = this.inputState;
    switch (phase.phase) {
      case "select_move_destination":
        this.tryMoveTo(tile);
        break;
      case "select_attack_target":
        this.tryPickTarget(phase.moveId, tile);
        break;
      case "confirm_attack":
        this.resolveAttack(phase.moveId, phase.action);
        break;
      case "select_retreat_target":
        this.tryPickRetreat(phase, tile);
        break;
      default:
        break;
    }
  }

  onEscape(): void {
    const phase = this.inputState;
    switch (phase.phase) {
      case "select_move_destination":
      case "attack_submenu":
      case "select_direction":
        this.enterActionMenu();
        break;
      case "select_attack_target":
        this.enterAttackSubmenu();
        break;
      case "confirm_attack":
      case "select_retreat_target":
        this.enterAttackTarget(phase.moveId);
        break;
      default:
        break;
    }
  }

  /** Space/Enter = Wait (end the turn after picking a facing) — only from the root menu. */
  onConfirmKey(): void {
    if (this.inputState.phase === "action_menu") {
      this.enterDirection();
    }
  }

  /** Hover a tile → show that Pokémon in the info panel (off a Pokémon → the active one). */
  onTileHover(tile: Position | null): void {
    // Frozen while a battle animation resolves: hovering shouldn't repaint the info
    // panel / enemy range mid-action (skip while animating).
    if (this.inputState.phase === "animating") {
      return;
    }
    this.hoveredTile = tile;
    this.refreshInfoPanel();
    // Hovering an aura caster floats its team-aura symbols over its radius tiles.
    const hovered = this.pokemonAt(tile);
    this.showAuraHoverFor(hovered?.id ?? null);
    this.updateEnemyRangeHover(hovered);
    if (this.inputState.phase === "select_attack_target") {
      this.updateAttackPreview(this.inputState.moveId, tile);
    }
  }

  /**
   * Paint a hovered enemy's reachable-tile range (threat preview): only during
   * the planning phases, only for a living enemy that isn't the active Pokémon.
   */
  private updateEnemyRangeHover(hovered: PokemonInstance | null): void {
    const active = this.activePokemon();
    const activePlayerId = active?.playerId ?? null;
    const planningPhases: ReadonlySet<InputState["phase"]> = new Set([
      "action_menu",
      "select_move_destination",
      "attack_submenu",
    ]);
    if (
      !activePlayerId ||
      !planningPhases.has(this.inputState.phase) ||
      !hovered ||
      hovered.playerId === activePlayerId ||
      hovered.currentHp <= 0 ||
      hovered.id === active?.id
    ) {
      this.clearEnemyRangeHover();
      return;
    }
    if (hovered.id === this.hoveredEnemyRangePokemonId) {
      return;
    }
    this.board.setHighlights("enemy", this.engine.getReachableTilesForPokemon(hovered.id));
    this.hoveredEnemyRangePokemonId = hovered.id;
  }

  private clearEnemyRangeHover(): void {
    if (this.hoveredEnemyRangePokemonId !== null) {
      this.board.setHighlights("enemy", []);
      this.hoveredEnemyRangePokemonId = null;
    }
  }

  // --- FSM ---

  private activePokemon(): PokemonInstance | null {
    const id = this.state.activePokemonId;
    return id ? (this.state.pokemon.get(id) ?? null) : null;
  }

  /** The living Pokémon on `tile`, if any (for hover-to-inspect). */
  private pokemonAt(tile: Position | null): PokemonInstance | null {
    if (!tile) {
      return null;
    }
    for (const pokemon of this.state.pokemon.values()) {
      if (pokemon.currentHp > 0 && pokemon.position.x === tile.x && pokemon.position.y === tile.y) {
        return pokemon;
      }
    }
    return null;
  }

  /** Push the hovered (or active) Pokémon to the info panel + the current weather. */
  private refreshInfoPanel(): void {
    if (this.disposed) {
      return;
    }
    const shown = this.pokemonAt(this.hoveredTile) ?? this.activePokemon();
    this.chrome.updateInfoPanel(shown ? buildInfoPanelView(this.context, shown, this.state) : null);
    this.chrome.updateWeather(buildWeatherView(this.state));
  }

  /**
   * Refresh the turn timeline from the current order (Charge-Time predicts ahead).
   * Pass `previewMoveId` while a move is being targeted/confirmed to preview how it
   * shifts the upcoming order.
   */
  private refreshTimeline(previewMoveId?: string): void {
    const ctSequence = this.engine.predictCtTimeline(CT_TIMELINE_SLOTS, previewMoveId);
    this.chrome.updateTimeline(
      buildTimelineView(this.state, ctSequence, previewMoveId !== undefined),
    );
  }

  private refreshUI(): void {
    if (this.disposed || this.inputState.phase === "battle_over") {
      return;
    }
    const active = this.activePokemon();
    if (!active) {
      return;
    }
    this.legalActions = this.engine.getLegalActions(active.playerId);
    this.chrome.updateTurnInfo({
      activePokemonId: active.id,
      playerId: active.playerId,
    });
    this.syncBoard();
    this.refreshInfoPanel();
    this.refreshTimeline();
    this.board.panCameraTo(active.position);

    const aiEvents = this.onTurnReady?.(active.id);
    if (Array.isArray(aiEvents)) {
      this.inputState = { phase: "animating" };
      this.chrome.hideMenus();
      this.board.clearHighlights();
      this.enqueueEvents(aiEvents, () => this.refreshUI());
      return;
    }
    this.enterActionMenu();
  }

  private enterActionMenu(): void {
    this.board.clearHighlights();
    this.inputState = { phase: "action_menu" };
    // Drop any move-preview reshuffle, back to the plain upcoming order.
    this.refreshTimeline();
    const active = this.activePokemon();
    if (active) {
      this.board.setActive(active.id);
    }
    this.chrome.showActionMenu({
      canMove: this.legalActions.some((a) => a.kind === ActionKind.Move),
      canAct: this.legalActions.some((a) => a.kind === ActionKind.UseMove),
      canUndoMove: this.legalActions.some((a) => a.kind === ActionKind.UndoMove),
      onMove: () => this.enterMoveDestination(),
      onAttack: () => this.enterAttackSubmenu(),
      onWait: () => this.enterDirection(),
      onUndoMove: () => this.submitUndoMove(),
    });
  }

  private enterMoveDestination(): void {
    const destinations = this.moveActions()
      .map((action) => action.path.at(-1))
      .filter(isPosition);
    this.board.setHighlights("move", destinations);
    this.chrome.hideMenus();
    this.inputState = { phase: "select_move_destination" };
  }

  private tryMoveTo(tile: Position): void {
    const action = this.moveActions().find((candidate) =>
      positionEquals(candidate.path.at(-1), tile),
    );
    if (!action) {
      this.enterActionMenu();
      return;
    }
    this.executeAction(action);
  }

  private enterAttackSubmenu(): void {
    this.board.clearHighlights();
    const active = this.activePokemon();
    if (!active) {
      return;
    }
    // Show ALL of the actor's moves (greyed when out of PP or out of range),
    // with the Provoc/Entrave/Encore block tag.
    const targetableMoveIds = new Set(this.useMoveActions().map((action) => action.moveId));
    const isTaunted = active.volatileStatuses.some((v) => v.type === StatusType.Taunted);
    const disabledMoveId = active.volatileStatuses.find(
      (v) => v.type === StatusType.Disabled,
    )?.moveId;
    const encoredMoveId = active.volatileStatuses.find(
      (v) => v.type === StatusType.Encored,
    )?.moveId;

    const moves: AttackSubmenuMoveView[] = [];
    for (const moveId of active.moveIds) {
      const definition = this.moveDefinitions.get(moveId);
      if (!definition) {
        continue;
      }
      moves.push({
        definition,
        hasTargets: targetableMoveIds.has(moveId),
        costTempo: moveCtTempo(definition.pp, definition.power, definition.effectTier),
        blockedTag: resolveBlockedTag(definition, isTaunted, disabledMoveId, encoredMoveId),
      });
    }
    this.chrome.showAttackSubmenu({
      moves,
      onSelect: (moveId) => this.enterAttackTarget(moveId),
      onCancel: () => this.enterActionMenu(),
    });
    this.inputState = { phase: "attack_submenu" };
    // No move chosen yet → plain upcoming order (clears a previous move preview).
    this.refreshTimeline();
  }

  private enterAttackTarget(moveId: string): void {
    this.board.setPreviewFlash([]);
    this.board.setDamageEstimates([]);
    // Outline only the valid target tiles of a genuinely ranged/targeted move. Never
    // flood them with the red "attack" fill (a buff/heal move keeps its blue footprint),
    // and never outline static (Self/Cross/Zone — showEntryPreview fills the footprint)
    // nor directional (Cone/Line/Slash/Dash — orientation only) moves: outlining their
    // adjacent target tiles drew stray red borders.
    const move = this.effectiveMove(moveId);
    const active = this.activePokemon();
    let targets: readonly Position[] = [];
    let beneficialOutline = false;
    if (
      move !== undefined &&
      active &&
      (move.targetsAlly === true || move.targetsAllyOrSelf === true) &&
      "range" in move.targeting
    ) {
      // Ally/self moves (heal an ally, baton pass…) only occupy a tile when an ally
      // is in reach, looking empty otherwise. Outline the whole reach range so the
      // player sees where it can land — self-or-ally reaches from range 0 (parity
      // GameController.enterAttackTarget). Paint it blue (beneficial), like the
      // ground buff preview.
      const grid = this.engine.getGrid();
      const minRange = move.targetsAllyOrSelf === true ? 0 : move.targeting.range.min;
      targets = grid.getTilesInRange(active.position, minRange, move.targeting.range.max);
      beneficialOutline = true;
    } else if (
      move !== undefined &&
      !this.isStaticPattern(move.targeting.kind) &&
      !this.isDirectionalPattern(move.targeting.kind)
    ) {
      targets = this.targetActions(moveId).map((action) => action.targetPosition);
    }
    this.board.setOutline(targets, beneficialOutline);
    const definition = this.moveDefinitions.get(moveId);
    if (definition) {
      this.chrome.showSelectedMove({ definition }, "selectTarget");
    }
    this.inputState = { phase: "select_attack_target", moveId };
    this.previewDirection = null;
    this.board.clearPreview();
    this.showEntryPreview(moveId);
    // Charge-Time: preview how committing this move reshuffles the upcoming order.
    this.refreshTimeline(moveId);
  }

  // --- Attack-target previews (port of GameController.handleTileHover, plan 121 4b-5) ---

  /** The B4-resolved move for the active caster (Nature Power swap, etc.), or the static def. */
  private effectiveMove(moveId: string): MoveDefinition | undefined {
    const active = this.activePokemon();
    const staticDefinition = this.moveDefinitions.get(moveId);
    if (!active) {
      return staticDefinition;
    }
    return this.engine.getEffectiveMove(active.id, moveId) ?? staticDefinition;
  }

  /**
   * Is this move actually winding up THIS turn? A two-turn move charges on turn 1, EXCEPT a
   * sun-skip move (Lance-Soleil) under sun, which fires immediately. Mirrors the engine
   * (BattleEngine getLegalActions / execution), so the preview matches what the click does.
   */
  private isChargingThisTurn(move: MoveDefinition, active: PokemonInstance): boolean {
    if (move.twoTurnCharge !== true || active.chargingMove !== undefined) {
      return false;
    }
    const skipsChargeThisTurn =
      move.sunSkipsCharge === true && this.engine.getEffectiveWeather() === Weather.Sun;
    return !skipsChargeThisTurn;
  }

  private isStaticPattern(kind: TargetingKind): boolean {
    return (
      kind === TargetingKind.Self || kind === TargetingKind.Cross || kind === TargetingKind.Zone
    );
  }

  /**
   * Cone/Line/Slash/Dash: orientation-only moves. The player picks a direction, not a
   * precise target tile — clicking anywhere confirms in the hovered direction. Dash lands
   * automatically as far as it can travel (portée auto), so it's never outlined on landing
   * tiles; only its HOVER trail is drawn directionally.
   */
  private isDirectionalPattern(kind: TargetingKind): boolean {
    return (
      kind === TargetingKind.Cone ||
      kind === TargetingKind.Line ||
      kind === TargetingKind.Slash ||
      kind === TargetingKind.Dash
    );
  }

  /** Static patterns (Self/Cross/Zone) preview their footprint immediately, centred on the caster. */
  private showEntryPreview(moveId: string): void {
    const active = this.activePokemon();
    const move = this.effectiveMove(moveId);
    if (!active || !move) {
      return;
    }
    // Charge turn of a two-turn move: highlight the caster's own tile (the wind-up).
    if (this.isChargingThisTurn(move, active)) {
      this.previewTiles = [{ x: active.position.x, y: active.position.y }];
      this.board.showPreview("buff", this.previewTiles);
      // Outline the wind-up tile too; blue since it's the caster's own charge
      // tile, not an attack target.
      this.board.setOutline(this.previewTiles, true);
      return;
    }
    if (!this.isStaticPattern(move.targeting.kind)) {
      return;
    }
    const grid = this.engine.getGrid();
    const selfRadius = selfPreviewRadius(move);
    let tiles: readonly Position[];
    if (selfRadius === undefined) {
      const resolved = resolveTargeting(move.targeting, active, active.position, grid, undefined, {
        type: move.type,
        flags: move.flags,
      });
      // Zone/Cross radiate damage from the caster and do NOT hit its own tile (e.g. Séisme):
      // drop the caster tile so the preview matches the tooltip (centre = croix, not coloured).
      // A bare Self move (no radius) keeps its single caster tile (self buff).
      tiles =
        move.targeting.kind === TargetingKind.Self
          ? resolved
          : resolved.filter((position) => !positionEquals(position, active.position));
    } else {
      // Self-centred AoE (heal / cure / field "champ"): the caster's own tile IS affected.
      tiles = grid.getTilesInRange(active.position, 0, selfRadius);
    }
    this.previewTiles = tiles;
    this.board.showPreview(moveIntent(move), tiles);
  }

  /** Cursor-following preview while picking a target: directional fan or single-tile footprint. */
  private updateAttackPreview(moveId: string, tile: Position | null): void {
    const active = this.activePokemon();
    const move = this.effectiveMove(moveId);
    if (!active || !move || this.isStaticPattern(move.targeting.kind)) {
      return;
    }
    // Charge turn: the preview is fixed on the caster (set by showEntryPreview); a
    // hover must not move/clear it.
    if (this.isChargingThisTurn(move, active)) {
      return;
    }
    const grid = this.engine.getGrid();
    const moveContext = { type: move.type, flags: move.flags };
    let affected: readonly Position[];

    // Cone/Line/Slash/Dash all preview directionally (the fan/trail toward the cursor).
    if (this.isDirectionalPattern(move.targeting.kind)) {
      if (!tile) {
        this.previewDirection = null;
        this.previewTiles = [];
        this.board.clearPreview();
        return;
      }
      const direction = directionFromTo(active.position, tile);
      if (direction === this.previewDirection) {
        return;
      }
      this.previewDirection = direction;
      const target = stepInDirection(active.position, direction, 1);
      affected = resolveTargeting(move.targeting, active, target, grid, undefined, moveContext);
    } else {
      const isValidTarget =
        tile !== null &&
        this.targetActions(moveId).some((action) => positionEquals(action.targetPosition, tile));
      if (!isValidTarget || !tile) {
        this.previewTiles = [];
        this.board.clearPreview();
        return;
      }
      // Self-cast of an ally/self move on the caster's own tile only lights that tile.
      affected =
        move.targetsAllyOrSelf === true && positionEquals(active.position, tile)
          ? [{ x: active.position.x, y: active.position.y }]
          : resolveTargeting(move.targeting, active, tile, grid, undefined, moveContext);
    }

    this.previewTiles = affected;
    this.board.clearPreview();
    if (move.targeting.kind === TargetingKind.Dash) {
      // Dash trail in yellow + landing/impact tile in the move's intent colour, so the
      // run-up reads apart from the hit (mirrors the tooltip's yellow dash cells).
      this.showDashPreview(move, active.position, affected);
    } else {
      this.board.showPreview(moveIntent(move), affected);
    }
    if (move.targeting.kind === TargetingKind.Blast && tile) {
      const impact = resolveBlastImpactTile(active.position, tile, grid, moveContext);
      if (impact) {
        this.board.showPreview("blast", [impact]);
      }
    }
  }

  /**
   * Paint a dash footprint: the whole run-up is movement (yellow), and ONLY the tiles a
   * living Pokémon stands on (ally or enemy, anywhere along the path) get the move's intent
   * colour. Dashing into the void stays fully yellow — no misleading red "impact".
   * `resolveDash` only returns the landing tile, so the straight run-up between the caster
   * and the landing is reconstructed here (step by step in the dash direction).
   */
  private showDashPreview(
    move: MoveDefinition,
    casterPosition: Position,
    footprint: readonly Position[],
  ): void {
    const landing = footprint.find((position) => !positionEquals(position, casterPosition));
    if (!landing) {
      return;
    }
    // Dash is axis-aligned by design; a diagonal landing would make the straight-line
    // reconstruction wrong, so fail safe to the landing tile only.
    if (casterPosition.x !== landing.x && casterPosition.y !== landing.y) {
      this.board.showPreview(this.pokemonAt(landing) === null ? "dash" : moveIntent(move), [
        landing,
      ]);
      return;
    }
    const direction = directionFromTo(casterPosition, landing);
    const steps = Math.abs(landing.x - casterPosition.x) + Math.abs(landing.y - casterPosition.y);
    const movementTiles: Position[] = [];
    const impactTiles: Position[] = [];
    for (let step = 1; step <= steps; step++) {
      const tile = stepInDirection(casterPosition, direction, step);
      (this.pokemonAt(tile) === null ? movementTiles : impactTiles).push(tile);
    }
    if (movementTiles.length > 0) {
      this.board.showPreview("dash", movementTiles);
    }
    if (impactTiles.length > 0) {
      this.board.showPreview(moveIntent(move), impactTiles);
    }
  }

  private tryPickTarget(moveId: string, tile: Position): void {
    const action = this.resolveTargetAction(moveId, tile);
    if (!action) {
      return;
    }
    if (this.config.confirmAttack) {
      // Keep the buff/attack-coloured footprint preview from updateAttackPreview —
      // do NOT repaint the tile red (the confirm step only adds the flash +
      // damage estimates), so a buff/heal move stays blue through confirmation.
      this.chrome.updateInstruction("confirm");
      this.inputState = { phase: "confirm_attack", moveId, action };
      // Flash the living occupants of the locked footprint (parity, plan 123 4d-3).
      this.board.setPreviewFlash(this.previewOccupantIds());
      // Predicted-damage overlay on each target (parity, plan 123 4d-4; setting-gated).
      if (this.context.isDamagePreviewEnabled()) {
        this.board.setDamageEstimates(this.buildDamageEstimates(moveId, action));
      }
      return;
    }
    this.resolveAttack(moveId, action);
  }

  /** Living Pokémon standing on the current preview footprint (confirm-phase flash). */
  private previewOccupantIds(): string[] {
    const ids: string[] = [];
    for (const pokemon of this.state.pokemon.values()) {
      if (pokemon.currentHp <= 0) {
        continue;
      }
      if (this.previewTiles.some((tile) => positionEquals(pokemon.position, tile))) {
        ids.push(pokemon.id);
      }
    }
    return ids;
  }

  /** Predicted-damage overlays for the enemies under the locked footprint (port of GameController.showDamageEstimates). */
  private buildDamageEstimates(moveId: string, action: Action): BoardDamageEstimate[] {
    const active = this.activePokemon();
    if (!active || action.kind !== ActionKind.UseMove) {
      return [];
    }
    const estimates: BoardDamageEstimate[] = [];
    for (const pokemon of this.state.pokemon.values()) {
      if (
        pokemon.currentHp <= 0 ||
        pokemon.id === active.id ||
        !this.previewTiles.some((tile) => positionEquals(pokemon.position, tile))
      ) {
        continue;
      }
      const estimate = this.engine.estimateDamage(
        active.id,
        moveId,
        pokemon.id,
        action.targetPosition,
      );
      if (!estimate) {
        continue;
      }
      const immune = estimate.effectiveness === 0;
      // Nothing to show for a non-immune zero-damage hit.
      if (!immune && estimate.min === 0 && estimate.max === 0) {
        continue;
      }
      const label = immune
        ? this.context.translate("battle.immune")
        : `${formatDamageRange(estimate.min, estimate.max)}${formatFacingSuffix(estimate.facingModifier)}`;
      estimates.push({
        pokemonId: pokemon.id,
        min: estimate.min,
        max: estimate.max,
        label,
        immune,
      });
    }
    return estimates;
  }

  /** Branch to the Hit&Run retreat picker, or execute directly. */
  private resolveAttack(moveId: string, action: Action): void {
    this.board.setPreviewFlash([]);
    this.board.setDamageEstimates([]);
    const active = this.activePokemon();
    const move = active ? this.engine.getEffectiveMove(active.id, moveId) : null;
    const targeting = (move ?? this.moveDefinitions.get(moveId))?.targeting;
    if (active && targeting?.kind === TargetingKind.HitAndRun) {
      const retreatTiles = enumerateHitAndRunRetreatTiles(
        active.position,
        targeting.retreatRange,
        this.engine.getGrid(),
      );
      if (retreatTiles.length > 0) {
        this.board.setHighlights("retreat", retreatTiles);
        this.chrome.updateInstruction("selectRetreat");
        this.inputState = { phase: "select_retreat_target", moveId, action, retreatTiles };
        return;
      }
    }
    this.executeAction(action);
  }

  private tryPickRetreat(
    phase: Extract<InputState, { phase: "select_retreat_target" }>,
    tile: Position,
  ): void {
    if (!phase.retreatTiles.some((candidate) => positionEquals(candidate, tile))) {
      return;
    }
    if (phase.action.kind !== ActionKind.UseMove) {
      return;
    }
    this.executeAction({ ...phase.action, retreatPosition: { x: tile.x, y: tile.y } });
  }

  private enterDirection(): void {
    const active = this.activePokemon();
    if (!active) {
      return;
    }
    this.chrome.hideMenus();
    this.board.clearHighlights();
    this.inputState = { phase: "select_direction" };
    // Hide the active's HUD while the direction arrows are up so the HP bar doesn't
    // clutter the choice; restore on
    // confirm/cancel (syncBoard never re-shows a hidden HUD on its own).
    this.board.setHudVisible(active.id, false);
    this.picker = this.board.showDirectionPicker(active.position, active.orientation, {
      onPreview: (direction) => this.board.setFacing(active.id, direction),
      onConfirm: (direction) => {
        this.picker = null;
        this.board.setHudVisible(active.id, true);
        this.executeAction({ kind: ActionKind.EndTurn, pokemonId: active.id, direction });
      },
      onCancel: () => {
        this.picker = null;
        this.board.setHudVisible(active.id, true);
        this.enterActionMenu();
      },
    });
  }

  private submitUndoMove(): void {
    const active = this.activePokemon();
    const undo = this.legalActions.find((a) => a.kind === ActionKind.UndoMove);
    if (active && undo) {
      this.executeAction(undo);
    }
  }

  // --- Action submission + event sequencing ---

  private executeAction(action: Action): void {
    const active = this.activePokemon();
    if (!active) {
      return;
    }
    this.picker?.dispose();
    this.picker = null;
    const result = this.engine.submitAction(active.playerId, action);
    if (!result.success) {
      this.enterActionMenu();
      return;
    }
    this.inputState = { phase: "animating" };
    this.chrome.hideMenus();
    this.board.clearHighlights();
    this.enqueueEvents(result.events, () => this.refreshUI());
  }

  /** Queue a batch of events to apply to the board, then run `next` once drained. */
  private enqueueEvents(events: readonly BattleEvent[], next: () => void): void {
    this.queue.enqueue(async () => {
      await this.applyEvents(events);
      const ended = events.find((event) => event.type === BattleEventType.BattleEnded);
      if (ended && ended.type === BattleEventType.BattleEnded) {
        this.enterBattleOver(ended.winnerId);
        return;
      }
      next();
    });
  }

  private async applyEvents(events: readonly BattleEvent[]): Promise<void> {
    // Multi-hit pre-scan: the engine state is already final and DamageDealt carries
    // only the per-hit amount, so a multi-hit move would otherwise snap the bar to
    // the final HP on the first hit. Count hits + total damage per target so a
    // target hit more than once can have its pre-action HP reconstructed (final +
    // total) and the bar stepped down hit-by-hit, paced to the floating-number tick.
    const hitsByTarget = new Map<string, number>();
    const totalDamageByTarget = new Map<string, number>();
    for (const event of events) {
      if (event.type === BattleEventType.DamageDealt && "targetId" in event && event.amount > 0) {
        hitsByTarget.set(event.targetId, (hitsByTarget.get(event.targetId) ?? 0) + 1);
        totalDamageByTarget.set(
          event.targetId,
          (totalDamageByTarget.get(event.targetId) ?? 0) + event.amount,
        );
      }
    }
    const steppedHpByTarget = new Map<string, number>();

    // Entry hazards (plan 131): the engine resolves every trapped tile up front, but the player
    // should see each tick AS the sprite steps onto that tile. Collect the triggers per mover so
    // the PokemonMoved handler can replay them through moveAlongPath's per-tile callback, and skip
    // them in the main loop (they fire from the callback instead).
    const hazardTriggersByMover = new Map<string, BattleEvent[]>();
    const consumedHazardEvents = new Set<BattleEvent>();
    for (const event of events) {
      if (
        event.type === BattleEventType.EntryHazardTriggered ||
        event.type === BattleEventType.EntryHazardAbsorbed
      ) {
        const list = hazardTriggersByMover.get(event.pokemonId) ?? [];
        list.push(event);
        hazardTriggersByMover.set(event.pokemonId, list);
        consumedHazardEvents.add(event);
      }
    }

    for (const event of events) {
      if (this.disposed) {
        return;
      }
      if (consumedHazardEvents.has(event)) {
        continue;
      }
      this.feedback.report(event);
      if (event.type === BattleEventType.DamageDealt && "targetId" in event) {
        this.board.flashDamage(event.targetId);
        const target = this.state.pokemon.get(event.targetId);
        if (target && (hitsByTarget.get(event.targetId) ?? 0) > 1 && event.amount > 0) {
          // Multi-hit: step the bar down one hit at a time, paced to the floating
          // numbers (the loop await spaces the reports, so each tick the number +
          // the bar drop together instead of the bar emptying in one go).
          const preHp =
            steppedHpByTarget.get(event.targetId) ??
            target.currentHp + (totalDamageByTarget.get(event.targetId) ?? 0);
          const running = Math.max(0, preHp - event.amount);
          steppedHpByTarget.set(event.targetId, running);
          this.board.updateHp(event.targetId, running, target.maxHp);
          await delay(BATTLE_TEXT_QUEUE_DELAY_MS);
        } else if (target) {
          // Single hit: drain the world HP bar in step with the flash.
          this.board.updateHp(event.targetId, target.currentHp, target.maxHp);
        }
      }
      if (event.type === BattleEventType.MoveStarted) {
        // Face the target and play the move's category animation (plan 122 4c-3).
        await this.board.playAttack(
          event.attackerId,
          event.direction,
          attackAnimationName(event.moveId),
        );
        if (this.disposed) {
          return;
        }
      } else if (
        event.type === BattleEventType.PokemonMoved ||
        event.type === BattleEventType.PokemonDashed
      ) {
        // Glide along the path with per-step Walk/Hop + flyer glide (plan 123 4d-5).
        const moverTypes = this.engine.getPokemonTypes(event.pokemonId);
        await this.board.moveAlongPath(event.pokemonId, event.path, {
          isFlying: moverTypes.includes(PokemonType.Flying),
          isGhost: moverTypes.includes(PokemonType.Ghost),
          onTileReached: this.entryHazardTickFor(event.pokemonId, hazardTriggersByMover),
        });
        if (this.disposed) {
          return;
        }
        this.syncBoard();
      } else if (
        event.type === BattleEventType.KnockbackApplied ||
        event.type === BattleEventType.IceSlideApplied
      ) {
        // Glide to the pushed tile instead of snapping (plan 123 4d-2). Knockback
        // plays the Hurt pose; the ice slide just drifts.
        await this.board.impactGlide(event.pokemonId, event.to, {
          hurt: event.type === BattleEventType.KnockbackApplied,
        });
        if (this.disposed) {
          return;
        }
        this.syncBoard();
      } else if (event.type === BattleEventType.KnockbackBlocked) {
        await this.board.impactShake(event.pokemonId);
        if (this.disposed) {
          return;
        }
      } else if (event.type === BattleEventType.SubstitutePosted) {
        // Clonage posted: swap the sprite to the dummy doll. The HP bar keeps
        // showing the holder's own HP.
        this.board.setSubstitute(event.pokemonId, true);
        const holder = this.state.pokemon.get(event.pokemonId);
        if (holder) {
          this.board.updateHp(event.pokemonId, holder.currentHp, holder.maxHp);
        }
      } else if (event.type === BattleEventType.SubstituteDamaged) {
        // The doll absorbs the hit: flash it (the floating "-N" comes from feedback).
        this.board.flashDamage(event.pokemonId);
      } else if (event.type === BattleEventType.SubstituteBroken) {
        // Doll destroyed: reveal the real sprite again.
        this.board.setSubstitute(event.pokemonId, false);
      } else if (
        event.type === BattleEventType.WallImpactDealt ||
        event.type === BattleEventType.TerrainDamageDealt ||
        event.type === BattleEventType.FallDamageDealt
      ) {
        // Dash-into-wall recoil / psychic-barrier impact / terrain tick / fall (cliff
        // or knockback into lava/deep water): drain the bar + flash the victim before
        // any following PokemonKo, so a lethal terrain push visibly empties the bar to
        // 0 instead of jumping straight to the hidden KO state (the
        // floating "-N" comes from feedback.report). Victim is `pokemonId`, not `targetId`.
        const victim = this.state.pokemon.get(event.pokemonId);
        if (victim) {
          this.board.updateHp(event.pokemonId, victim.currentHp, victim.maxHp);
          this.board.flashDamage(event.pokemonId);
        }
      } else if (event.type === BattleEventType.PainSplitApplied) {
        // Balance: both mons settle at the pooled HP. Refresh both bars (one heals, one is chipped).
        for (const id of [event.casterId, event.targetId]) {
          const mon = this.state.pokemon.get(id);
          if (mon) {
            this.board.updateHp(id, mon.currentHp, mon.maxHp);
          }
        }
        this.board.flashDamage(event.targetId);
      } else if (event.type === BattleEventType.EndeavorApplied) {
        // Effort: target HP set down to the caster's. Drain its bar + flash.
        const target = this.state.pokemon.get(event.targetId);
        if (target) {
          this.board.updateHp(event.targetId, target.currentHp, target.maxHp);
          this.board.flashDamage(event.targetId);
        }
      } else if (event.type === BattleEventType.FutureSightStruck) {
        // Prescience landing: drain + flash every occupant of the AoE (KO handled separately).
        for (const hit of event.hits) {
          const mon = this.state.pokemon.get(hit.pokemonId);
          if (mon) {
            this.board.updateHp(hit.pokemonId, mon.currentHp, mon.maxHp);
            this.board.flashDamage(hit.pokemonId);
          }
        }
      } else if (
        event.type === BattleEventType.PokemonKo ||
        event.type === BattleEventType.PokemonEliminated
      ) {
        // Let the victim's damage reaction (Hurt pose + red flash) finish before the
        // Faint collapse: the preceding DamageDealt kicked the Hurt one-shot without
        // awaiting, so without this the KO cuts in the instant the hit lands. Wait the
        // longer of the Hurt pose and the flash (the flash covers atlases lacking Hurt).
        const hurtMs = Math.max(
          this.board.hurtAnimationDurationMs(event.pokemonId),
          DAMAGE_FLASH_TOTAL_MS,
        );
        await delay(hurtMs);
        if (this.disposed) {
          return;
        }
        // syncBoard plays the Faint pose (freeze on the last frame); wait its real
        // length so the fall plays out fully before the next beat, falling back
        // to the fixed step delay.
        this.syncBoard();
        await delay(this.board.koAnimationDurationMs(event.pokemonId) || BATTLE_STEP_DELAY_MS);
      } else if (BOARD_EVENT_TYPES.has(event.type)) {
        this.syncBoard();
        await delay(BATTLE_STEP_DELAY_MS);
      }
      // Keep the info panel HP/badges live as damage, status and KO events drain.
      this.refreshInfoPanel();
    }
    this.syncBoard();
    this.refreshInfoPanel();
  }

  /** Re-sync every billboard with engine state (positions, facing, KO, semi-invulnerable). */
  private syncBoard(): void {
    for (const pokemon of this.state.pokemon.values()) {
      if (pokemon.currentHp <= 0) {
        this.board.setKnockedOut(pokemon.id, true);
        continue;
      }
      this.board.moveTo(pokemon.id, pokemon.position);
      this.board.setFacing(pokemon.id, pokemon.orientation);
      this.board.updateHp(pokemon.id, pokemon.currentHp, pokemon.maxHp);
      this.board.updateStatus(pokemon.id, pokemon.statusEffects[0]?.type ?? null);
      this.board.setConfusionWobble(
        pokemon.id,
        pokemon.volatileStatuses.some((volatile) => volatile.type === StatusType.Confused),
      );
      this.board.setSemiInvulnerable(
        pokemon.id,
        semiInvulnerableDisplay(pokemon.semiInvulnerableState),
      );
    }
    this.board.setActive(this.activePokemon()?.id ?? null);
    // A re-sync rebuilds every highlight layer, dropping the enemy-range fill too,
    // so forget the tracked enemy.
    this.hoveredEnemyRangePokemonId = null;
    this.refreshAuraVisuals();
    this.refreshFieldTerrainVisuals();
    this.refreshDistortionVisuals();
    this.refreshEntryHazardVisuals();
  }

  /**
   * Build a per-tile callback that replays a mover's entry-hazard triggers (plan 131) as the sprite
   * steps onto each trapped tile: the floating text/log fires there, and damage drains the HP bar
   * tick-by-tick (reconstructed from the already-final HP + total hazard damage). Returns undefined
   * when this mover hit no hazards.
   */
  private entryHazardTickFor(
    pokemonId: string,
    triggersByMover: Map<string, BattleEvent[]>,
  ): ((tile: Position) => void) | undefined {
    const triggers = triggersByMover.get(pokemonId);
    if (!triggers || triggers.length === 0) {
      return undefined;
    }
    const mover = this.state.pokemon.get(pokemonId);
    const totalDamage = triggers.reduce(
      (sum, event) =>
        sum + (event.type === BattleEventType.EntryHazardTriggered ? (event.damage ?? 0) : 0),
      0,
    );
    let runningHp = mover ? mover.currentHp + totalDamage : 0;
    const queueByTile = new Map<string, BattleEvent[]>();
    for (const event of triggers) {
      if (!("tile" in event)) {
        continue;
      }
      const key = `${event.tile.x},${event.tile.y}`;
      const list = queueByTile.get(key) ?? [];
      list.push(event);
      queueByTile.set(key, list);
    }
    return (tile: Position): void => {
      const list = queueByTile.get(`${tile.x},${tile.y}`);
      if (!list) {
        return;
      }
      // Drain EVERY trigger on this tile (a tile can hold several hazard kinds at once), so the log
      // and floating text show them all instead of just the first.
      while (list.length > 0) {
        const event = list.shift();
        if (!event) {
          break;
        }
        this.feedback.report(event);
        if (
          event.type === BattleEventType.EntryHazardTriggered &&
          event.damage !== undefined &&
          mover
        ) {
          runningHp = Math.max(0, runningHp - event.damage);
          this.board.updateHp(mover.id, runningHp, mover.maxHp);
          this.board.flashDamage(mover.id);
        }
      }
    };
  }

  /** Refresh the entry-hazard voxel props (plan 131): one stacked model set per trapped cell. */
  private refreshEntryHazardVisuals(): void {
    const specs = this.state.entryHazards.map((cell) => ({
      kind: cell.kind,
      tile: cell.tile,
      layers: cell.layers,
    }));
    this.board.setEntryHazards(specs);
  }

  /** Repaint the active Distorsion (Trick Room) zones + timer pills from engine state. */
  private refreshDistortionVisuals(): void {
    const specs = this.state.distortionZones.map((zone) => {
      const caster = this.state.pokemon.get(zone.casterId);
      return {
        tiles: zone.tiles,
        anchor: zone.anchor,
        color: DISTORTION_ZONE_COLOR,
        teamColor: caster ? getTeamColorByPlayerId(caster.playerId) : DISTORTION_ZONE_COLOR,
        remainingTurns: zone.remainingTurns,
      };
    });
    this.board.setDistortionZones(specs);
  }

  /** Repaint the active field-terrain ("Champs") zones + timer pills from engine state. */
  private refreshFieldTerrainVisuals(): void {
    const zones = this.state.fieldTerrains;
    // Core lets zones overlap (only a same-anchor cast replaces); mechanically the
    // most recently posted zone wins per tile (getFieldTerrainAt). Mirror that in the
    // paint so zones never stack visually: each tile is drawn by its latest owner
    // only, and a zone's perimeter is recomputed from the tiles it still owns.
    const ownerByTile = new Map<string, number>();
    zones.forEach((zone, index) => {
      for (const tile of zone.tiles) {
        ownerByTile.set(`${tile.x},${tile.y}`, index);
      }
    });
    const specs = zones
      .map((zone, index) => {
        const caster = this.state.pokemon.get(zone.casterId);
        return {
          tiles: zone.tiles.filter((tile) => ownerByTile.get(`${tile.x},${tile.y}`) === index),
          anchor: zone.anchor,
          color: FIELD_TERRAIN_COLOR[zone.kind],
          teamColor: caster
            ? getTeamColorByPlayerId(caster.playerId)
            : FIELD_TERRAIN_COLOR[zone.kind],
          remainingTurns: zone.remainingTurns,
        };
      })
      // A zone entirely covered by newer ones loses every tile — drop it (pill too).
      .filter((spec) => spec.tiles.length > 0);
    this.board.setFieldTerrains(specs);
  }

  /**
   * Refresh the icons left of each HP bar (port of GameController.refreshAuraVisuals
   * + setChargingIndicator): a ⚡ while a two-turn move charges, then the team auras —
   * the caster shows every aura it posted, and each living ally within the aura radius
   * shows a dimmed copy of each kind protecting it.
   */
  private refreshAuraVisuals(): void {
    const specsByPokemon = new Map<string, BoardAuraIndicator[]>();
    const pushSpec = (pokemonId: string, spec: BoardAuraIndicator): void => {
      const specs = specsByPokemon.get(pokemonId) ?? [];
      if (!specs.some((existing) => existing.id === spec.id)) {
        specs.push(spec);
        specsByPokemon.set(pokemonId, specs);
      }
    };
    // Two-turn charge: a ⚡ while the move winds up (closest to the bar).
    for (const pokemon of this.state.pokemon.values()) {
      if (pokemon.currentHp > 0 && pokemon.chargingMove !== undefined) {
        pushSpec(pokemon.id, {
          id: CHARGING_INDICATOR_ID,
          symbol: CHARGING_INDICATOR_SYMBOL,
          alpha: 1,
        });
      }
      // Requiem (perish-song) death aura: a 🎵 badge on the caster while it counts down.
      if (pokemon.currentHp > 0 && pokemon.perishAura !== undefined) {
        pushSpec(pokemon.id, {
          id: "perish-aura",
          symbol: PERISH_AURA_INDICATOR_SYMBOL,
          alpha: 1,
        });
      }
    }
    // Order by remaining rounds (soonest-expiring closest to the bar) so the icon
    // row reads as a turns-left gauge.
    const orderedAuras = [...this.state.auras].sort(
      (a, b) => a.remainingRounds - b.remainingRounds,
    );
    for (const aura of orderedAuras) {
      const caster = this.state.pokemon.get(aura.casterPokemonId);
      if (!caster || caster.currentHp <= 0) {
        continue;
      }
      const symbol = AURA_INDICATOR_SYMBOL[aura.kind];
      pushSpec(caster.id, { id: aura.kind, symbol, alpha: 1 });
      for (const candidate of this.state.pokemon.values()) {
        if (
          candidate.currentHp <= 0 ||
          candidate.id === caster.id ||
          candidate.playerId !== caster.playerId
        ) {
          continue;
        }
        const distance =
          Math.abs(candidate.position.x - caster.position.x) +
          Math.abs(candidate.position.y - caster.position.y);
        if (distance <= AURA_RADIUS) {
          pushSpec(candidate.id, { id: aura.kind, symbol });
        }
      }
    }
    for (const pokemon of this.state.pokemon.values()) {
      this.board.setAuraIndicators(pokemon.id, specsByPokemon.get(pokemon.id) ?? []);
    }
  }

  /** Float a hovered aura caster's symbols over its radius tiles (null/no-aura clears). */
  private showAuraHoverFor(pokemonId: string | null): void {
    const caster = pokemonId ? this.state.pokemon.get(pokemonId) : null;
    const auras = pokemonId
      ? this.state.auras.filter((aura) => aura.casterPokemonId === pokemonId)
      : [];
    // Requiem (perish-song): the death zone is shown only on hover of its caster (r-radius around it).
    if (caster && caster.perishAura !== undefined) {
      const zone = this.engine
        .getGrid()
        .getTilesInRange(caster.position, 0, caster.perishAura.radius)
        .filter((tile) => this.pokemonAt(tile) === null);
      this.board.setAuraGroundIcons(zone, [PERISH_AURA_INDICATOR_SYMBOL]);
      return;
    }
    if (!caster || auras.length === 0) {
      this.board.setAuraGroundIcons([], []);
      return;
    }
    // Skip tiles a Pokémon stands on — the icon would be hidden behind / read as
    // "under" the sprite. Only the open aura-radius tiles get a ground marker.
    const tiles = this.engine
      .getGrid()
      .getTilesInRange(caster.position, 0, AURA_RADIUS)
      .filter((tile) => this.pokemonAt(tile) === null);
    const symbols = [...auras]
      .sort((a, b) => a.postedAtAction - b.postedAtAction)
      .map((aura) => AURA_INDICATOR_SYMBOL[aura.kind]);
    this.board.setAuraGroundIcons(tiles, symbols);
  }

  private enterBattleOver(winnerId: string | null): void {
    this.inputState = { phase: "battle_over", winnerId };
    this.board.clearHighlights();
    this.board.setActive(null);
    this.chrome.showVictory(winnerId);
  }

  // --- legalActions helpers ---

  private moveActions(): Extract<Action, { kind: typeof ActionKind.Move }>[] {
    return this.legalActions.filter(
      (action): action is Extract<Action, { kind: typeof ActionKind.Move }> =>
        action.kind === ActionKind.Move,
    );
  }

  private useMoveActions(): Extract<Action, { kind: typeof ActionKind.UseMove }>[] {
    return this.legalActions.filter(
      (action): action is Extract<Action, { kind: typeof ActionKind.UseMove }> =>
        action.kind === ActionKind.UseMove,
    );
  }

  private targetActions(moveId: string): Extract<Action, { kind: typeof ActionKind.UseMove }>[] {
    return this.useMoveActions().filter((action) => action.moveId === moveId);
  }

  /**
   * The UseMove action a click confirms. Static patterns (Self/Cross/Zone) are
   * centred on the caster, so they confirm
   * on ANY click, not just on the caster's own tile. Other patterns require the
   * click to land on a legal target tile.
   */
  private resolveTargetAction(
    moveId: string,
    tile: Position,
  ): Extract<Action, { kind: typeof ActionKind.UseMove }> | undefined {
    const actions = this.targetActions(moveId);
    const move = this.effectiveMove(moveId);
    const active = this.activePokemon();
    // Charge turn of a two-turn move: the engine offers a single action centred on the
    // caster (the wind-up has no target yet), so it confirms on ANY click (the
    // charge-turn-1 case is handled first).
    if (move && active && this.isChargingThisTurn(move, active)) {
      return (
        actions.find((action) => positionEquals(action.targetPosition, active.position)) ??
        actions[0]
      );
    }
    if (move && active && this.isStaticPattern(move.targeting.kind)) {
      return (
        actions.find((action) => positionEquals(action.targetPosition, active.position)) ??
        actions[0]
      );
    }
    // Dash picks a DIRECTION; the engine then runs as far as it can (portée auto). The legal
    // actions enumerate every tile of each axis, so confirm on the FARTHEST tile in the hovered
    // direction — the engine still stops at the first wall/occupant within that reach.
    if (move && active && move.targeting.kind === TargetingKind.Dash) {
      const direction = this.previewDirection ?? directionFromTo(active.position, tile);
      let farthest: Extract<Action, { kind: typeof ActionKind.UseMove }> | undefined;
      for (const action of actions) {
        if (directionFromTo(active.position, action.targetPosition) !== direction) {
          continue;
        }
        if (
          farthest === undefined ||
          manhattanDistance(active.position, action.targetPosition) >
            manhattanDistance(active.position, farthest.targetPosition)
        ) {
          farthest = action;
        }
      }
      return farthest;
    }
    // Directional patterns (cone/line/slash) only pick an orientation — clicking
    // anywhere validates in the hovered direction (the current preview direction),
    // falling back to the direction toward the clicked tile.
    if (move && active && this.isDirectionalPattern(move.targeting.kind)) {
      const direction = this.previewDirection ?? directionFromTo(active.position, tile);
      const target = stepInDirection(active.position, direction, 1);
      return actions.find((action) => positionEquals(action.targetPosition, target));
    }
    return actions.find((action) => positionEquals(action.targetPosition, tile));
  }
}

/** The one-shot billboard animation for a move's category (Shoot/Charge/Attack). */
function attackAnimationName(moveId: string): string {
  const category = moveAnimationCategory[moveId] ?? AnimationCategory.Contact;
  if (category === AnimationCategory.Shoot) {
    return "Shoot";
  }
  if (category === AnimationCategory.Charge) {
    return "Charge";
  }
  return "Attack";
}

/** Resolve a move's blocked tag, semantic (no i18n key). */
function resolveBlockedTag(
  move: MoveDefinition,
  isCasterTaunted: boolean,
  disabledMoveId: string | undefined,
  encoredMoveId: string | undefined,
): BlockedMoveTag | undefined {
  if (isCasterTaunted && move.category === Category.Status) {
    return "taunt";
  }
  if (disabledMoveId !== undefined && move.id === disabledMoveId) {
    return "disable";
  }
  if (encoredMoveId !== undefined && move.id !== encoredMoveId) {
    return "encore";
  }
  return undefined;
}

/** "12" when min===max, else "8-12" (port of GameController.showDamageText range). */
export function formatDamageRange(min: number, max: number): string {
  return min === max ? `${min}` : `${min}-${max}`;
}

/** " (+25%)" / " (-25%)" facing modifier suffix, or "" when neutral. */
export function formatFacingSuffix(facingModifier: number): string {
  if (facingModifier > 1) {
    return ` (+${Math.round((facingModifier - 1) * 100)}%)`;
  }
  if (facingModifier < 1) {
    return ` (-${Math.round((1 - facingModifier) * 100)}%)`;
  }
  return "";
}

function isPosition(value: Position | undefined): value is Position {
  return value !== undefined;
}

function positionEquals(a: Position | undefined, b: Position): boolean {
  return a !== undefined && a.x === b.x && a.y === b.y;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
