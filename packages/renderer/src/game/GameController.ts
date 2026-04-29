import {
  type Action,
  ActionKind,
  type BattleEngine,
  type BattleEvent,
  BattleEventType,
  type BattleState,
  type CtTimelineEntry,
  Direction,
  directionFromTo,
  EffectKind,
  EffectTarget,
  type Grid,
  type MapDefinition,
  type MoveDefinition,
  type MoveFlags,
  type PlacementEntry,
  type PlacementPhase,
  type PlacementTeam,
  PlayerController,
  PlayerId,
  type PokemonDefinition,
  PokemonGender,
  type PokemonInstance,
  PokemonType,
  type Position,
  resolveBlastImpactTile,
  resolveTargeting,
  type SpawnZone,
  StatName,
  StatusType,
  stepInDirection,
  TargetingKind,
  TerrainType,
  TurnSystemKind,
} from "@pokemon-tactic/core";
import {
  AnimationCategory,
  getMoveName,
  getPokemonName,
  moveAnimationCategory,
} from "@pokemon-tactic/data";
import {
  BATTLE_TEXT_COLOR_ABILITY,
  BATTLE_TEXT_COLOR_BUFF,
  BATTLE_TEXT_COLOR_CONFUSED,
  BATTLE_TEXT_COLOR_DAMAGE,
  BATTLE_TEXT_COLOR_DEBUFF,
  BATTLE_TEXT_COLOR_EXTREMELY_EFFECTIVE,
  BATTLE_TEXT_COLOR_FALL_DAMAGE,
  BATTLE_TEXT_COLOR_HEAL,
  BATTLE_TEXT_COLOR_IMMUNE,
  BATTLE_TEXT_COLOR_INFO,
  BATTLE_TEXT_COLOR_MISS,
  BATTLE_TEXT_COLOR_MOSTLY_INEFFECTIVE,
  BATTLE_TEXT_COLOR_NOT_VERY_EFFECTIVE,
  BATTLE_TEXT_COLOR_SUPER_EFFECTIVE,
  BATTLE_TEXT_STAGGER_Y,
  DEPTH_POKEMON_BASE,
  DEPTH_TILE_MAX_ELEVATION,
  getTeamColorByPlayerId,
  KNOCKBACK_SHAKE_DURATION_MS,
  KNOCKBACK_SHAKE_OFFSET_X,
  KNOCKBACK_SHAKE_REPEAT,
  MOVE_TWEEN_DURATION_MS,
  POKEMON_OCCLUSION_BBOX_SIZE,
  POKEMON_SPRITE_GROUND_OFFSET_Y,
  PREVIEW_FLASH_ALPHA,
  PREVIEW_FLASH_DURATION_MS,
  TEAM_COLORS,
  TILE_PREVIEW_ALPHA,
  TILE_PREVIEW_ATTACK_COLOR,
  TILE_PREVIEW_BLAST_INTERCEPT_COLOR,
  TILE_PREVIEW_BUFF_COLOR,
  TILE_SPAWN_ZONE_ALPHA,
  TILE_SPAWN_ZONE_INACTIVE_COLOR,
  TIMELINE_PREDICTION_SLOTS,
} from "../constants";
import { HighlightKind } from "../enums/highlight-kind";
import type { DecorationsLayer } from "../grid/DecorationsLayer";
import type { IsometricGrid } from "../grid/IsometricGrid";
import type { ScreenRect } from "../grid/OcclusionFader";
import { getPokemonScreenBounds } from "../grid/sprite-bounds";
import { getLanguage, t } from "../i18n";
import { getSettings } from "../settings";
import { PokemonSprite } from "../sprites/PokemonSprite";
import type { ActionMenu } from "../ui/ActionMenu";
import { type BattleLogContext, formatBattleEvent } from "../ui/BattleLogFormatter";
import type { BattleLogPanel } from "../ui/BattleLogPanel";
import { acquireSpawnDelay, resetStaggerState, showBattleText } from "../ui/BattleText";
import type { BattleUI } from "../ui/BattleUI";
import type { DirectionPicker } from "../ui/DirectionPicker";
import type { InfoPanel } from "../ui/InfoPanel";
import type { PlacementRosterPanel } from "../ui/PlacementRosterPanel";
import type { TurnTimeline } from "../ui/TurnTimeline";
import { getDirectionFromScreenPosition } from "../utils/screen-direction";
import { AnimationQueue } from "./AnimationQueue";
import type { BattleSetupResult } from "./BattleSetup";
import {
  FLYING_GLIDE_ANIMATION_CANDIDATES,
  FLYING_OVERFLY_TERRAINS,
  getFlyingAnimationMode,
  isJumpStep,
  selectMovementAnimation,
  selectMovementDuration,
} from "./movement-animation";

export interface BattleConfig {
  confirmAttack: boolean;
}

const DEFAULT_BATTLE_CONFIG: BattleConfig = {
  confirmAttack: true,
};

const STAT_SHORT_KEYS: Partial<Record<StatName, string>> = {
  attack: "atk",
  defense: "def",
  spAttack: "spA",
  spDefense: "spD",
  speed: "spd",
  accuracy: "acc",
  evasion: "eva",
};

type InputState =
  | { phase: "placement"; selectedPokemonId: string | null }
  | { phase: "placement_direction" }
  | { phase: "action_menu" }
  | { phase: "select_move_destination" }
  | { phase: "attack_submenu" }
  | { phase: "select_attack_target"; moveId: string }
  | { phase: "confirm_attack"; moveId: string; action: Action; affectedTiles: Position[] }
  | { phase: "select_direction" }
  | { phase: "animating" }
  | { phase: "battle_over"; winnerId: string };

export interface PlacementConfig {
  placementPhase: PlacementPhase;
  teams: PlacementTeam[];
  map: MapDefinition;
  formatIndex: number;
  pokemonDefinitions: Map<string, PokemonDefinition>;
  onPlacementComplete: (placements: PlacementEntry[]) => void;
}

export class GameController {
  private setup: BattleSetupResult | null = null;
  private readonly scene: Phaser.Scene;
  private readonly isometricGrid: IsometricGrid;
  private readonly sprites: Map<string, PokemonSprite>;
  private readonly animationQueue: AnimationQueue;
  private readonly battleUI: BattleUI;
  private readonly actionMenu: ActionMenu;
  private readonly directionPicker: DirectionPicker;
  private readonly infoPanel: InfoPanel;
  private readonly turnTimeline: TurnTimeline;
  private readonly placementRosterPanel: PlacementRosterPanel | null;
  private readonly battleLogPanel: BattleLogPanel | null;
  private readonly battleConfig: BattleConfig;
  private inputState: InputState = { phase: "placement", selectedPokemonId: null };
  private legalActions: Action[] = [];
  onTurnReady: ((activePokemonId: string) => BattleEvent[] | false) | null = null;
  private placementConfig: PlacementConfig | null = null;
  private placementSprites: Map<string, PokemonSprite> = new Map();
  private currentPreviewDirection: Direction | null = null;
  private currentPreviewTiles: Position[] = [];
  private previewFlashTweens: Phaser.Tweens.Tween[] = [];
  private hoveredEnemyRangePokemonId: string | null = null;
  private decorationsLayer: DecorationsLayer | null = null;

  constructor(
    scene: Phaser.Scene,
    isometricGrid: IsometricGrid,
    sprites: Map<string, PokemonSprite>,
    battleUI: BattleUI,
    actionMenu: ActionMenu,
    directionPicker: DirectionPicker,
    infoPanel: InfoPanel,
    turnTimeline: TurnTimeline,
    placementRosterPanel: PlacementRosterPanel | null,
    battleLogPanel: BattleLogPanel | null,
    setup?: BattleSetupResult,
    battleConfig?: BattleConfig,
  ) {
    this.scene = scene;
    this.isometricGrid = isometricGrid;
    this.sprites = sprites;
    this.animationQueue = new AnimationQueue();
    this.battleUI = battleUI;
    this.actionMenu = actionMenu;
    this.directionPicker = directionPicker;
    this.infoPanel = infoPanel;
    this.turnTimeline = turnTimeline;
    this.placementRosterPanel = placementRosterPanel;
    this.battleLogPanel = battleLogPanel;
    this.setup = setup ?? null;
    this.battleConfig = battleConfig ?? DEFAULT_BATTLE_CONFIG;
    resetStaggerState();
  }

