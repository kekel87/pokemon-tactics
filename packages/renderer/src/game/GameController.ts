import {
  type Action,
  ActionKind,
  type BattleEngine,
  type BattleEvent,
  BattleEventType,
  type BattleState,
  Direction,
  directionFromTo,
  type MapDefinition,
  type MoveDefinition,
  type PlacementEntry,
  type PlacementPhase,
  type PlacementTeam,
  PlayerController,
  PlayerId,
  type PokemonDefinition,
  type PokemonInstance,
  type SpawnZone,
  StatName,
} from "@pokemon-tactic/core";
import {
  TILE_SPAWN_ZONE_ACTIVE_COLOR,
  TILE_SPAWN_ZONE_ALPHA,
  TILE_SPAWN_ZONE_INACTIVE_COLOR,
  TILE_SPAWN_ZONE_OCCUPIED_COLOR,
} from "../constants";
import { HighlightKind } from "../enums/highlight-kind";
import type { IsometricGrid } from "../grid/IsometricGrid";
import { PokemonSprite } from "../sprites/PokemonSprite";
import type { ActionMenu } from "../ui/ActionMenu";
import type { BattleUI } from "../ui/BattleUI";
import type { DirectionPicker } from "../ui/DirectionPicker";
import type { InfoPanel } from "../ui/InfoPanel";
import type { PlacementRosterPanel } from "../ui/PlacementRosterPanel";
import type { TurnTimeline } from "../ui/TurnTimeline";
import { AnimationQueue } from "./AnimationQueue";
import type { BattleSetupResult } from "./BattleSetup";

