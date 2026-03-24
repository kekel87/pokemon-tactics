import {
  type Action,
  ActionKind,
  type BattleEngine,
  type BattleEvent,
  BattleEventType,
  type BattleState,
  type MoveDefinition,
  type PokemonDefinition,
  type PokemonInstance,
} from "@pokemon-tactic/core";
import { HighlightKind } from "../enums/highlight-kind";
import type { IsometricGrid } from "../grid/IsometricGrid";
import type { PokemonSprite } from "../sprites/PokemonSprite";
import type { ActionMenu } from "../ui/ActionMenu";
import type { BattleUI } from "../ui/BattleUI";
import type { InfoPanel } from "../ui/InfoPanel";
import type { TurnTimeline } from "../ui/TurnTimeline";
import { AnimationQueue } from "./AnimationQueue";
import type { BattleSetupResult } from "./BattleSetup";

type InputState =
  | { phase: "action_menu" }
  | { phase: "select_move_destination" }
  | { phase: "attack_submenu" }
  | { phase: "select_attack_target"; moveId: string }
  | { phase: "animating" }
  | { phase: "battle_over"; winnerId: string };

export class GameController {
  private readonly setup: BattleSetupResult;
  private readonly scene: Phaser.Scene;
  private readonly isometricGrid: IsometricGrid;
  private readonly sprites: Map<string, PokemonSprite>;
  private readonly animationQueue: AnimationQueue;
  private readonly battleUI: BattleUI;
  private readonly actionMenu: ActionMenu;
  private readonly infoPanel: InfoPanel;
  private readonly turnTimeline: TurnTimeline;
  private inputState: InputState = { phase: "action_menu" };
  private legalActions: Action[] = [];

  constructor(
    scene: Phaser.Scene,
    isometricGrid: IsometricGrid,
    sprites: Map<string, PokemonSprite>,
    battleUI: BattleUI,
    actionMenu: ActionMenu,
    infoPanel: InfoPanel,
    turnTimeline: TurnTimeline,
    setup: BattleSetupResult,
  ) {
    this.scene = scene;
    this.isometricGrid = isometricGrid;
    this.sprites = sprites;
    this.animationQueue = new AnimationQueue();
    this.battleUI = battleUI;
    this.actionMenu = actionMenu;
    this.infoPanel = infoPanel;
    this.turnTimeline = turnTimeline;
    this.setup = setup;
  }

  get engine(): BattleEngine {
    return this.setup.engine;
  }

  get state(): BattleState {
    return this.setup.state;
  }

  get pokemonDefinitions(): Map<string, PokemonDefinition> {
    return this.setup.pokemonDefinitions;
  }

  get moveDefinitions(): Map<string, MoveDefinition> {
    return this.setup.moveDefinitions;
  }

  get isAnimating(): boolean {
    return this.inputState.phase === "animating";
  }

  getActivePokemon(): PokemonInstance | null {
    const pokemonId = this.getActivePokemonId();
    if (!pokemonId) {
      return null;
    }
    return this.state.pokemon.get(pokemonId) ?? null;
  }

  getPokemonAtPosition(gridX: number, gridY: number): PokemonInstance | null {
    for (const pokemon of this.state.pokemon.values()) {
      if (pokemon.currentHp > 0 && pokemon.position.x === gridX && pokemon.position.y === gridY) {
        return pokemon;
      }
    }
    return null;
  }

  getActivePokemonId(): string | null {
    const turnOrder = this.state.turnOrder;
    const index = this.state.currentTurnIndex;
    return turnOrder[index] ?? null;
  }

  getActivePlayerId(): string | null {
    const pokemonId = this.getActivePokemonId();
    if (!pokemonId) {
      return null;
    }
    return this.state.pokemon.get(pokemonId)?.playerId ?? null;
  }

  handleTileClick(gridX: number, gridY: number): void {
    if (this.inputState.phase === "animating" || this.inputState.phase === "battle_over") {
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
    const activePokemonId = this.getActivePokemonId();
    const activePlayerId = this.getActivePlayerId();
    if (!activePokemonId || !activePlayerId) {
      return;
    }

    this.actionMenu.hide();
    const endTurnAction: Action = { kind: ActionKind.EndTurn, pokemonId: activePokemonId };
    this.executeAction(activePlayerId, endTurnAction);
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
      case BattleEventType.PokemonEliminated: {
        const sprite = this.sprites.get(event.pokemonId);
        if (sprite) {
          await sprite.fadeOut();
          sprite.destroy();
          this.sprites.delete(event.pokemonId);
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
}