  setSetup(setup: BattleSetupResult): void {
    this.setup = setup;
  }

  processStartupEvents(): void {
    if (!this.setup) {
      return;
    }
    const startupEvents = this.setup.engine.consumeStartupEvents();
    if (startupEvents.length > 0) {
      this.animationQueue.enqueue(async () => {
        await this.processEvents(startupEvents);
      });
    }
  }

  setDecorationsLayer(layer: DecorationsLayer): void {
    this.decorationsLayer = layer;
  }

  get engine(): BattleEngine {
    if (!this.setup) {
      throw new Error("BattleEngine not initialized — placement phase still active");
    }
    return this.setup.engine;
  }

  get state(): BattleState {
    if (!this.setup) {
      throw new Error("BattleState not initialized — placement phase still active");
    }
    return this.setup.state;
  }

  get pokemonDefinitions(): Map<string, PokemonDefinition> {
    if (!this.setup) {
      throw new Error("Setup not initialized — placement phase still active");
    }
    return this.setup.pokemonDefinitions;
  }

  get moveDefinitions(): Map<string, MoveDefinition> {
    if (!this.setup) {
      throw new Error("Setup not initialized — placement phase still active");
    }
    return this.setup.moveDefinitions;
  }

  get isAnimating(): boolean {
    return this.inputState.phase === "animating";
  }

  getActivePokemon(): PokemonInstance | null {
    if (!this.setup) {
      return null;
    }
    const pokemonId = this.getActivePokemonId();
    if (!pokemonId) {
      return null;
    }
    return this.setup.state.pokemon.get(pokemonId) ?? null;
  }

  getPokemonAtPosition(gridX: number, gridY: number): PokemonInstance | null {
    if (!this.setup) {
      return null;
    }
    for (const pokemon of this.setup.state.pokemon.values()) {
      if (pokemon.currentHp > 0 && pokemon.position.x === gridX && pokemon.position.y === gridY) {
        return pokemon;
      }
    }
    return null;
  }

  collectLiveOcclusionTargets(): Array<{
    depth: number;
    screenBounds: ScreenRect;
  }> {
    if (!this.setup) {
      return [];
    }
    const targets: Array<{ depth: number; screenBounds: ScreenRect }> = [];
    for (const pokemon of this.setup.state.pokemon.values()) {
      if (pokemon.currentHp <= 0) {
        continue;
      }
      const sprite = this.sprites.get(pokemon.id);
      if (!sprite) {
        continue;
      }
      const container = sprite.getContainer();
      const tileHeight = this.isometricGrid.getTileHeight(pokemon.position.x, pokemon.position.y);
      const depth =
        DEPTH_POKEMON_BASE +
        (pokemon.position.x + pokemon.position.y) * DEPTH_TILE_MAX_ELEVATION +
        tileHeight +
        0.5;
      targets.push({
        depth,
        screenBounds: getPokemonScreenBounds(container.x, container.y, POKEMON_OCCLUSION_BBOX_SIZE),
      });
    }
    return targets;
  }

  getActivePokemonId(): string | null {
    if (!this.setup) {
      return null;
    }
    const turnOrder = this.setup.state.turnOrder;
    const index = this.setup.state.currentTurnIndex;
    return turnOrder[index] ?? null;
  }

  private computeCtSequence(moveId?: string): CtTimelineEntry[] {
    if (!this.setup || this.state.turnSystemKind !== TurnSystemKind.ChargeTime) {
      return [];
    }
    return this.engine.predictCtTimeline(TIMELINE_PREDICTION_SLOTS, moveId);
  }

  getActivePlayerId(): string | null {
    if (!this.setup) {
      return null;
    }
    const pokemonId = this.getActivePokemonId();
    if (!pokemonId) {
      return null;
    }
    return this.setup.state.pokemon.get(pokemonId)?.playerId ?? null;
  }

  handleTileClick(gridX: number, gridY: number): void {
    if (
      this.inputState.phase === "animating" ||
      this.inputState.phase === "battle_over" ||
      this.inputState.phase === "select_direction" ||
      this.inputState.phase === "placement_direction"
    ) {
      return;
    }

    if (this.inputState.phase === "placement") {
      this.handlePlacementTileClick(gridX, gridY);
      return;
    }

    const activePokemonId = this.getActivePokemonId();
    if (!activePokemonId) {
      return;
    }

    const activePlayerId = this.getActivePlayerId();
    if (!activePlayerId) {
      return;
    }

    if (this.inputState.phase === "select_move_destination") {
      const moveAction = this.findMoveAction(gridX, gridY);
      if (moveAction) {
        this.executeAction(activePlayerId, moveAction);
        return;
      }
      this.enterActionMenu();
      return;
    }

    if (this.inputState.phase === "select_attack_target") {
      const { moveId } = this.inputState;
      const action = this.resolveAttackAction(moveId, gridX, gridY);
      if (action) {
        if (this.battleConfig.confirmAttack) {
          this.enterConfirmAttack(moveId, action);
        } else {
          this.clearPreviewState();
          this.executeAction(activePlayerId, action);
        }
        return;
      }
      this.clearPreviewState();
      this.enterAttackSubmenu();
      return;
    }

    if (this.inputState.phase === "confirm_attack") {
      const { action } = this.inputState;
      this.clearPreviewState();
      this.executeAction(activePlayerId, action);
    }
  }

  handleTileHover(
    gridPosition: { x: number; y: number } | null,
    worldPosition: { x: number; y: number },
  ): void {
    if (this.inputState.phase !== "select_attack_target") {
      return;
    }

    const { moveId } = this.inputState;
    const activePokemon = this.getActivePokemon();
    if (!activePokemon) {
      return;
    }

    const moveDefinition = this.moveDefinitions.get(moveId);
    if (!moveDefinition) {
      return;
    }

    const targeting = moveDefinition.targeting;

    if (this.isStaticPattern(targeting.kind)) {
      return;
    }

    if (!gridPosition) {
      this.isometricGrid.clearPreview();
      this.currentPreviewDirection = null;
      this.currentPreviewTiles = [];
      return;
    }

    const grid = this.engine.getGrid();
    const casterTileHeight = this.isometricGrid.getTileHeight(
      activePokemon.position.x,
      activePokemon.position.y,
    );
    const casterScreenPos = this.isometricGrid.gridToScreen(
      activePokemon.position.x,
      activePokemon.position.y,
      casterTileHeight,
    );

    let affectedTiles: Position[] = [];

    if (this.isDirectionalPattern(targeting.kind) || targeting.kind === TargetingKind.Dash) {
      const direction = getDirectionFromScreenPosition(
        worldPosition.x,
        worldPosition.y,
        casterScreenPos.x,
        casterScreenPos.y,
      );

      if (direction === this.currentPreviewDirection) {
        return;
      }

      this.currentPreviewDirection = direction;
      const targetPosition = stepInDirection(activePokemon.position, direction, 1);
      affectedTiles = resolveTargeting(targeting, activePokemon, targetPosition, grid, undefined, {
        type: moveDefinition.type,
        flags: moveDefinition.flags,
      });
    } else {
      const isValidTarget = this.legalActions.some(
        (action) =>
          action.kind === ActionKind.UseMove &&
          action.moveId === moveId &&
          action.targetPosition.x === gridPosition.x &&
          action.targetPosition.y === gridPosition.y,
      );

      if (!isValidTarget) {
        this.isometricGrid.clearPreview();
        this.currentPreviewTiles = [];
        return;
      }

      affectedTiles = resolveTargeting(targeting, activePokemon, gridPosition, grid, undefined, {
        type: moveDefinition.type,
        flags: moveDefinition.flags,
      });
    }

    this.currentPreviewTiles = affectedTiles;
    const blastImpact = this.computeBlastImpactTile(
      targeting.kind,
      activePokemon.position,
      gridPosition,
      grid,
      moveDefinition.type,
      moveDefinition.flags,
    );
    this.renderPreview(affectedTiles, this.isBuff(moveDefinition), blastImpact);
  }