type InputState =
  | { phase: "placement"; selectedPokemonId: string | null }
  | { phase: "placement_direction" }
  | { phase: "action_menu" }
  | { phase: "select_move_destination" }
  | { phase: "attack_submenu" }
  | { phase: "select_attack_target"; moveId: string }
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
  private inputState: InputState = { phase: "placement", selectedPokemonId: null };
  private legalActions: Action[] = [];
  private placementConfig: PlacementConfig | null = null;
  private placementSprites: Map<string, PokemonSprite> = new Map();

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
    setup?: BattleSetupResult,
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
    this.setup = setup ?? null;
  }

  setSetup(setup: BattleSetupResult): void {
    this.setup = setup;
  }

  get engine(): BattleEngine {
    if (!this.setup) throw new Error("BattleEngine not initialized — placement phase still active");
    return this.setup.engine;
  }

  get state(): BattleState {
    if (!this.setup) throw new Error("BattleState not initialized — placement phase still active");
    return this.setup.state;
  }

  get pokemonDefinitions(): Map<string, PokemonDefinition> {
    if (!this.setup) throw new Error("Setup not initialized — placement phase still active");
    return this.setup.pokemonDefinitions;
  }

  get moveDefinitions(): Map<string, MoveDefinition> {
    if (!this.setup) throw new Error("Setup not initialized — placement phase still active");
    return this.setup.moveDefinitions;
  }

  get isAnimating(): boolean {
    return this.inputState.phase === "animating";
  }

  getActivePokemon(): PokemonInstance | null {
    if (!this.setup) return null;
    const pokemonId = this.getActivePokemonId();
    if (!pokemonId) {
      return null;
    }
    return this.setup.state.pokemon.get(pokemonId) ?? null;
  }

  getPokemonAtPosition(gridX: number, gridY: number): PokemonInstance | null {
    if (!this.setup) return null;
    for (const pokemon of this.setup.state.pokemon.values()) {
      if (pokemon.currentHp > 0 && pokemon.position.x === gridX && pokemon.position.y === gridY) {
        return pokemon;
      }
    }
    return null;
  }

  getActivePokemonId(): string | null {
    if (!this.setup) return null;
    const turnOrder = this.setup.state.turnOrder;
    const index = this.setup.state.currentTurnIndex;
    return turnOrder[index] ?? null;
  }

  getActivePlayerId(): string | null {
    if (!this.setup) return null;
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
      const useMoveAction = this.findUseMoveAction(moveId, gridX, gridY);
      if (useMoveAction) {
        this.executeAction(activePlayerId, useMoveAction);
        return;
      }
      this.enterAttackSubmenu();
    }
  }

  refreshUI(): void {
    const activePokemonId = this.getActivePokemonId();
    const activePlayerId = this.getActivePlayerId();

    if (!activePokemonId || !activePlayerId) {
      return;
    }

    this.legalActions = this.engine.getLegalActions(activePlayerId);

    for (const [id, sprite] of this.sprites) {
      sprite.setActive(id === activePokemonId);
    }

    const activePokemon = this.state.pokemon.get(activePokemonId);
    if (activePokemon) {
      this.battleUI.updateTurnInfo(activePokemon, activePlayerId, this.state.roundNumber);
      this.infoPanel.update(activePokemon, activePlayerId);

      const screenPos = this.isometricGrid.gridToScreen(
        activePokemon.position.x,
        activePokemon.position.y,
      );
      this.scene.cameras.main.centerOn(screenPos.x, screenPos.y);
    }

    this.turnTimeline.update(this.state, this.pokemonDefinitions);

    this.enterActionMenu();
  }

  private enterActionMenu(): void {
    this.inputState = { phase: "action_menu" };
    this.isometricGrid.clearHighlights();

    const canMove = this.legalActions.some((action) => action.kind === ActionKind.Move);
    const canAct = this.legalActions.some((action) => action.kind === ActionKind.UseMove);

    this.actionMenu.show({
      canMove,
      canAct,
      callbacks: {
        onMove: () => this.enterMoveDestination(),
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
  }

  private enterAttackSubmenu(): void {
    this.inputState = { phase: "attack_submenu" };
    this.isometricGrid.clearHighlights();

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
    });
  }

  private enterAttackTarget(moveId: string): void {
    this.inputState = { phase: "select_attack_target", moveId };
    this.actionMenu.hide();
    this.isometricGrid.clearHighlights();

    const targetPositions = this.legalActions
      .filter(
        (action): action is Action & { kind: typeof ActionKind.UseMove } =>
          action.kind === ActionKind.UseMove && action.moveId === moveId,
      )
      .map((action) => action.targetPosition);

    if (targetPositions.length > 0) {
      this.isometricGrid.highlightTiles(targetPositions, HighlightKind.Attack);
    }
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

    const screenPos = this.isometricGrid.gridToScreen(
      activePokemon.position.x,
      activePokemon.position.y,
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
    this.isometricGrid.clearHighlights();
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

  private async processEvents(events: BattleEvent[]): Promise<void> {
    for (const event of events) {
      await this.processEvent(event);
    }
  }

  private async processEvent(event: BattleEvent): Promise<void> {
    switch (event.type) {
      case BattleEventType.MoveStarted: {
        const sprite = this.sprites.get(event.attackerId);
        if (sprite) {
          await sprite.playAnimationOnce("Attack");
        }
        break;
      }

      case BattleEventType.PokemonMoved: {
        const sprite = this.sprites.get(event.pokemonId);
        if (sprite) {
          sprite.playAnimation("Walk");
          for (const step of event.path) {
            await sprite.animateMoveTo(step.x, step.y);
          }
          sprite.playAnimation("Idle");
        }
        break;
      }

      case BattleEventType.DamageDealt: {
        const sprite = this.sprites.get(event.targetId);
        const pokemon = this.state.pokemon.get(event.targetId);
        if (sprite && pokemon) {
          await sprite.flashDamage();
          sprite.updateHp(pokemon.currentHp, pokemon.maxHp);
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

      case BattleEventType.LinkDrained: {
        const targetSprite = this.sprites.get(event.targetId);
        const targetPokemon = this.state.pokemon.get(event.targetId);
        if (targetSprite && targetPokemon) {
          targetSprite.updateHp(targetPokemon.currentHp, targetPokemon.maxHp);
        }
        const sourceSprite = this.sprites.get(event.sourceId);
        const sourcePokemon = this.state.pokemon.get(event.sourceId);
        if (sourceSprite && sourcePokemon) {
          sourceSprite.updateHp(sourcePokemon.currentHp, sourcePokemon.maxHp);
        }
        this.updateInfoPanelForActivePokemon();
        break;
      }

      case BattleEventType.PokemonDashed: {
        const sprite = this.sprites.get(event.pokemonId);
        if (sprite) {
          sprite.playAnimation("Walk");
          for (const step of event.path) {
            await sprite.animateMoveTo(step.x, step.y);
          }
          sprite.playAnimation("Idle");
        }
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



  startPlacement(config: PlacementConfig): void {
    this.placementConfig = config;
    this.inputState = { phase: "placement", selectedPokemonId: null };
    this.enterPlacement();
  }

  private enterPlacement(): void {
    if (!this.placementConfig) return;

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
    if (!format) return;

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
    if (this.inputState.phase !== "placement") return;
    if (!this.placementConfig) return;

    const { selectedPokemonId } = this.inputState;
    if (!selectedPokemonId) return;

    const { placementPhase } = this.placementConfig;
    const next = placementPhase.getNextToPlace();
    if (!next) return;

    const { teams, map, formatIndex } = this.placementConfig;
    const format = map.formats[formatIndex];
    if (!format) return;

    const teamIndex = teams.findIndex((t) => t.playerId === next.playerId);
    const zone = format.spawnZones[teamIndex];
    if (!zone) return;

    const isInZone = zone.positions.some((p) => p.x === gridX && p.y === gridY);
    if (!isInZone) return;

    const isOccupied = placementPhase
      .getPlacedPositions()
      .some((p) => p.x === gridX && p.y === gridY);
    if (isOccupied) return;

    this.enterPlacementDirection(selectedPokemonId, { x: gridX, y: gridY });
  }

  private enterPlacementDirection(pokemonId: string, position: { x: number; y: number }): void {
    if (!this.placementConfig) return;

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

    const screenPos = this.isometricGrid.gridToScreen(position.x, position.y);
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
    if (!this.placementConfig) return;

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
      if (!zone) continue;

      for (const position of zone.positions) {
        const key = `${position.x},${position.y}`;
        let color: number;

        if (occupiedKeys.has(key)) {
          color = TILE_SPAWN_ZONE_OCCUPIED_COLOR;
        } else if (i === activeTeamIndex) {
          color = TILE_SPAWN_ZONE_ACTIVE_COLOR;
        } else {
          color = TILE_SPAWN_ZONE_INACTIVE_COLOR;
        }

        this.isometricGrid.highlightTilesWithColor([position], color, TILE_SPAWN_ZONE_ALPHA);
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
      currentHp: 1,
      maxHp: 1,
      baseStats: { hp: 1, attack: 1, defense: 1, spAttack: 1, spDefense: 1, speed: 1 },
      derivedStats: { movement: 3, jump: 1, initiative: 1 },
      statStages: zeroStats,
      statusEffects: [],
      position,
      orientation: Direction.South,
      moveIds: [],
      currentPp: {},
    };
  }

  private updateRosterSelection(
    playerId: PlayerId,
    roster: Array<{ pokemonId: string; definitionId: string; placed: boolean }>,
    selectedPokemonId: string,
  ): void {
    if (!this.placementRosterPanel) return;
    this.placementRosterPanel.show(playerId, roster, selectedPokemonId, (pokemonId: string) => {
      if (this.inputState.phase === "placement") {
        this.inputState = { phase: "placement", selectedPokemonId: pokemonId };
        this.updateRosterSelection(playerId, roster, pokemonId);
      }
    });
  }

  handleEscapeKey(): void {
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
    if (!this.placementConfig) return;

    for (const [, sprite] of this.placementSprites) {
      sprite.destroy();
    }
    this.placementSprites.clear();

    this.isometricGrid.clearHighlights();
    this.placementRosterPanel?.hide();

    const placements = this.placementConfig.placementPhase.getPlacements();
    this.placementConfig.onPlacementComplete(placements);
  }
}
