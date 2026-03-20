import { ActionError } from "../enums/action-error";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import type { PokemonType } from "../enums/pokemon-type";
import { Grid } from "../grid/Grid";
import { resolveTargeting } from "../grid/targeting";
import type { Action, ActionResult } from "../types/action";
import type { BattleEvent } from "../types/battle-event";
import type { BattleState } from "../types/battle-state";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import type { TraversalContext } from "../types/traversal-context";
import { directionFromTo } from "../utils/direction";
import { manhattanDistance } from "../utils/manhattan-distance";
import { checkAccuracy } from "./accuracy-check";
import { processEffects } from "./effect-processor";
import { TurnManager } from "./TurnManager";

type EventHandler = (event: BattleEvent) => void;
type TypeChart = Record<PokemonType, Record<PokemonType, number>>;

interface ReachableTile {
  position: Position;
  path: Position[];
}

interface BfsNode {
  position: Position;
  path: Position[];
  distance: number;
}

export class BattleEngine {
  private readonly state: BattleState;
  private readonly moveRegistry: Map<string, MoveDefinition>;
  private readonly typeChart: TypeChart;
  private readonly turnManager: TurnManager;
  private readonly listeners: Map<string, Set<EventHandler>>;
  private readonly grid: Grid;
  private readonly pokemonTypesMap: Map<string, PokemonType[]>;

  constructor(
    state: BattleState,
    moveRegistry: Map<string, MoveDefinition>,
    typeChart: TypeChart = {} as TypeChart,
    pokemonTypesMap: Map<string, PokemonType[]> = new Map(),
  ) {
    this.state = state;
    this.moveRegistry = moveRegistry;
    this.typeChart = typeChart;
    this.pokemonTypesMap = pokemonTypesMap;
    this.listeners = new Map();
    this.grid = new Grid(state.grid[0]?.length ?? 0, state.grid.length, state.grid);
    this.turnManager = new TurnManager([...state.pokemon.values()]);
    this.syncTurnState();
  }

  getGameState(_playerId: string): BattleState {
    return this.state;
  }

  getLegalActions(playerId: string): Action[] {
    const currentPokemonId = this.turnManager.getCurrentPokemonId();
    const currentPokemon = this.state.pokemon.get(currentPokemonId);

    if (!currentPokemon || currentPokemon.playerId !== playerId) {
      return [];
    }

    const actions: Action[] = [];

    actions.push({ kind: ActionKind.SkipTurn, pokemonId: currentPokemonId });

    const reachableTiles = this.getReachableTiles(currentPokemon);
    for (const reachable of reachableTiles) {
      actions.push({
        kind: ActionKind.Move,
        pokemonId: currentPokemonId,
        path: reachable.path,
      });
    }

    for (const moveId of currentPokemon.moveIds) {
      const currentPp = currentPokemon.currentPp[moveId];
      if (currentPp === undefined || currentPp <= 0) {
        continue;
      }
      const move = this.moveRegistry.get(moveId);
      if (!move) {
        continue;
      }
      const targetPositions = this.getValidTargetPositions(currentPokemon, move);
      for (const targetPosition of targetPositions) {
        actions.push({
          kind: ActionKind.UseMove,
          pokemonId: currentPokemonId,
          moveId,
          targetPosition,
        });
      }
    }

    return actions;
  }

  submitAction(playerId: string, action: Action): ActionResult {
    const currentPokemonId = this.turnManager.getCurrentPokemonId();
    const currentPokemon = this.state.pokemon.get(currentPokemonId);

    if (!currentPokemon || currentPokemon.playerId !== playerId) {
      return { success: false, events: [], error: ActionError.NotYourTurn };
    }

    if (action.pokemonId !== currentPokemonId) {
      return { success: false, events: [], error: ActionError.WrongPokemon };
    }

    switch (action.kind) {
      case ActionKind.SkipTurn:
        return this.executeSkipTurn(action.pokemonId);
      case ActionKind.Move:
        return this.executeMove(currentPokemon, action.path);
      case ActionKind.UseMove:
        return this.executeUseMove(currentPokemon, action.moveId, action.targetPosition);
    }
  }

  on(eventType: string, handler: EventHandler): void {
    let handlers = this.listeners.get(eventType);
    if (!handlers) {
      handlers = new Set();
      this.listeners.set(eventType, handlers);
    }
    handlers.add(handler);
  }