  private computeBlastImpactTile(
    kind: TargetingKind,
    origin: Position,
    target: Position,
    grid: Grid,
    moveType: PokemonType,
    moveFlags: MoveFlags | undefined,
  ): Position | undefined {
    if (kind !== TargetingKind.Blast) {
      return undefined;
    }
    const impact = resolveBlastImpactTile(origin, target, grid, {
      type: moveType,
      flags: moveFlags,
    });
    return impact ?? undefined;
  }

  handleEnemyRangeHover(hoveredPokemon: PokemonInstance | null): void {
    const activePlayerId = this.getActivePlayerId();
    if (!activePlayerId) {
      this.clearEnemyRangeHighlight();
      return;
    }

    const validPhases: InputState["phase"][] = [
      "action_menu",
      "select_move_destination",
      "attack_submenu",
    ];
    if (!validPhases.includes(this.inputState.phase)) {
      this.clearEnemyRangeHighlight();
      return;
    }

    if (
      !hoveredPokemon ||
      hoveredPokemon.playerId === activePlayerId ||
      hoveredPokemon.currentHp <= 0 ||
      hoveredPokemon.id === this.getActivePokemonId()
    ) {
      this.clearEnemyRangeHighlight();
      return;
    }

    if (hoveredPokemon.id === this.hoveredEnemyRangePokemonId) {
      return;
    }

    const tiles = this.engine.getReachableTilesForPokemon(hoveredPokemon.id);
    this.isometricGrid.showEnemyRange(tiles);
    this.hoveredEnemyRangePokemonId = hoveredPokemon.id;
  }

  clearEnemyRangeHighlight(): void {
    if (this.hoveredEnemyRangePokemonId !== null) {
      this.isometricGrid.clearEnemyRange();
      this.hoveredEnemyRangePokemonId = null;
    }
  }

  refreshUI(): void {
    this.clearEnemyRangeHighlight();
    const activePokemonId = this.getActivePokemonId();
    const activePlayerId = this.getActivePlayerId();

    if (!activePokemonId || !activePlayerId) {
      return;
    }

    this.legalActions = this.engine.getLegalActions(activePlayerId);

    for (const [id, sprite] of this.sprites) {
      sprite.setActive(id === activePokemonId);
      const pokemon = this.state.pokemon.get(id);
      if (pokemon) {
        const isConfused = pokemon.volatileStatuses.some((v) => v.type === StatusType.Confused);
        sprite.setConfusionWobble(isConfused);
      }
    }

    const activePokemon = this.state.pokemon.get(activePokemonId);
    if (activePokemon) {
      this.battleUI.updateTurnInfo(activePokemon, activePlayerId, this.state.roundNumber);
      this.infoPanel.update(activePokemon, activePlayerId);

      const screenPos = this.isometricGrid.gridToScreen(
        activePokemon.position.x,
        activePokemon.position.y,
      );
      this.scene.cameras.main.pan(screenPos.x, screenPos.y, 400, "Sine.easeInOut");
    }

    this.turnTimeline.update(this.state, this.pokemonDefinitions, {
      sequence: this.computeCtSequence(),
    });

    if (this.onTurnReady && activePokemonId) {
      const dummyEvents = this.onTurnReady(activePokemonId);
      if (dummyEvents !== false) {
        if (dummyEvents.length > 0) {
          this.animationQueue.enqueue(async () => {
            await this.processEvents(dummyEvents);

            const battleEndedEvent = dummyEvents.find(
              (event) => event.type === BattleEventType.BattleEnded,
            );
            if (battleEndedEvent && battleEndedEvent.type === BattleEventType.BattleEnded) {
              this.inputState = { phase: "battle_over", winnerId: battleEndedEvent.winnerId };
              this.battleUI.showVictory(battleEndedEvent.winnerId, this.state.roundNumber);
            } else {
              this.refreshUI();
            }
          });
        } else {
          this.scene.time.delayedCall(100, () => this.refreshUI());
        }
        return;
      }
    }

    this.enterActionMenu();
  }

  private enterActionMenu(): void {
    this.inputState = { phase: "action_menu" };
    this.isometricGrid.clearHighlights();
    this.decorationsLayer?.setPreviewMode(false);

    const canMove = this.legalActions.some((action) => action.kind === ActionKind.Move);
    const canUndoMove = this.legalActions.some((action) => action.kind === ActionKind.UndoMove);
    const canAct = this.legalActions.some((action) => action.kind === ActionKind.UseMove);

    this.actionMenu.show({
      canMove,
      canUndoMove,
      canAct,
      callbacks: {
        onMove: () => this.enterMoveDestination(),
        onUndoMove: () => this.handleUndoMove(),
        onAttack: () => this.enterAttackSubmenu(),
        onWait: () => this.handleEndTurn(),
      },
    });
  }

  private enterMoveDestination(): void {
    this.inputState = { phase: "select_move_destination" };
    this.actionMenu.hide();
    this.isometricGrid.clearHighlights();

    const movePositions = this.legalActions
      .filter(
        (action): action is Action & { kind: typeof ActionKind.Move } =>
          action.kind === ActionKind.Move,
      )
      .map((action) => action.path[action.path.length - 1])
      .filter((position): position is { x: number; y: number } => position !== undefined);

    if (movePositions.length > 0) {
      this.isometricGrid.highlightTiles(movePositions, HighlightKind.Move);
    }
    this.decorationsLayer?.setPreviewMode(true);
  }

  private enterAttackSubmenu(): void {
    this.inputState = { phase: "attack_submenu" };
    this.isometricGrid.clearHighlights();
    this.decorationsLayer?.setPreviewMode(false);

    const activePokemon = this.getActivePokemon();
    if (!activePokemon) {
      return;
    }

    const useMoveIds = new Set<string>();
    for (const action of this.legalActions) {
      if (action.kind === ActionKind.UseMove) {
        useMoveIds.add(action.moveId);
      }
    }

    const moves = activePokemon.moveIds
      .map((moveId) => {
        const definition = this.moveDefinitions.get(moveId);
        if (!definition) {
          return null;
        }
        return {
          definition,
          currentPp: activePokemon.currentPp[moveId] ?? 0,
          hasTargets: useMoveIds.has(moveId),
        };
      })
      .filter((move): move is NonNullable<typeof move> => move !== null);

    this.actionMenu.showAttackSubmenu({
      moves,
      onSelect: (moveId: string) => this.enterAttackTarget(moveId),
      onCancel: () => this.enterActionMenu(),
      turnSystemKind: this.state.turnSystemKind ?? TurnSystemKind.RoundRobin,
    });
  }

  private enterAttackTarget(moveId: string): void {
    this.inputState = { phase: "select_attack_target", moveId };
    this.isometricGrid.clearHighlights();
    this.clearPreviewState();
    this.decorationsLayer?.setPreviewMode(true);

    const moveDefinition = this.moveDefinitions.get(moveId);
    if (!moveDefinition) {
      return;
    }

    const activePokemon = this.getActivePokemon();
    const currentPp = activePokemon?.currentPp[moveId] ?? 0;
    this.actionMenu.showSelectedMove(
      { definition: moveDefinition, currentPp },
      t("attack.selectTarget"),
      this.state.turnSystemKind ?? TurnSystemKind.RoundRobin,
    );

    const targeting = moveDefinition.targeting;

    if (this.isStaticPattern(targeting.kind)) {
      const activePokemon = this.getActivePokemon();
      if (activePokemon) {
        const grid = this.engine.getGrid();
        const affectedTiles = resolveTargeting(
          targeting,
          activePokemon,
          activePokemon.position,
          grid,
          undefined,
          { type: moveDefinition.type, flags: moveDefinition.flags },
        );
        this.currentPreviewTiles = affectedTiles;
        this.renderPreview(affectedTiles, this.isBuff(moveDefinition));
      }
      return;
    }

    if (this.isDirectionalPattern(targeting.kind)) {
      return;
    }

    const targetPositions = this.legalActions
      .filter(
        (action): action is Action & { kind: typeof ActionKind.UseMove } =>
          action.kind === ActionKind.UseMove && action.moveId === moveId,
      )
      .map((action) => action.targetPosition);

    if (targetPositions.length > 0) {
      this.isometricGrid.highlightTilesOutline(targetPositions);
    }
  }

