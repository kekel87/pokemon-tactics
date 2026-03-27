import { ActionError } from "../enums/action-error";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { Direction } from "../enums/direction";
import type { PokemonType } from "../enums/pokemon-type";
import { TargetingKind } from "../enums/targeting-kind";
import { Grid } from "../grid/Grid";
import { resolveTargeting } from "../grid/targeting";
import type { Action, ActionResult } from "../types/action";
import type { BattleEvent } from "../types/battle-event";
import type { BattleState } from "../types/battle-state";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import type { TraversalContext } from "../types/traversal-context";
import type { TypeChart } from "../types/type-chart";
import { directionFromTo, stepInDirection } from "../utils/direction";
import { manhattanDistance } from "../utils/manhattan-distance";
import { checkAccuracy } from "./accuracy-check";
import { processEffects } from "./effect-processor";
import { linkDrainHandler } from "./handlers/link-drain-handler";
import { statusTickHandler } from "./handlers/status-tick-handler";
import { getEffectiveInitiative } from "./initiative-calculator";
import { TurnManager } from "./TurnManager";
import { TurnPipeline } from "./turn-pipeline";

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
  private readonly moveRegistry: Map<string, MoveDefinition>;
  private readonly typeChart: TypeChart;
  private readonly turnManager: TurnManager;
  private readonly listeners: Map<string, Set<EventHandler>>;
  private readonly grid: Grid;
  private readonly pokemonTypesMap: Map<string, PokemonType[]>;
  private readonly turnPipeline: TurnPipeline;
  private turnState = { hasMoved: false, hasActed: false };
  private restrictActions = false;
  private battleOver = false;

  constructor(
    state: BattleState,
    moveRegistry: Map<string, MoveDefinition>,
    typeChart: TypeChart = {} as TypeChart,
    pokemonTypesMap: Map<string, PokemonType[]> = new Map(),
    turnPipeline: TurnPipeline = new TurnPipeline(),
  ) {
    this.state = state;
    this.moveRegistry = moveRegistry;
    this.typeChart = typeChart;
    this.pokemonTypesMap = pokemonTypesMap;
    this.turnPipeline = turnPipeline;
    this.listeners = new Map();
    this.grid = new Grid(state.grid[0]?.length ?? 0, state.grid.length, state.grid);
    this.turnManager = new TurnManager([...state.pokemon.values()], getEffectiveInitiative);
    this.turnPipeline.registerStartTurn(statusTickHandler, 100);
    this.turnPipeline.registerEndTurn(linkDrainHandler, 100);
    this.syncTurnState();
  }

  getGameState(_playerId: string): BattleState {
    return this.state;
  }

  getLegalActions(playerId: string): Action[] {
    if (this.battleOver) {
      return [];
    }

    const currentPokemonId = this.turnManager.getCurrentPokemonId();
    const currentPokemon = this.state.pokemon.get(currentPokemonId);

    if (!currentPokemon || currentPokemon.playerId !== playerId) {
      return [];
    }

    const actions: Action[] = [];

    for (const direction of [Direction.North, Direction.South, Direction.East, Direction.West]) {
      actions.push({ kind: ActionKind.EndTurn, pokemonId: currentPokemonId, direction });
    }

    if (!this.turnState.hasMoved && !this.restrictActions) {
      const reachableTiles = this.getReachableTiles(currentPokemon);
      for (const reachable of reachableTiles) {
        actions.push({
          kind: ActionKind.Move,
          pokemonId: currentPokemonId,
          path: reachable.path,
        });
      }
    }

    if (!this.turnState.hasActed) {
      for (const moveId of currentPokemon.moveIds) {
        const currentPp = currentPokemon.currentPp[moveId];
        if (currentPp === undefined || currentPp <= 0) {
          continue;
        }
        const move = this.moveRegistry.get(moveId);
        if (!move) {
          continue;
        }

        if (this.restrictActions && move.targeting.kind === TargetingKind.Dash) {
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
    }

    return actions;
  }

  submitAction(playerId: string, action: Action): ActionResult {
    if (this.battleOver) {
      return { success: false, events: [], error: ActionError.BattleOver };
    }

    const currentPokemonId = this.turnManager.getCurrentPokemonId();
    const currentPokemon = this.state.pokemon.get(currentPokemonId);

    if (!currentPokemon || currentPokemon.playerId !== playerId) {
      return { success: false, events: [], error: ActionError.NotYourTurn };
    }

    if (action.pokemonId !== currentPokemonId) {
      return { success: false, events: [], error: ActionError.WrongPokemon };
    }

    switch (action.kind) {
      case ActionKind.EndTurn:
        return this.executeEndTurn(action.pokemonId, action.direction);
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
      case TargetingKind.Self:
        return [pokemon.position];
      case TargetingKind.Zone:
        return [pokemon.position];
      case TargetingKind.Single:
      case TargetingKind.Cross:
        return this.grid.getTilesInRange(
          pokemon.position,
          targeting.range.min,
          targeting.range.max,
        );
      case TargetingKind.Cone:
      case TargetingKind.Line:
      case TargetingKind.Slash:
        return this.getFourDirectionPositions(pokemon.position);
      case TargetingKind.Dash:
        return this.getDashPositions(pokemon.position, targeting.maxDistance);
      case TargetingKind.Blast:
        return this.grid.getTilesInRange(
          pokemon.position,
          targeting.range.min,
          targeting.range.max,
        );
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

  private getDashPositions(origin: Position, maxDistance: number): Position[] {
    const positions: Position[] = [];
    for (const direction of [Direction.North, Direction.South, Direction.East, Direction.West]) {
      for (let step = 1; step <= maxDistance; step++) {
        const position = stepInDirection(origin, direction, step);
        if (!this.grid.isInBounds(position)) {
          break;
        }
        positions.push(position);
      }
    }
    return positions;
  }

  private executeUseMove(
    pokemon: PokemonInstance,
    moveId: string,
    targetPosition: Position,
  ): ActionResult {
    if (this.turnState.hasActed) {
      return { success: false, events: [], error: ActionError.AlreadyActed };
    }

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

    const affectedTiles = resolveTargeting(
      move.targeting,
      pokemon,
      targetPosition,
      this.grid,
      traversalContext,
    );

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
      } else {
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

    for (const event of effectEvents) {
      if (event.type === BattleEventType.PokemonKo) {
        this.handleKo(event.pokemonId, events);
        if (this.battleOver) {
          return { success: true, events };
        }
      }
    }

    if (move.targeting.kind === TargetingKind.Dash) {
      this.dashMoveCaster(pokemon, targetPosition, events);
    }

    this.turnState.hasActed = true;

    return { success: true, events };
  }

  private dashMoveCaster(
    pokemon: PokemonInstance,
    targetPosition: Position,
    events: BattleEvent[],
  ): void {
    const direction = directionFromTo(pokemon.position, targetPosition);
    let destination: Position | null = null;
    const distance = manhattanDistance(pokemon.position, targetPosition);

    for (let step = 1; step <= distance; step++) {
      const position = stepInDirection(pokemon.position, direction, step);
      const occupant = this.grid.getOccupant(position);
      if (occupant !== null && occupant !== pokemon.id) {
        const occupantPokemon = this.state.pokemon.get(occupant);
        if (occupantPokemon && occupantPokemon.currentHp > 0) {
          break;
        }
      }
      destination = position;
    }

    if (destination === null) {
      return;
    }

    const origin = pokemon.position;
    this.grid.setOccupant(origin, null);
    this.grid.setOccupant(destination, pokemon.id);
    pokemon.position = destination;
    pokemon.orientation = direction;

    const moveEvent: BattleEvent = {
      type: BattleEventType.PokemonMoved,
      pokemonId: pokemon.id,
      path: [destination],
    };
    this.emit(moveEvent);
    events.push(moveEvent);
  }

  private getReachableTiles(pokemon: PokemonInstance): ReachableTile[] {
    const result: ReachableTile[] = [];
    const visited = new Set<string>();
    const posKey = (p: Position): string => `${p.x},${p.y}`;

    const queue: BfsNode[] = [{ position: pokemon.position, path: [], distance: 0 }];
    visited.add(posKey(pokemon.position));

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        break;
      }

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
          if (
            occupantPokemon &&
            occupantPokemon.currentHp > 0 &&
            occupantPokemon.playerId !== pokemon.playerId
          ) {
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
    if (this.turnState.hasMoved) {
      return { success: false, events: [], error: ActionError.AlreadyMoved };
    }

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

    this.turnState.hasMoved = true;

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
        if (occupantPokemon && occupantPokemon.currentHp > 0) {
          if (occupantPokemon.playerId !== pokemon.playerId) {
            return ActionError.BlockedByEnemy;
          }
          if (isLastStep) {
            return ActionError.DestinationOccupied;
          }
        } else if (isLastStep) {
          return ActionError.DestinationOccupied;
        }
      }

      currentPosition = step;
    }

    return null;
  }

  private executeEndTurn(pokemonId: string, direction: Direction): ActionResult {
    const pokemon = this.state.pokemon.get(pokemonId);
    if (pokemon) {
      pokemon.orientation = direction;
    }
    const events: BattleEvent[] = [];
    this.endCurrentTurn(pokemonId, events);
    return { success: true, events };
  }

  private endCurrentTurn(pokemonId: string, events: BattleEvent[]): void {
    const turnEnded: BattleEvent = { type: BattleEventType.TurnEnded, pokemonId };
    this.emit(turnEnded);
    events.push(turnEnded);

    const endTurnResult = this.turnPipeline.executeEndTurn(pokemonId, this.state);
    for (const event of endTurnResult.events) {
      this.emit(event);
      events.push(event);
    }

    if (endTurnResult.pokemonFainted) {
      for (const event of endTurnResult.events) {
        if (event.type === BattleEventType.PokemonKo) {
          this.handleKo(event.pokemonId, events);
          if (this.battleOver) {
            return;
          }
        }
      }
    }

    if (!this.battleOver) {
      this.advanceTurn(events);
    }
  }

  private advanceTurn(events: BattleEvent[]): void {
    this.turnManager.advance();

    if (this.turnManager.isRoundComplete()) {
      const alivePokemon = this.getAlivePokemon();
      this.turnManager.recalculateOrder(alivePokemon, getEffectiveInitiative);
      this.turnManager.startNewRound();
      this.state.roundNumber++;
    }

    this.syncTurnState();

    const totalPokemon = this.turnManager.getTurnOrder().length;
    let iterations = 0;

    while (iterations < totalPokemon) {
      const nextPokemonId = this.turnManager.getCurrentPokemonId();

      this.turnState = { hasMoved: false, hasActed: false };
      this.restrictActions = false;

      const turnStarted: BattleEvent = {
        type: BattleEventType.TurnStarted,
        pokemonId: nextPokemonId,
        roundNumber: this.state.roundNumber,
      };
      this.emit(turnStarted);
      events.push(turnStarted);
      const startTurnResult = this.turnPipeline.executeStartTurn(nextPokemonId, this.state);
      for (const event of startTurnResult.events) {
        this.emit(event);
        events.push(event);
      }

      if (startTurnResult.pokemonFainted) {
        this.handleKo(nextPokemonId, events);
        if (this.battleOver) {
          return;
        }
        this.turnManager.advance();
        if (this.turnManager.isRoundComplete()) {
          const alivePokemon = this.getAlivePokemon();
          this.turnManager.recalculateOrder(alivePokemon, getEffectiveInitiative);
          this.turnManager.startNewRound();
          this.state.roundNumber++;
        }
        this.syncTurnState();
        iterations++;
        continue;
      }

      if (startTurnResult.skipAction) {
        const skipEnded: BattleEvent = {
          type: BattleEventType.TurnEnded,
          pokemonId: nextPokemonId,
        };
        this.emit(skipEnded);
        events.push(skipEnded);

        const endTurnResult = this.turnPipeline.executeEndTurn(nextPokemonId, this.state);
        for (const event of endTurnResult.events) {
          this.emit(event);
          events.push(event);
        }
        if (endTurnResult.pokemonFainted) {
          for (const event of endTurnResult.events) {
            if (event.type === BattleEventType.PokemonKo) {
              this.handleKo(event.pokemonId, events);
              if (this.battleOver) {
                return;
              }
            }
          }
        }

        this.turnManager.advance();
        if (this.turnManager.isRoundComplete()) {
          const alivePokemon = this.getAlivePokemon();
          this.turnManager.recalculateOrder(alivePokemon, getEffectiveInitiative);
          this.turnManager.startNewRound();
          this.state.roundNumber++;
        }
        this.syncTurnState();
        iterations++;
        continue;
      }

      if (startTurnResult.restrictActions) {
        this.restrictActions = true;
      }

      break;
    }
  }

  private handleKo(pokemonId: string, events: BattleEvent[]): void {
    const pokemon = this.state.pokemon.get(pokemonId);
    if (!pokemon) {
      return;
    }

    this.turnManager.removePokemon(pokemonId);

    const linksToRemove: number[] = [];
    for (let i = 0; i < this.state.activeLinks.length; i++) {
      const link = this.state.activeLinks[i];
      if (!link) {
        continue;
      }
      if (link.sourceId === pokemonId || link.targetId === pokemonId) {
        linksToRemove.push(i);
        const brokenEvent: BattleEvent = {
          type: BattleEventType.LinkBroken,
          sourceId: link.sourceId,
          targetId: link.targetId,
        };
        this.emit(brokenEvent);
        events.push(brokenEvent);
      }
    }
    for (let i = linksToRemove.length - 1; i >= 0; i--) {
      const index = linksToRemove[i];
      if (index !== undefined) {
        this.state.activeLinks.splice(index, 1);
      }
    }

    const eliminatedEvent: BattleEvent = {
      type: BattleEventType.PokemonEliminated,
      pokemonId,
    };
    this.emit(eliminatedEvent);
    events.push(eliminatedEvent);

    this.checkVictory(events);
  }

  private checkVictory(events: BattleEvent[]): void {
    const playersAlive = new Set<string>();
    for (const pokemon of this.state.pokemon.values()) {
      if (pokemon.currentHp > 0) {
        playersAlive.add(pokemon.playerId);
      }
    }

    if (playersAlive.size === 1) {
      const winnerId = [...playersAlive][0] as string;
      this.battleOver = true;
      const endEvent: BattleEvent = {
        type: BattleEventType.BattleEnded,
        winnerId,
      };
      this.emit(endEvent);
      events.push(endEvent);
    }
  }

  private getAlivePokemon(): PokemonInstance[] {
    const alive: PokemonInstance[] = [];
    for (const pokemon of this.state.pokemon.values()) {
      if (pokemon.currentHp > 0) {
        alive.push(pokemon);
      }
    }
    return alive;
  }

  private syncTurnState(): void {
    this.state.turnOrder = this.turnManager.getTurnOrder();
    this.state.currentTurnIndex = this.turnManager.getCurrentIndex();
  }
}
