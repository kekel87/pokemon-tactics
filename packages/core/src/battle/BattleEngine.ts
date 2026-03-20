import { ActionError } from "../enums/action-error";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { Grid } from "../grid/Grid";
import type { Action, ActionResult } from "../types/action";
import type { BattleEvent } from "../types/battle-event";
import type { BattleState } from "../types/battle-state";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import { directionFromTo } from "../utils/direction";
import { manhattanDistance } from "../utils/manhattan-distance";
import { TurnManager } from "./TurnManager";

type EventHandler = (event: BattleEvent) => void;

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
  private readonly turnManager: TurnManager;
  private readonly listeners: Map<string, Set<EventHandler>>;
  private readonly grid: Grid;

  constructor(state: BattleState, _moveRegistry: Map<string, MoveDefinition>) {
    this.state = state;
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
        return { success: false, events: [], error: ActionError.NotImplemented };
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