  private handleUndoMove(): void {
    const activePokemon = this.getActivePokemon();
    if (!activePokemon) {
      return;
    }

    const undoAction = this.legalActions.find((action) => action.kind === ActionKind.UndoMove);
    if (!undoAction) {
      return;
    }

    this.executeAction(activePokemon.playerId, undoAction);
  }

  private handleEndTurn(): void {
    this.enterDirectionSelection();
  }

  private enterDirectionSelection(): void {
    const activePokemon = this.getActivePokemon();
    if (!activePokemon) {
      return;
    }

    this.inputState = { phase: "select_direction" };
    this.actionMenu.hide();
    this.isometricGrid.clearHighlights();

    const sprite = this.sprites.get(activePokemon.id);
    if (sprite) {
      sprite.setHpBarVisible(false);
    }

    const height = this.isometricGrid.getTileHeight(
      activePokemon.position.x,
      activePokemon.position.y,
    );
    const screenPos = this.isometricGrid.gridToScreen(
      activePokemon.position.x,
      activePokemon.position.y,
      height,
    );

    this.directionPicker.show(screenPos.x, screenPos.y, activePokemon.orientation, {
      onPreview: (direction: Direction) => {
        if (sprite) {
          sprite.setDirection(direction);
        }
      },
      onConfirm: (direction: Direction) => this.confirmDirection(direction),
      onCancel: () => this.cancelDirectionSelection(),
    });
  }

  private confirmDirection(direction: Direction): void {
    const activePokemonId = this.getActivePokemonId();
    const activePlayerId = this.getActivePlayerId();
    if (!activePokemonId || !activePlayerId) {
      return;
    }

    const sprite = this.sprites.get(activePokemonId);
    if (sprite) {
      sprite.setHpBarVisible(true);
    }

    const endTurnAction: Action = {
      kind: ActionKind.EndTurn,
      pokemonId: activePokemonId,
      direction,
    };
    this.executeAction(activePlayerId, endTurnAction);
  }

  private cancelDirectionSelection(): void {
    const activePokemon = this.getActivePokemon();
    if (activePokemon) {
      const sprite = this.sprites.get(activePokemon.id);
      if (sprite) {
        sprite.setHpBarVisible(true);
        sprite.setDirection(activePokemon.orientation);
      }
    }
    this.enterActionMenu();
  }

  private findMoveAction(gridX: number, gridY: number): Action | null {
    return (
      this.legalActions.find((action) => {
        if (action.kind !== ActionKind.Move) {
          return false;
        }
        const destination = action.path[action.path.length - 1];
        return destination?.x === gridX && destination?.y === gridY;
      }) ?? null
    );
  }

  private findUseMoveAction(moveId: string, gridX: number, gridY: number): Action | null {
    return (
      this.legalActions.find((action) => {
        if (action.kind !== ActionKind.UseMove) {
          return false;
        }
        return (
          action.moveId === moveId &&
          action.targetPosition.x === gridX &&
          action.targetPosition.y === gridY
        );
      }) ?? null
    );
  }

  private executeAction(playerId: string, action: Action): void {
    this.inputState = { phase: "animating" };
    this.clearPreviewState();
    this.isometricGrid.clearHighlights();
    this.decorationsLayer?.setPreviewMode(false);
    this.actionMenu.hide();

    const result = this.engine.submitAction(playerId, action);

    if (!result.success) {
      this.enterActionMenu();
      return;
    }

    this.animationQueue.enqueue(async () => {
      await this.processEvents(result.events);

      const battleEndedEvent = result.events.find(
        (event) => event.type === BattleEventType.BattleEnded,
      );

      if (battleEndedEvent && battleEndedEvent.type === BattleEventType.BattleEnded) {
        this.inputState = { phase: "battle_over", winnerId: battleEndedEvent.winnerId };
        this.battleUI.showVictory(battleEndedEvent.winnerId, this.state.roundNumber);
      } else {
        this.refreshUI();
      }
    });
  }

  private async animateAlongPath(pokemonId: string, path: Position[]): Promise<void> {
    const sprite = this.sprites.get(pokemonId);
    if (!sprite) {
      return;
    }
    const pokemon = this.state.pokemon.get(pokemonId);
    const definitionId = pokemon?.definitionId ?? pokemonId.replace(/^p\d+-/, "");
    const definition = this.pokemonDefinitions.get(definitionId);
    const isFlying = definition?.types.includes(PokemonType.Flying) ?? false;
    const isGhost = definition?.types.includes(PokemonType.Ghost) ?? false;

    let previous = sprite.gridPosition;
    let previousHeight = this.isometricGrid.getTileHeight(previous.x, previous.y);
    for (const step of path) {
      const direction = directionFromTo(previous, step);
      sprite.setDirection(direction);
      const prevHeight = previousHeight;
      const rawStepHeight = this.isometricGrid.getTileHeight(step.x, step.y);
      const stepTerrain = this.isometricGrid.getTileTerrain(step.x, step.y);
      const stepHeight =
        isGhost && stepTerrain === TerrainType.Obstacle ? prevHeight : rawStepHeight;
      const heightDiff = Math.abs(stepHeight - prevHeight);
      const isRamp =
        this.isometricGrid.isSlopeAt(previous.x, previous.y) ||
        this.isometricGrid.isSlopeAt(step.x, step.y);
      const movementStep = { heightDiff, isRamp, isFlying, terrainType: stepTerrain };
      const isJump = isJumpStep(movementStep);
      const stepDuration = selectMovementDuration(movementStep);

      const flyingMode = getFlyingAnimationMode(movementStep);
      if (flyingMode === "glide") {
        const played = sprite.playFirstAvailableAnimation(FLYING_GLIDE_ANIMATION_CANDIDATES);
        if (played === null) {
          sprite.playAnimation(selectMovementAnimation(movementStep));
        }
      } else {
        sprite.playAnimation(selectMovementAnimation(movementStep));
      }

      await sprite.animateMoveTo(step.x, step.y, stepHeight, stepDuration, { isJump });
      previous = step;
      previousHeight = stepHeight;
    }

    const finalStep = path.at(-1);
    const finalTerrain = finalStep
      ? this.isometricGrid.getTileTerrain(finalStep.x, finalStep.y)
      : undefined;
    const landOnSpecialTerrain =
      isFlying && finalTerrain !== undefined && FLYING_OVERFLY_TERRAINS.has(finalTerrain);
    sprite.setRestingAnimation(landOnSpecialTerrain ? FLYING_GLIDE_ANIMATION_CANDIDATES : ["Idle"]);
  }

  private async processEvents(events: BattleEvent[]): Promise<void> {
    for (const event of events) {
      await this.processEvent(event);
    }
  }