  off(eventType: string, handler: EventHandler): void {
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: BattleEvent): void {
    const handlers = this.listeners.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        handler(event);
      }
    }
  }

  private getValidTargetPositions(pokemon: PokemonInstance, move: MoveDefinition): Position[] {
    const targeting = move.targeting;
    switch (targeting.kind) {
      case "self":
        return [pokemon.position];
      case "zone":
        return [pokemon.position];
      case "single":
      case "cross":
        return this.grid.getTilesInRange(pokemon.position, targeting.range.min, targeting.range.max);
      case "cone":
      case "line":
      case "dash":
        return this.getFourDirectionPositions(pokemon.position);
    }
  }

  private getFourDirectionPositions(origin: Position): Position[] {
    return [
      { x: origin.x, y: origin.y - 1 },
      { x: origin.x, y: origin.y + 1 },
      { x: origin.x - 1, y: origin.y },
      { x: origin.x + 1, y: origin.y },
    ].filter((p) => this.grid.isInBounds(p));
  }

  private executeUseMove(
    pokemon: PokemonInstance,
    moveId: string,
    targetPosition: Position,
  ): ActionResult {
    const move = this.moveRegistry.get(moveId);
    if (!move) {
      return { success: false, events: [], error: ActionError.UnknownMove };
    }

    if (!pokemon.moveIds.includes(moveId)) {
      return { success: false, events: [], error: ActionError.MoveNotInMoveset };
    }

    const currentPp = pokemon.currentPp[moveId];
    if (currentPp === undefined || currentPp <= 0) {
      return { success: false, events: [], error: ActionError.NoPpLeft };
    }

    const allyIds = new Set<string>();
    for (const [id, p] of this.state.pokemon) {
      if (p.playerId === pokemon.playerId && id !== pokemon.id) {
        allyIds.add(id);
      }
    }
    const traversalContext: TraversalContext = { allyIds, canTraverseEnemies: false };

    const affectedTiles = resolveTargeting(move.targeting, pokemon, targetPosition, this.grid, traversalContext);

    if (affectedTiles.length === 0) {
      return { success: false, events: [], error: ActionError.InvalidTarget };
    }

    pokemon.currentPp[moveId] = currentPp - 1;

    const events: BattleEvent[] = [];

    pokemon.orientation = directionFromTo(pokemon.position, targetPosition);

    const moveStarted: BattleEvent = {
      type: BattleEventType.MoveStarted,
      attackerId: pokemon.id,
      moveId,
    };
    this.emit(moveStarted);
    events.push(moveStarted);

    const targets: PokemonInstance[] = [];
    const hitTargetIds: string[] = [];
    const missedTargetIds: string[] = [];

    for (const tile of affectedTiles) {
      const occupantId = this.grid.getOccupant(tile);
      if (occupantId === null || occupantId === pokemon.id) {
        continue;
      }
      const target = this.state.pokemon.get(occupantId);
      if (!target || target.currentHp <= 0) {
        continue;
      }

      if (checkAccuracy(move, pokemon, target)) {
        targets.push(target);
        hitTargetIds.push(target.id);
      } else {
        missedTargetIds.push(target.id);
        const missEvent: BattleEvent = {
          type: BattleEventType.MoveMissed,
          attackerId: pokemon.id,
          targetId: target.id,
        };
        this.emit(missEvent);
        events.push(missEvent);
      }
    }

    const attackerTypes = this.pokemonTypesMap.get(pokemon.definitionId) ?? [];
    const targetTypesMap = new Map<string, PokemonType[]>();
    for (const target of targets) {
      targetTypesMap.set(target.id, this.pokemonTypesMap.get(target.definitionId) ?? []);
    }

    const effectEvents = processEffects({
      attacker: pokemon,
      targets,
      move,
      state: this.state,
      typeChart: this.typeChart,
      attackerTypes,
      targetTypesMap,
    });

    for (const event of effectEvents) {
      this.emit(event);
      events.push(event);
    }

    const turnEnded: BattleEvent = { type: BattleEventType.TurnEnded, pokemonId: pokemon.id };
    this.emit(turnEnded);
    events.push(turnEnded);

    this.advanceTurn(events);

    return { success: true, events };
  }

  private getReachableTiles(pokemon: PokemonInstance): ReachableTile[] {
    const result: ReachableTile[] = [];
    const visited = new Set<string>();
    const posKey = (p: Position) => `${p.x},${p.y}`;

    const queue: BfsNode[] = [{ position: pokemon.position, path: [], distance: 0 }];
    visited.add(posKey(pokemon.position));

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;

      if (current.distance > 0) {
        const occupant = this.grid.getOccupant(current.position);
        if (occupant === null) {
          result.push({ position: current.position, path: current.path });
        }
      }

      if (current.distance >= pokemon.derivedStats.movement) {
        continue;
      }

      const neighbors = this.grid.getNeighbors(current.position);
      for (const neighbor of neighbors) {
        const key = posKey(neighbor.position);
        if (visited.has(key)) {
          continue;
        }

        if (!neighbor.isPassable) {
          continue;
        }

        const heightDiff = Math.abs(
          neighbor.height - (this.grid.getTile(current.position)?.height ?? 0),
        );
        if (heightDiff > pokemon.derivedStats.jump) {
          continue;
        }

        const occupant = neighbor.occupantId;
        if (occupant !== null) {
          const occupantPokemon = this.state.pokemon.get(occupant);
          if (occupantPokemon && occupantPokemon.playerId !== pokemon.playerId) {
            continue;
          }
        }

        visited.add(key);
        queue.push({
          position: neighbor.position,
          path: [...current.path, neighbor.position],
          distance: current.distance + 1,
        });
      }
    }

    return result;
  }

  private executeMove(pokemon: PokemonInstance, path: Position[]): ActionResult {
    const origin = { ...pokemon.position };
    const validationError = this.validateMovePath(pokemon, path);
    if (validationError) {
      return { success: false, events: [], error: validationError };
    }

    const events: BattleEvent[] = [];

    this.grid.setOccupant(origin, null);
    const destination = path[path.length - 1] as Position;
    this.grid.setOccupant(destination, pokemon.id);
    pokemon.position = destination;

    const from = path.length > 1 ? (path[path.length - 2] as Position) : origin;
    pokemon.orientation = directionFromTo(from, destination);

    const moveEvent: BattleEvent = {
      type: BattleEventType.PokemonMoved,
      pokemonId: pokemon.id,
      path,
    };
    this.emit(moveEvent);
    events.push(moveEvent);

    const turnEnded: BattleEvent = { type: BattleEventType.TurnEnded, pokemonId: pokemon.id };
    this.emit(turnEnded);
    events.push(turnEnded);

    this.advanceTurn(events);

    return { success: true, events };
  }

  private validateMovePath(pokemon: PokemonInstance, path: Position[]): ActionError | null {
    if (path.length === 0) {
      return ActionError.EmptyPath;
    }

    if (path.length > pokemon.derivedStats.movement) {
      return ActionError.PathTooLong;
    }

    let currentPosition = pokemon.position;
    for (const step of path) {
      if (manhattanDistance(currentPosition, step) !== 1) {
        return ActionError.NonAdjacentStep;
      }

      if (!this.grid.isInBounds(step)) {
        return ActionError.OutOfBounds;
      }

      const tile = this.grid.getTile(step);
      if (!tile || !tile.isPassable) {
        return ActionError.ImpassableTile;
      }

      const currentTile = this.grid.getTile(currentPosition);
      const heightDiff = Math.abs(tile.height - (currentTile?.height ?? 0));
      if (heightDiff > pokemon.derivedStats.jump) {
        return ActionError.JumpTooHigh;
      }

      const isLastStep = step === path[path.length - 1];
      const occupant = tile.occupantId;
      if (occupant !== null && occupant !== pokemon.id) {
        const occupantPokemon = this.state.pokemon.get(occupant);
        if (occupantPokemon && occupantPokemon.playerId !== pokemon.playerId) {
          return ActionError.BlockedByEnemy;
        }
        if (isLastStep) {
          return ActionError.DestinationOccupied;
        }
      }

      currentPosition = step;
    }

    return null;
  }

  private executeSkipTurn(pokemonId: string): ActionResult {
    const events: BattleEvent[] = [];

    const turnEnded: BattleEvent = { type: BattleEventType.TurnEnded, pokemonId };
    this.emit(turnEnded);
    events.push(turnEnded);

    this.advanceTurn(events);

    return { success: true, events };
  }

  private advanceTurn(events: BattleEvent[]): void {
    this.turnManager.advance();

    if (this.turnManager.isRoundComplete()) {
      this.turnManager.startNewRound();
      this.state.roundNumber++;
    }

    this.syncTurnState();

    const nextPokemonId = this.turnManager.getCurrentPokemonId();
    const turnStarted: BattleEvent = {
      type: BattleEventType.TurnStarted,
      pokemonId: nextPokemonId,
      roundNumber: this.state.roundNumber,
    };
    this.emit(turnStarted);
    events.push(turnStarted);
  }

  private syncTurnState(): void {
    this.state.turnOrder = this.turnManager.getTurnOrder();
    this.state.currentTurnIndex = this.turnManager.getCurrentIndex();
  }
}