  private async processEvent(event: BattleEvent): Promise<void> {
    this.feedBattleLog(event);

    switch (event.type) {
      case BattleEventType.MoveStarted: {
        const sprite = this.sprites.get(event.attackerId);
        if (sprite) {
          sprite.setDirection(event.direction);
          const category = moveAnimationCategory[event.moveId] ?? AnimationCategory.Contact;
          const animationName =
            category === AnimationCategory.Shoot
              ? "Shoot"
              : category === AnimationCategory.Charge
                ? "Charge"
                : "Attack";
          await sprite.playAttackAnimation(animationName, "Attack");
        }
        break;
      }

      case BattleEventType.PokemonMoved: {
        await this.animateAlongPath(event.pokemonId, event.path);
        break;
      }

      case BattleEventType.MoveCancelled: {
        const sprite = this.sprites.get(event.pokemonId);
        if (sprite) {
          const height = this.isometricGrid.getTileHeight(event.position.x, event.position.y);
          sprite.updatePosition(event.position.x, event.position.y, height);
          const pokemon = this.state.pokemon.get(event.pokemonId);
          if (pokemon) {
            sprite.setDirection(pokemon.orientation);
            sprite.updateStatus(pokemon.statusEffects);
          }
          sprite.playRestingAnimation();
        }
        break;
      }

      case BattleEventType.DamageDealt: {
        const sprite = this.sprites.get(event.targetId);
        const pokemon = this.state.pokemon.get(event.targetId);
        if (sprite && pokemon) {
          const pos = sprite.getTextPosition();
          if (event.amount < 0) {
            sprite.updateHp(pokemon.currentHp, pokemon.maxHp);
            showBattleText(this.scene, pos.x, pos.y, `+${Math.abs(event.amount)}`, {
              color: BATTLE_TEXT_COLOR_HEAL,
              targetId: event.targetId,
            });
          } else if (event.effectiveness === 0) {
            showBattleText(this.scene, pos.x, pos.y, t("battle.immune"), {
              color: BATTLE_TEXT_COLOR_IMMUNE,
              targetId: event.targetId,
            });
          } else {
            sprite.updateHp(pokemon.currentHp, pokemon.maxHp);
            // Compute the beat delay once so the damage number and the
            // effectiveness label spawn together as a single scroll. Queued
            // by targetId — multi-hit beats stack up in the queue.
            const beatDelay = acquireSpawnDelay(event.targetId, this.scene.time.now);
            showBattleText(this.scene, pos.x, pos.y, `-${event.amount}`, {
              color: BATTLE_TEXT_COLOR_DAMAGE,
              delay: beatDelay,
            });
            if (event.effectiveness >= 4) {
              showBattleText(this.scene, pos.x, pos.y, t("battle.extremelyEffective"), {
                color: BATTLE_TEXT_COLOR_EXTREMELY_EFFECTIVE,
                delay: beatDelay,
                offsetY: BATTLE_TEXT_STAGGER_Y,
              });
            } else if (event.effectiveness >= 2) {
              showBattleText(this.scene, pos.x, pos.y, t("battle.superEffective"), {
                color: BATTLE_TEXT_COLOR_SUPER_EFFECTIVE,
                delay: beatDelay,
                offsetY: BATTLE_TEXT_STAGGER_Y,
              });
            } else if (event.effectiveness <= 0.25) {
              showBattleText(this.scene, pos.x, pos.y, t("battle.mostlyIneffective"), {
                color: BATTLE_TEXT_COLOR_MOSTLY_INEFFECTIVE,
                delay: beatDelay,
                offsetY: BATTLE_TEXT_STAGGER_Y,
              });
            } else if (event.effectiveness <= 0.5) {
              showBattleText(this.scene, pos.x, pos.y, t("battle.notVeryEffective"), {
                color: BATTLE_TEXT_COLOR_NOT_VERY_EFFECTIVE,
                delay: beatDelay,
                offsetY: BATTLE_TEXT_STAGGER_Y,
              });
            }
            sprite.flashDamage();
          }
        }
        this.updateInfoPanelForActivePokemon();
        break;
      }

      case BattleEventType.PokemonKo:
        break;

      case BattleEventType.PokemonEliminated: {
        const sprite = this.sprites.get(event.pokemonId);
        if (sprite) {
          await sprite.playFaintAndStay();
        }
        break;
      }

      case BattleEventType.PokemonDashed: {
        await this.animateAlongPath(event.pokemonId, event.path);
        break;
      }

      case BattleEventType.StatusApplied: {
        const sprite = this.sprites.get(event.targetId);
        if (sprite) {
          sprite.updateStatus([{ type: event.status }]);
          sprite.setStatusAnimation(event.status === StatusType.Asleep);
          if (event.status === StatusType.Confused) {
            sprite.setConfusionWobble(true);
          }
        }
        this.updateInfoPanelForActivePokemon();
        break;
      }

      case BattleEventType.StatusRemoved: {
        const sprite = this.sprites.get(event.targetId);
        if (sprite) {
          sprite.updateStatus([]);
          sprite.setStatusAnimation(false);
          if (event.status === StatusType.Confused) {
            sprite.setConfusionWobble(false);
          }
        }
        this.updateInfoPanelForActivePokemon();
        break;
      }

      case BattleEventType.StatusImmune: {
        const sprite = this.sprites.get(event.targetId);
        if (sprite) {
          const pos = sprite.getTextPosition();
          showBattleText(this.scene, pos.x, pos.y, t("battle.immune"), {
            color: BATTLE_TEXT_COLOR_IMMUNE,
            targetId: event.targetId,
          });
        }
        break;
      }

      case BattleEventType.TerrainStatusApplied: {
        const sprite = this.sprites.get(event.pokemonId);
        const pokemon = this.state.pokemon.get(event.pokemonId);
        if (sprite && pokemon) {
          sprite.updateStatus(pokemon.statusEffects);
          sprite.setStatusAnimation(event.status === StatusType.Asleep);
        }
        this.updateInfoPanelForActivePokemon();
        break;
      }

      case BattleEventType.TurnEnded: {
        const pokemon = this.state.pokemon.get(event.pokemonId);
        const sprite = this.sprites.get(event.pokemonId);
        if (pokemon && sprite) {
          sprite.setDirection(pokemon.orientation);
        }
        break;
      }

      case BattleEventType.MoveMissed: {
        const missSprite = this.sprites.get(event.targetId);
        if (missSprite) {
          const pos = missSprite.getTextPosition();
          showBattleText(this.scene, pos.x, pos.y, t("battle.miss"), {
            color: BATTLE_TEXT_COLOR_MISS,
            targetId: event.targetId,
          });
        }
        break;
      }

      case BattleEventType.StatChanged: {
        const statSprite = this.sprites.get(event.targetId);
        if (statSprite) {
          const pos = statSprite.getTextPosition();
          const statKey = `stat.${STAT_SHORT_KEYS[event.stat] ?? event.stat}` as const;
          const statLabel = t(statKey as Parameters<typeof t>[0]);
          const isUp = event.stages > 0;
          const text = isUp
            ? t("battle.statUp", { stat: statLabel, stages: String(event.stages) })
            : t("battle.statDown", { stat: statLabel, stages: String(event.stages) });
          showBattleText(this.scene, pos.x, pos.y, text, {
            color: isUp ? BATTLE_TEXT_COLOR_BUFF : BATTLE_TEXT_COLOR_DEBUFF,
            targetId: event.targetId,
          });
        }
        this.updateInfoPanelForActivePokemon();
        break;
      }

      case BattleEventType.ConfusionTriggered: {
        const confSprite = this.sprites.get(event.pokemonId);
        if (confSprite) {
          const pos = confSprite.getTextPosition();
          showBattleText(this.scene, pos.x, pos.y, t("battle.confused"), {
            color: BATTLE_TEXT_COLOR_CONFUSED,
            targetId: event.pokemonId,
          });
        }
        break;
      }

      case BattleEventType.InfatuationTriggered: {
        const infatSprite = this.sprites.get(event.pokemonId);
        if (infatSprite) {
          const pos = infatSprite.getTextPosition();
          showBattleText(this.scene, pos.x, pos.y, t("battle.infatuated"), {
            color: BATTLE_TEXT_COLOR_CONFUSED,
            targetId: event.pokemonId,
          });
        }
        break;
      }

      case BattleEventType.DefenseActivated:
      case BattleEventType.DefenseCleared:
        break;

      case BattleEventType.DefenseTriggered: {
        if (event.blocked) {
          const defSprite = this.sprites.get(event.defenderId);
          if (defSprite) {
            const pos = defSprite.getTextPosition();
            showBattleText(this.scene, pos.x, pos.y, t("battle.blocked"), {
              color: BATTLE_TEXT_COLOR_BUFF,
              targetId: event.defenderId,
            });
          }
        }
        break;
      }

      case BattleEventType.MultiHitComplete: {
        const mhSprite = this.sprites.get(event.targetId);
        if (mhSprite) {
          const pos = mhSprite.getTextPosition();
          showBattleText(
            this.scene,
            pos.x,
            pos.y,
            t("battle.hits", { count: String(event.totalHits) }),
            {
              color: BATTLE_TEXT_COLOR_INFO,
              targetId: event.targetId,
            },
          );
        }
        break;
      }

      case BattleEventType.RechargeStarted: {
        const rcSprite = this.sprites.get(event.pokemonId);
        if (rcSprite) {
          const pos = rcSprite.getTextPosition();
          showBattleText(this.scene, pos.x, pos.y, t("battle.recharge"), {
            color: BATTLE_TEXT_COLOR_INFO,
            targetId: event.pokemonId,
          });
        }
        break;
      }

      case BattleEventType.KnockbackApplied: {
        const kbSprite = this.sprites.get(event.pokemonId);
        if (kbSprite) {
          const kbHeight = this.isometricGrid.getTileHeight(event.to.x, event.to.y);
          const target = this.isometricGrid.gridToScreen(event.to.x, event.to.y, kbHeight);
          kbSprite.playAnimation("Hurt");
          await new Promise<void>((resolve) => {
            this.scene.tweens.add({
              targets: kbSprite.getContainer(),
              x: target.x,
              y: target.y + POKEMON_SPRITE_GROUND_OFFSET_Y,
              duration: MOVE_TWEEN_DURATION_MS,
              onComplete: () => {
                kbSprite
                  .getContainer()
                  .setDepth(
                    DEPTH_POKEMON_BASE +
                      (event.to.x + event.to.y) * DEPTH_TILE_MAX_ELEVATION +
                      kbHeight +
                      0.5,
                  );
                kbSprite.playRestingAnimation();
                resolve();
              },
            });
          });
        }
        break;
      }

      case BattleEventType.KnockbackBlocked: {
        const kbBlockSprite = this.sprites.get(event.pokemonId);
        if (kbBlockSprite) {
          kbBlockSprite.playAnimation("Hurt");
          const container = kbBlockSprite.getContainer();
          const originalX = container.x;
          await new Promise<void>((resolve) => {
            this.scene.tweens.add({
              targets: container,
              x: originalX + KNOCKBACK_SHAKE_OFFSET_X,
              duration: KNOCKBACK_SHAKE_DURATION_MS,
              yoyo: true,
              repeat: KNOCKBACK_SHAKE_REPEAT,
              onComplete: () => {
                container.setX(originalX);
                kbBlockSprite.playRestingAnimation();
                resolve();
              },
            });
          });
        }
        break;
      }

      case BattleEventType.FallDamageDealt: {
        const fallSprite = this.sprites.get(event.pokemonId);
        const fallPokemon = this.state.pokemon.get(event.pokemonId);
        if (fallSprite && fallPokemon) {
          fallSprite.updateHp(fallPokemon.currentHp, fallPokemon.maxHp);
          await fallSprite.flashDamage();
          const fallPos = fallSprite.getTextPosition();
          showBattleText(this.scene, fallPos.x, fallPos.y, `${t("battle.fall")} -${event.amount}`, {
            color: BATTLE_TEXT_COLOR_FALL_DAMAGE,
            targetId: event.pokemonId,
          });
        }
        break;
      }

      case BattleEventType.WallImpactDealt: {
        const impactSprite = this.sprites.get(event.pokemonId);
        const impactPokemon = this.state.pokemon.get(event.pokemonId);
        if (impactSprite && impactPokemon) {
          impactSprite.updateHp(impactPokemon.currentHp, impactPokemon.maxHp);
          await impactSprite.flashDamage();
          const impactPos = impactSprite.getTextPosition();
          showBattleText(
            this.scene,
            impactPos.x,
            impactPos.y,
            `${t("battle.impact")} -${event.amount}`,
            { color: BATTLE_TEXT_COLOR_FALL_DAMAGE, targetId: event.pokemonId },
          );
        }
        break;
      }

      case BattleEventType.TerrainDamageDealt: {
        const tdSprite = this.sprites.get(event.pokemonId);
        const tdPokemon = this.state.pokemon.get(event.pokemonId);
        if (tdSprite && tdPokemon) {
          tdSprite.updateHp(tdPokemon.currentHp, tdPokemon.maxHp);
          await tdSprite.flashDamage();
          const tdPos = tdSprite.getTextPosition();
          showBattleText(
            this.scene,
            tdPos.x,
            tdPos.y,
            `${t("battle.terrainDamage")} -${event.amount}`,
            { color: BATTLE_TEXT_COLOR_FALL_DAMAGE, targetId: event.pokemonId },
          );
        }
        break;
      }

      case BattleEventType.IceSlideApplied: {
        const slideSprite = this.sprites.get(event.pokemonId);
        if (slideSprite) {
          const slideHeight = this.isometricGrid.getTileHeight(event.to.x, event.to.y);
          const slideTarget = this.isometricGrid.gridToScreen(event.to.x, event.to.y, slideHeight);
          await new Promise<void>((resolve) => {
            this.scene.tweens.add({
              targets: slideSprite.getContainer(),
              x: slideTarget.x,
              y: slideTarget.y + POKEMON_SPRITE_GROUND_OFFSET_Y,
              duration: MOVE_TWEEN_DURATION_MS,
              ease: "Linear",
              onComplete: () => {
                slideSprite
                  .getContainer()
                  .setDepth(
                    DEPTH_POKEMON_BASE +
                      (event.to.x + event.to.y) * DEPTH_TILE_MAX_ELEVATION +
                      slideHeight +
                      0.5,
                  );
                resolve();
              },
            });
          });
        }
        break;
      }

      case BattleEventType.LethalTerrainKo: {
        const ltSprite = this.sprites.get(event.pokemonId);
        if (ltSprite) {
          const ltPos = ltSprite.getTextPosition();
          const text =
            event.terrain === TerrainType.Lava ? t("battle.melted") : t("battle.drowned");
          showBattleText(this.scene, ltPos.x, ltPos.y, text, {
            color: BATTLE_TEXT_COLOR_FALL_DAMAGE,
            targetId: event.pokemonId,
          });
        }
        break;
      }

      case BattleEventType.AbilityActivated: {
        const abilitySprite = this.sprites.get(event.pokemonId);
        if (abilitySprite && this.setup) {
          const abilityDef = this.setup.abilityRegistry.get(event.abilityId);
          if (abilityDef) {
            const pos = abilitySprite.getTextPosition();
            const lang = getLanguage();
            showBattleText(this.scene, pos.x, pos.y, `${abilityDef.name[lang]}!`, {
              color: BATTLE_TEXT_COLOR_ABILITY,
              targetId: event.pokemonId,
            });
          }
        }
        break;
      }

      default:
        break;
    }
  }

  private updateInfoPanelForActivePokemon(): void {
    const activePokemon = this.getActivePokemon();
    const activePlayerId = this.getActivePlayerId();
    if (activePokemon && activePlayerId) {
      this.infoPanel.update(activePokemon, activePlayerId);
    }
  }

  private isDirectionalPattern(kind: TargetingKind): boolean {
    return (
      kind === TargetingKind.Cone || kind === TargetingKind.Line || kind === TargetingKind.Slash
    );
  }

  private isBuff(move: MoveDefinition): boolean {
    const hasDamage = move.effects.some((effect) => effect.kind === EffectKind.Damage);
    const hasOffensiveEffect = move.effects.some(
      (effect) =>
        (effect.kind === EffectKind.StatChange && effect.target === EffectTarget.Targets) ||
        effect.kind === EffectKind.Status,
    );
    return !hasDamage && !hasOffensiveEffect;
  }

  private isStaticPattern(kind: TargetingKind): boolean {
    return (
      kind === TargetingKind.Self || kind === TargetingKind.Cross || kind === TargetingKind.Zone
    );
  }

  private renderPreview(affectedTiles: Position[], isBuff: boolean, impactTile?: Position): void {
    this.isometricGrid.clearPreview();

    if (affectedTiles.length === 0 && !impactTile) {
      return;
    }

    const color = isBuff ? TILE_PREVIEW_BUFF_COLOR : TILE_PREVIEW_ATTACK_COLOR;
    if (affectedTiles.length > 0) {
      this.isometricGrid.showPreview(affectedTiles, color, TILE_PREVIEW_ALPHA);
    }

    if (impactTile) {
      this.isometricGrid.showPreview(
        [impactTile],
        TILE_PREVIEW_BLAST_INTERCEPT_COLOR,
        TILE_PREVIEW_ALPHA,
      );
    }
  }

  private resolveAttackAction(moveId: string, gridX: number, gridY: number): Action | null {
    const moveDefinition = this.moveDefinitions.get(moveId);
    if (!moveDefinition) {
      return null;
    }

    const targeting = moveDefinition.targeting;

    if (this.isDirectionalPattern(targeting.kind)) {
      if (this.currentPreviewDirection === null) {
        return null;
      }
      const activePokemon = this.getActivePokemon();
      if (!activePokemon) {
        return null;
      }
      const adjacent = stepInDirection(activePokemon.position, this.currentPreviewDirection, 1);
      return this.findUseMoveAction(moveId, adjacent.x, adjacent.y);
    }

    if (this.isStaticPattern(targeting.kind)) {
      const activePokemon = this.getActivePokemon();
      if (!activePokemon) {
        return null;
      }
      return this.findUseMoveAction(moveId, activePokemon.position.x, activePokemon.position.y);
    }

    return this.findUseMoveAction(moveId, gridX, gridY);
  }

  private enterConfirmAttack(moveId: string, action: Action): void {
    const affectedTiles = this.currentPreviewTiles;
    this.inputState = { phase: "confirm_attack", moveId, action, affectedTiles };
    this.actionMenu.updateInstruction(t("attack.confirm"));
    this.startPreviewFlash(affectedTiles);
    if (getSettings().damagePreview) {
      const targetPos = "targetPosition" in action ? action.targetPosition : undefined;
      this.showDamageEstimates(moveId, affectedTiles, targetPos);
    }
    if (this.state.turnSystemKind === TurnSystemKind.ChargeTime) {
      const activePokemonId = this.getActivePokemonId();
      const sequence = this.computeCtSequence(moveId);
      if (activePokemonId) {
        this.turnTimeline.scrollToHighlight(sequence, activePokemonId);
      }
      this.turnTimeline.update(this.state, this.pokemonDefinitions, {
        sequence,
        highlightPokemonId: activePokemonId ?? undefined,
      });
    }
  }

  private startPreviewFlash(affectedTiles: Position[]): void {
    this.stopPreviewFlash();

    for (const tile of affectedTiles) {
      for (const [, sprite] of this.sprites) {
        const pokemon = this.state.pokemon.get(sprite.pokemonId);
        if (
          pokemon &&
          pokemon.currentHp > 0 &&
          pokemon.position.x === tile.x &&
          pokemon.position.y === tile.y
        ) {
          const tween = this.scene.tweens.add({
            targets: sprite.getFlashTarget(),
            alpha: PREVIEW_FLASH_ALPHA,
            duration: PREVIEW_FLASH_DURATION_MS,
            yoyo: true,
            repeat: -1,
          });
          this.previewFlashTweens.push(tween);
        }
      }
    }
  }

  private stopPreviewFlash(): void {
    for (const tween of this.previewFlashTweens) {
      tween.destroy();
    }
    this.previewFlashTweens = [];

    for (const [, sprite] of this.sprites) {
      sprite.getFlashTarget().setAlpha(1);
    }
  }

  private clearPreviewState(): void {
    this.stopPreviewFlash();
    this.clearDamageEstimates();
    this.isometricGrid.clearPreview();
    this.currentPreviewDirection = null;
    this.currentPreviewTiles = [];
    this.turnTimeline.resetScroll();
    this.turnTimeline.update(this.state, this.pokemonDefinitions, {
      sequence: this.computeCtSequence(),
    });
  }

  private showDamageEstimates(
    moveId: string,
    affectedTiles: Position[],
    targetPosition?: Position,
  ): void {
    const activePokemon = this.getActivePokemon();
    if (!activePokemon) {
      return;
    }

    for (const tile of affectedTiles) {
      for (const [, sprite] of this.sprites) {
        const pokemon = this.state.pokemon.get(sprite.pokemonId);
        if (
          !pokemon ||
          pokemon.currentHp <= 0 ||
          pokemon.id === activePokemon.id ||
          pokemon.position.x !== tile.x ||
          pokemon.position.y !== tile.y
        ) {
          continue;
        }
        const estimate = this.engine.estimateDamage(
          activePokemon.id,
          moveId,
          pokemon.id,
          targetPosition,
        );
        if (estimate) {
          sprite.showDamageEstimate(estimate);
          sprite.showDamageText(estimate);
        }
      }
    }
  }

  private clearDamageEstimates(): void {
    for (const [, sprite] of this.sprites) {
      sprite.clearDamagePreview();
    }
  }

  startPlacement(config: PlacementConfig): void {
    this.placementConfig = config;
    this.inputState = { phase: "placement", selectedPokemonId: null };
    this.enterPlacement();
  }

  private enterPlacement(): void {
    if (!this.placementConfig) {
      return;
    }

    const { placementPhase, teams, map, formatIndex } = this.placementConfig;
    const next = placementPhase.getNextToPlace();
    if (!next) {
      this.finishPlacement();
      return;
    }

    const team = teams.find((t) => t.playerId === next.playerId);
    if (team?.controller === PlayerController.Ai) {
      const gridCenter = { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
      placementPhase.autoPlaceForPlayer(next.playerId, gridCenter);
      this.enterPlacement();
      return;
    }

    const format = map.formats[formatIndex];
    if (!format) {
      return;
    }

    const teamIndex = teams.findIndex((t) => t.playerId === next.playerId);

    this.isometricGrid.clearHighlights();
    this.highlightSpawnZones(format.spawnZones, teamIndex, placementPhase.getPlacedPositions());

    const unplaced = placementPhase.getUnplacedPokemonIds(next.playerId);
    const autoSelectedId = unplaced[0] ?? null;
    this.inputState = { phase: "placement", selectedPokemonId: autoSelectedId };

    if (this.placementRosterPanel) {
      const roster = team
        ? team.pokemonIds.map((pokemonId) => ({
            pokemonId,
            definitionId: pokemonId.replace(/^p\d+-/, ""),
            placed: placementPhase.getPlacements().some((p) => p.pokemonId === pokemonId),
          }))
        : [];

      this.placementRosterPanel.show(next.playerId, roster, autoSelectedId, (pokemonId: string) => {
        if (this.inputState.phase === "placement") {
          this.inputState = { phase: "placement", selectedPokemonId: pokemonId };
          this.updateRosterSelection(next.playerId, roster, pokemonId);
        }
      });
    }
  }

  private handlePlacementTileClick(gridX: number, gridY: number): void {
    if (this.inputState.phase !== "placement") {
      return;
    }
    if (!this.placementConfig) {
      return;
    }

    const { selectedPokemonId } = this.inputState;
    if (!selectedPokemonId) {
      return;
    }

    const { placementPhase } = this.placementConfig;
    const next = placementPhase.getNextToPlace();
    if (!next) {
      return;
    }

    const { teams, map, formatIndex } = this.placementConfig;
    const format = map.formats[formatIndex];
    if (!format) {
      return;
    }

    const teamIndex = teams.findIndex((t) => t.playerId === next.playerId);
    const zone = format.spawnZones[teamIndex];
    if (!zone) {
      return;
    }

    const isInZone = zone.positions.some((p) => p.x === gridX && p.y === gridY);
    if (!isInZone) {
      return;
    }

    const isOccupied = placementPhase
      .getPlacedPositions()
      .some((p) => p.x === gridX && p.y === gridY);
    if (isOccupied) {
      return;
    }

    this.enterPlacementDirection(selectedPokemonId, { x: gridX, y: gridY });
  }

  private enterPlacementDirection(pokemonId: string, position: { x: number; y: number }): void {
    if (!this.placementConfig) {
      return;
    }

    this.inputState = { phase: "placement_direction" };

    const definitionId = pokemonId.replace(/^p\d+-/, "");
    const definition = this.placementConfig.pokemonDefinitions.get(definitionId);
    const types: string[] = definition?.types ?? ["normal"];

    const tempSprite = new PokemonSprite(
      this.scene,
      this.isometricGrid,
      this.buildPlacementPokemon(pokemonId, definitionId, position),
      types,
    );
    this.placementSprites.set(pokemonId, tempSprite);

    const placementHeight = this.isometricGrid.getTileHeight(position.x, position.y);
    const screenPos = this.isometricGrid.gridToScreen(position.x, position.y, placementHeight);
    const gridCenter = {
      x: Math.floor(this.placementConfig.map.width / 2),
      y: Math.floor(this.placementConfig.map.height / 2),
    };

    const initialDirection = directionFromTo(position, gridCenter);

    tempSprite.setDirection(initialDirection);
    tempSprite.setHpBarVisible(false);

    this.directionPicker.show(screenPos.x, screenPos.y, initialDirection, {
      onPreview: (direction: Direction) => {
        tempSprite.setDirection(direction);
      },
      onConfirm: (direction: Direction) => {
        this.confirmPlacement(pokemonId, position, direction);
      },
      onCancel: () => {
        this.cancelPlacementDirection(pokemonId);
      },
    });
  }

  private confirmPlacement(
    pokemonId: string,
    position: { x: number; y: number },
    direction: Direction,
  ): void {
    if (!this.placementConfig) {
      return;
    }

    const result = this.placementConfig.placementPhase.submitPlacement(
      pokemonId,
      position,
      direction,
    );

    if (!result.success) {
      this.cancelPlacementDirection(pokemonId);
      return;
    }

    const sprite = this.placementSprites.get(pokemonId);
    if (sprite) {
      sprite.setDirection(direction);
      sprite.setHpBarVisible(true);
    }

    this.enterPlacement();
  }

  private cancelPlacementDirection(pokemonId: string): void {
    const sprite = this.placementSprites.get(pokemonId);
    if (sprite) {
      sprite.destroy();
      this.placementSprites.delete(pokemonId);
    }
    this.inputState = { phase: "placement", selectedPokemonId: pokemonId };
    this.enterPlacement();
  }

  private highlightSpawnZones(
    spawnZones: SpawnZone[],
    activeTeamIndex: number,
    occupiedPositions: Array<{ x: number; y: number }>,
  ): void {
    const occupiedKeys = new Set(occupiedPositions.map((p) => `${p.x},${p.y}`));

    for (let i = 0; i < spawnZones.length; i++) {
      const zone = spawnZones[i];
      if (!zone) {
        continue;
      }
      const baseColor = TEAM_COLORS[i] ?? TILE_SPAWN_ZONE_INACTIVE_COLOR;

      for (const position of zone.positions) {
        const key = `${position.x},${position.y}`;
        let color: number;
        let alpha: number;

        if (occupiedKeys.has(key)) {
          color = baseColor;
          alpha = 0.2;
        } else if (i === activeTeamIndex) {
          color = baseColor;
          alpha = TILE_SPAWN_ZONE_ALPHA;
        } else {
          color = baseColor;
          alpha = 0.25;
        }

        this.isometricGrid.highlightTilesWithColor([position], color, alpha);
      }
    }
  }

  private buildPlacementPokemon(
    pokemonId: string,
    definitionId: string,
    position: { x: number; y: number },
  ): PokemonInstance {
    const zeroStats = {
      [StatName.Hp]: 0,
      [StatName.Attack]: 0,
      [StatName.Defense]: 0,
      [StatName.SpAttack]: 0,
      [StatName.SpDefense]: 0,
      [StatName.Speed]: 0,
      [StatName.Accuracy]: 0,
      [StatName.Evasion]: 0,
    };
    return {
      id: pokemonId,
      definitionId,
      playerId: PlayerId.Player1,
      level: 50,
      currentHp: 1,
      maxHp: 1,
      baseStats: { hp: 1, attack: 1, defense: 1, spAttack: 1, spDefense: 1, speed: 1 },
      combatStats: { hp: 1, attack: 1, defense: 1, spAttack: 1, spDefense: 1, speed: 1 },
      derivedStats: { movement: 3, jump: 1, initiative: 1 },
      statStages: zeroStats,
      statusEffects: [],
      position,
      orientation: Direction.South,
      moveIds: [],
      currentPp: {},
      activeDefense: null,
      lastEndureRound: null,
      toxicCounter: 0,
      volatileStatuses: [],
      recharging: false,
      gender: PokemonGender.Genderless,
    };
  }

  private updateRosterSelection(
    playerId: PlayerId,
    roster: Array<{ pokemonId: string; definitionId: string; placed: boolean }>,
    selectedPokemonId: string,
  ): void {
    if (!this.placementRosterPanel) {
      return;
    }
    this.placementRosterPanel.show(playerId, roster, selectedPokemonId, (pokemonId: string) => {
      if (this.inputState.phase === "placement") {
        this.inputState = { phase: "placement", selectedPokemonId: pokemonId };
        this.updateRosterSelection(playerId, roster, pokemonId);
      }
    });
  }

  handleSpaceKey(): void {
    if (this.inputState.phase === "action_menu") {
      this.handleEndTurn();
    }
  }

  handleEscapeKey(): void {
    if (this.inputState.phase === "confirm_attack") {
      const { moveId } = this.inputState;
      this.stopPreviewFlash();
      this.clearDamageEstimates();
      this.actionMenu.updateInstruction(t("attack.selectTarget"));
      this.inputState = { phase: "select_attack_target", moveId };
      return;
    }

    if (this.inputState.phase === "select_attack_target") {
      this.clearPreviewState();
      this.enterAttackSubmenu();
      return;
    }

    if (this.inputState.phase === "attack_submenu") {
      this.enterActionMenu();
      return;
    }

    if (this.inputState.phase === "select_move_destination") {
      this.isometricGrid.clearHighlights();
      this.enterActionMenu();
      return;
    }

    if (this.inputState.phase === "placement" && this.placementConfig) {
      const undone = this.placementConfig.placementPhase.undoLastPlacement();
      if (undone) {
        const placements = this.placementConfig.placementPhase.getPlacements();
        for (const [id, sprite] of this.placementSprites) {
          if (!placements.some((p) => p.pokemonId === id)) {
            sprite.destroy();
            this.placementSprites.delete(id);
          }
        }
        this.enterPlacement();
      }
    }
  }

  private finishPlacement(): void {
    if (!this.placementConfig) {
      return;
    }

    for (const [, sprite] of this.placementSprites) {
      sprite.destroy();
    }
    this.placementSprites.clear();

    this.isometricGrid.clearHighlights();
    this.placementRosterPanel?.hide();

    const placements = this.placementConfig.placementPhase.getPlacements();
    this.placementConfig.onPlacementComplete(placements);
  }

  private feedBattleLog(event: BattleEvent): void {
    if (!this.battleLogPanel || !this.setup) {
      return;
    }

    const setup = this.setup;
    const lang = getLanguage();
    const context: BattleLogContext = {
      getPokemonName: (id) => {
        const pokemon = setup.state.pokemon.get(id);
        if (!pokemon) {
          return id;
        }
        return getPokemonName(pokemon.definitionId, lang);
      },
      getMoveName: (moveId) => {
        return getMoveName(moveId, lang);
      },
      getAbilityName: (abilityId) => {
        const ability = setup.abilityRegistry.get(abilityId);
        return ability ? ability.name[lang] : null;
      },
      language: lang,
    };

    const result = formatBattleEvent(event, context);
    if (!result) {
      return;
    }

    if (Array.isArray(result)) {
      this.battleLogPanel.addEntries(result);
    } else {
      this.battleLogPanel.addEntry(result);
    }
  }

  setupBattleLogClickHandler(): void {
    if (!this.battleLogPanel) {
      return;
    }

    this.battleLogPanel.onPokemonClick = (pokemonId: string) => {
      const pokemon = this.state.pokemon.get(pokemonId);
      if (!pokemon) {
        return;
      }
      const screenPos = this.isometricGrid.gridToScreen(pokemon.position.x, pokemon.position.y);
      this.scene.cameras.main.pan(screenPos.x, screenPos.y, 300, "Sine.easeInOut");
    };

    this.battleLogPanel.getTeamColor = (pokemonId: string) => {
      const pokemon = this.state.pokemon.get(pokemonId);
      if (!pokemon) {
        return 0xaaaaaa;
      }
      return getTeamColorByPlayerId(pokemon.playerId);
    };
  }
}
