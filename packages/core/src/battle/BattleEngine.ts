import { ActionError } from "../enums/action-error";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { Direction } from "../enums/direction";
import { EffectKind } from "../enums/effect-kind";
import { EffectTarget } from "../enums/effect-target";
import { PokemonType } from "../enums/pokemon-type";
import { StatName } from "../enums/stat-name";
import { StatusType } from "../enums/status-type";
import { TargetingKind } from "../enums/targeting-kind";
import { isTerrainPassable, TerrainType } from "../enums/terrain-type";
import { TurnSystemKind } from "../enums/turn-system-kind";
import { Grid } from "../grid/Grid";
import { resolveTargeting } from "../grid/targeting";
import type { Action, ActionResult } from "../types/action";
import type { BattleEvent } from "../types/battle-event";
import type { BattleReplay } from "../types/battle-replay";
import type { BattleState } from "../types/battle-state";
import type { CtTimelineEntry } from "../types/ct-timeline-entry";
import type { DamageEstimate } from "../types/damage-estimate";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import { DEFAULT_STATUS_RULES, type StatusRules } from "../types/status-rules";
import type { TileState } from "../types/tile-state";
import type { TraversalContext } from "../types/traversal-context";
import type { TypeChart } from "../types/type-chart";
import { directionFromTo, stepInDirection } from "../utils/direction";
import { manhattanDistance } from "../utils/manhattan-distance";
import type { RandomFn } from "../utils/prng";
import type { AbilityHandlerRegistry } from "./ability-handler-registry";
import { checkAccuracy } from "./accuracy-check";
import { applyImpactDamage } from "./apply-impact-damage";
import { ChargeTimeTurnSystem } from "./ChargeTimeTurnSystem";
import {
  CT_START,
  CT_THRESHOLD,
  CT_WAIT,
  computeCtActionCost,
  computeCtGain,
  computeMoveCost,
} from "./ct-costs";
import { estimateDamage } from "./damage-calculator";
import { getAttackOrigin } from "./defense-check";
import { processEffects } from "./effect-processor";
import { isEffectivelyFlying } from "./effective-flying";
import { getFacingModifier, getFacingZone } from "./facing-modifier";
import { calculateFallDamage } from "./fall-damage";
import { defensiveClearHandler } from "./handlers/defensive-clear-handler";
import { createInfatuationTickHandler } from "./handlers/infatuation-tick-handler";
import { seededTickHandler } from "./handlers/seeded-tick-handler";
import { createStatusTickHandler } from "./handlers/status-tick-handler";
import { createTerrainTickHandler } from "./handlers/terrain-tick-handler";
import { trappedTickHandler } from "./handlers/trapped-tick-handler";
import { getHeightModifier } from "./height-modifier";
import { canEnterTerrain, canStopOn, canTraverse } from "./height-traversal";
import { getEffectiveInitiative } from "./initiative-calculator";
import { checkPositionLinkedStatuses } from "./position-linked-statuses";
import { isMajorStatus } from "./stat-modifier";
import { TurnManager } from "./TurnManager";
import {
  getImmuneTerrains,
  getMovementPenalty,
  getTerrainTypeBonusFactor,
  isTerrainImmune,
} from "./terrain-effects";
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
  private readonly chargeTimeTurnSystem: ChargeTimeTurnSystem | null;
  private readonly turnSystemKind: TurnSystemKind;
  private readonly listeners: Map<string, Set<EventHandler>>;
  private readonly grid: Grid;
  private readonly pokemonTypesMap: Map<string, PokemonType[]>;
  private readonly turnPipeline: TurnPipeline;
  private readonly random: RandomFn;
  private readonly seed: number;
  private readonly statusRules: StatusRules;
  private readonly abilityRegistry: AbilityHandlerRegistry | null;
  private readonly recordedActions: Action[] = [];
  private turnState = { hasMoved: false, hasActed: false, lastMoveId: null as string | null };
  private preMoveSnapshot: { position: Position; orientation: Direction; hadBurn: boolean } | null =
    null;
  private restrictActions = false;
  private confusedThisTurn = false;
  private confusionChecked = false;
  private battleOver = false;
  private startupEvents: BattleEvent[] = [];

  constructor(
    state: BattleState,
    moveRegistry: Map<string, MoveDefinition>,
    typeChart: TypeChart = {} as TypeChart,
    pokemonTypesMap: Map<string, PokemonType[]> = new Map(),
    turnPipeline: TurnPipeline = new TurnPipeline(),
    random?: RandomFn,
    seed = 0,
    turnSystemKind: TurnSystemKind = TurnSystemKind.RoundRobin,
    statusRules: StatusRules = DEFAULT_STATUS_RULES,
    abilityRegistry: AbilityHandlerRegistry | null = null,
  ) {
    this.state = state;
    this.moveRegistry = moveRegistry;
    this.typeChart = typeChart;
    this.pokemonTypesMap = pokemonTypesMap;
    this.turnPipeline = turnPipeline;
    this.random = random ?? (() => Math.random());
    this.seed = seed;
    this.turnSystemKind = turnSystemKind;
    this.statusRules = statusRules;
    this.abilityRegistry = abilityRegistry;
    this.listeners = new Map();
    this.grid = new Grid(state.grid[0]?.length ?? 0, state.grid.length, state.grid);
    this.turnManager = new TurnManager([...state.pokemon.values()], getEffectiveInitiative);
    this.turnPipeline.registerStartTurn(defensiveClearHandler, 50);
    this.turnPipeline.registerStartTurn(
      createStatusTickHandler(this.random, this.statusRules),
      100,
    );
    this.turnPipeline.registerStartTurn(createInfatuationTickHandler(this.random), 150);
    this.turnPipeline.registerEndTurn(seededTickHandler, 200);
    this.turnPipeline.registerEndTurn(trappedTickHandler, 300);
    this.turnPipeline.registerEndTurn(createTerrainTickHandler(this.pokemonTypesMap), 400);

    if (turnSystemKind === TurnSystemKind.ChargeTime) {
      const pokemonIds = [...state.pokemon.keys()];
      this.chargeTimeTurnSystem = new ChargeTimeTurnSystem(pokemonIds, (id) =>
        this.getCtGainForPokemon(id),
      );
      this.state.turnSystemKind = TurnSystemKind.ChargeTime;
      this.syncCtSnapshot();
      this.advanceTurnCt([]);
    } else {
      this.chargeTimeTurnSystem = null;
      this.state.turnSystemKind = TurnSystemKind.RoundRobin;
      this.syncTurnState();
    }

    this.triggerBattleStart();
  }

  getGrid(): Grid {
    return this.grid;
  }

  consumeStartupEvents(): BattleEvent[] {
    const events = this.startupEvents;
    this.startupEvents = [];
    return events;
  }

  rerunBattleStartChecks(): void {
    if (!this.abilityRegistry) {
      return;
    }
    for (const pokemon of this.state.pokemon.values()) {
      if (pokemon.currentHp <= 0) {
        continue;
      }
      const ability = this.abilityRegistry.getForPokemon(pokemon);
      if (!ability?.onBattleStart) {
        continue;
      }
      const events = ability.onBattleStart({
        self: pokemon,
        state: this.state,
        pokemonTypesMap: this.pokemonTypesMap,
      });
      this.startupEvents.push(...events);
    }
  }

  getGameState(_playerId: string): BattleState {
    return this.state;
  }

  exportReplay(): BattleReplay {
    return { seed: this.seed, actions: [...this.recordedActions] };
  }

  estimateDamage(
    attackerId: string,
    moveId: string,
    defenderId: string,
    targetPosition?: Position,
  ): DamageEstimate | null {
    const attacker = this.state.pokemon.get(attackerId);
    const defender = this.state.pokemon.get(defenderId);
    const move = this.moveRegistry.get(moveId);
    if (!attacker || !defender || !move) {
      return null;
    }
    const attackerTypes = this.pokemonTypesMap.get(attacker.definitionId) ?? [];
    const defenderTypes = this.pokemonTypesMap.get(defender.definitionId) ?? [];
    const attackerHeight = this.grid.getTile(attacker.position)?.height ?? 0;
    const defenderHeight = this.grid.getTile(defender.position)?.height ?? 0;
    const heightMod = getHeightModifier(
      attackerHeight,
      defenderHeight,
      move.ignoresHeight ?? false,
    );
    const attackerTerrain = this.grid.getTile(attacker.position)?.terrain;
    const terrainMod = attackerTerrain
      ? getTerrainTypeBonusFactor(
          attackerTerrain,
          move.type,
          attackerTypes,
          this.isEffectivelyFlying(attacker),
        )
      : 1.0;
    const attackOrigin = getAttackOrigin(attacker, move, targetPosition ?? defender.position);
    const facingMod = getFacingModifier(getFacingZone(attackOrigin, defender));
    return estimateDamage(
      attacker,
      defender,
      move,
      this.typeChart,
      attackerTypes,
      defenderTypes,
      heightMod,
      terrainMod,
      facingMod,
    );
  }

  getReachableTilesForPokemon(pokemonId: string): Position[] {
    if (this.battleOver) {
      return [];
    }
    const pokemon = this.state.pokemon.get(pokemonId);
    if (!pokemon || pokemon.currentHp <= 0) {
      return [];
    }
    return this.getReachableTiles(pokemon).map((tile) => tile.position);
  }

  getTileAt(position: Position): TileState | null {
    return this.grid.getTile(position) ?? null;
  }

  getPokemonTypes(pokemonId: string): PokemonType[] {
    const pokemon = this.state.pokemon.get(pokemonId);
    if (!pokemon) {
      return [];
    }
    return this.pokemonTypesMap.get(pokemon.definitionId) ?? [];
  }

  computePathDistance(from: Position, to: Position, pokemonId: string): number {
    const pokemon = this.state.pokemon.get(pokemonId);
    const pokemonTypes = pokemon ? (this.pokemonTypesMap.get(pokemon.definitionId) ?? []) : [];
    const isFlying = pokemon
      ? this.isEffectivelyFlying(pokemon)
      : pokemonTypes.includes(PokemonType.Flying);
    const isGhost = pokemonTypes.includes(PokemonType.Ghost);
    const immuneTerrains = getImmuneTerrains(pokemonTypes, isFlying);

    const posKey = (p: Position): string => `${p.x},${p.y}`;
    const visited = new Set<string>();
    const queue: Array<{ position: Position; distance: number }> = [
      { position: from, distance: 0 },
    ];
    visited.add(posKey(from));

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        break;
      }
      if (current.position.x === to.x && current.position.y === to.y) {
        return current.distance;
      }
      const neighbors = this.grid.getNeighbors(current.position);
      for (const neighbor of neighbors) {
        const key = posKey(neighbor.position);
        if (visited.has(key)) {
          continue;
        }
        const currentTile = this.grid.getTile(current.position);
        const currentHeight = currentTile?.height ?? 0;
        const currentTerrain = currentTile?.terrain ?? TerrainType.Normal;
        if (
          !canTraverse({
            fromHeight: currentHeight,
            toHeight: neighbor.height,
            fromTerrain: currentTerrain,
            toTerrain: neighbor.terrain,
            isFlying,
            isGhost,
            immuneTerrains,
          })
        ) {
          continue;
        }
        visited.add(key);
        queue.push({ position: neighbor.position, distance: current.distance + 1 });
      }
    }

    return Number.POSITIVE_INFINITY;
  }

  private getCurrentActorId(): string {
    if (this.turnSystemKind === TurnSystemKind.ChargeTime) {
      const id = this.state.turnOrder[0];
      if (!id) {
        throw new Error("No current actor in CT mode");
      }
      return id;
    }
    return this.turnManager.getCurrentPokemonId();
  }

  getLegalActions(playerId: string): Action[] {
    if (this.battleOver) {
      return [];
    }

    const currentPokemonId = this.getCurrentActorId();
    const currentPokemon = this.state.pokemon.get(currentPokemonId);

    if (!currentPokemon || currentPokemon.playerId !== playerId) {
      return [];
    }

    const actions: Action[] = [];

    for (const direction of [Direction.North, Direction.South, Direction.East, Direction.West]) {
      actions.push({ kind: ActionKind.EndTurn, pokemonId: currentPokemonId, direction });
    }

    const isTrapped = currentPokemon.volatileStatuses.some((v) => v.type === StatusType.Trapped);

    if (!this.turnState.hasMoved && !this.restrictActions && !isTrapped) {
      const reachableTiles = this.getReachableTiles(currentPokemon);
      for (const reachable of reachableTiles) {
        actions.push({
          kind: ActionKind.Move,
          pokemonId: currentPokemonId,
          path: reachable.path,
        });
      }
    }

    if (this.turnState.hasMoved && this.preMoveSnapshot !== null) {
      actions.push({ kind: ActionKind.UndoMove, pokemonId: currentPokemonId });
    }

    if (!this.turnState.hasActed && !currentPokemon.recharging) {
      const allyIds = new Set<string>();
      for (const [id, p] of this.state.pokemon) {
        if (p.playerId === currentPokemon.playerId && id !== currentPokemonId) {
          allyIds.add(id);
        }
      }
      const traversalContext: TraversalContext = { allyIds, canTraverseEnemies: false };

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
        const moveContext = { type: move.type, flags: move.flags };
        for (const targetPosition of targetPositions) {
          const affectedTiles = resolveTargeting(
            move.targeting,
            currentPokemon,
            targetPosition,
            this.grid,
            traversalContext,
            moveContext,
          );
          if (affectedTiles.length === 0) {
            continue;
          }
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

    const currentPokemonId = this.getCurrentActorId();
    const currentPokemon = this.state.pokemon.get(currentPokemonId);

    if (!currentPokemon || currentPokemon.playerId !== playerId) {
      return { success: false, events: [], error: ActionError.NotYourTurn };
    }

    if (action.pokemonId !== currentPokemonId) {
      return { success: false, events: [], error: ActionError.WrongPokemon };
    }

    const confusionEvents: BattleEvent[] = [];
    if (!this.confusionChecked) {
      this.confusionChecked = true;
      this.processConfusion(currentPokemon, confusionEvents);
    }

    let result: ActionResult;

    switch (action.kind) {
      case ActionKind.EndTurn:
        result = this.executeEndTurn(action.pokemonId, action.direction);
        break;
      case ActionKind.Move: {
        if (this.confusedThisTurn) {
          const moveResult = this.executeConfusedMove(currentPokemon);
          result = { ...moveResult, events: [...confusionEvents, ...moveResult.events] };
        } else {
          const moveResult = this.executeMove(currentPokemon, action.path);
          result = { ...moveResult, events: [...confusionEvents, ...moveResult.events] };
        }
        break;
      }
      case ActionKind.UseMove: {
        if (this.confusedThisTurn) {
          const useMoveResult = this.executeConfusedUseMove(
            currentPokemon,
            action.moveId,
            action.targetPosition,
          );
          result = { ...useMoveResult, events: [...confusionEvents, ...useMoveResult.events] };
        } else {
          const useMoveResult = this.executeUseMove(
            currentPokemon,
            action.moveId,
            action.targetPosition,
          );
          result = { ...useMoveResult, events: [...confusionEvents, ...useMoveResult.events] };
        }
        break;
      }
      case ActionKind.UndoMove:
        result = this.executeUndoMove(currentPokemon);
        break;
    }

    if (result.success) {
      this.recordedActions.push(action);
    }

    return result;
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

  private isEffectivelyFlying(pokemon: PokemonInstance): boolean {
    const types = this.pokemonTypesMap.get(pokemon.definitionId) ?? [];
    return isEffectivelyFlying(pokemon, types);
  }

  private triggerBattleStart(): void {
    if (!this.abilityRegistry) {
      return;
    }
    for (const pokemon of this.state.pokemon.values()) {
      const ability = this.abilityRegistry.getForPokemon(pokemon);
      if (!ability) {
        continue;
      }
      if (ability.onBattleStart) {
        const events = ability.onBattleStart({
          self: pokemon,
          state: this.state,
          pokemonTypesMap: this.pokemonTypesMap,
        });
        this.startupEvents.push(...events);
      }
      if (ability.onAuraCheck) {
        const auraEvents = ability.onAuraCheck({
          self: pokemon,
          state: this.state,
          pokemonTypesMap: this.pokemonTypesMap,
        });
        this.startupEvents.push(...auraEvents);
      }
    }
  }

  private emitPositionLinkedChecks(events: BattleEvent[]): void {
    const linkedEvents = checkPositionLinkedStatuses(this.state);
    for (const event of linkedEvents) {
      this.emit(event);
      events.push(event);
    }
    if (this.abilityRegistry) {
      for (const pokemon of this.state.pokemon.values()) {
        if (pokemon.currentHp <= 0) {
          continue;
        }
        const ability = this.abilityRegistry.getForPokemon(pokemon);
        if (!ability?.onAuraCheck) {
          continue;
        }
        const auraEvents = ability.onAuraCheck({
          self: pokemon,
          state: this.state,
          pokemonTypesMap: this.pokemonTypesMap,
        });
        for (const event of auraEvents) {
          this.emit(event);
          events.push(event);
        }
      }
    }
  }

  private getValidTargetPositions(pokemon: PokemonInstance, move: MoveDefinition): Position[] {
    const targeting = move.targeting;
    switch (targeting.kind) {
      case TargetingKind.Self:
        return [pokemon.position];
      case TargetingKind.Zone:
      case TargetingKind.Cross:
        return [pokemon.position];
      case TargetingKind.Single:
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
      { type: move.type, flags: move.flags },
    );

    if (affectedTiles.length === 0) {
      return { success: false, events: [], error: ActionError.InvalidTarget };
    }

    pokemon.currentPp[moveId] = currentPp - 1;

    const events: BattleEvent[] = [];

    const isSelfTarget =
      pokemon.position.x === targetPosition.x && pokemon.position.y === targetPosition.y;
    if (!isSelfTarget) {
      pokemon.orientation = directionFromTo(pokemon.position, targetPosition);
    }

    const moveStarted: BattleEvent = {
      type: BattleEventType.MoveStarted,
      attackerId: pokemon.id,
      moveId,
      direction: pokemon.orientation,
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

      const defenderTile = this.grid.getTile(target.position);
      const defenderTypes = this.pokemonTypesMap.get(target.definitionId) ?? [];
      const tallGrassBonus =
        defenderTile?.terrain === TerrainType.TallGrass &&
        !isTerrainImmune(TerrainType.TallGrass, defenderTypes, this.isEffectivelyFlying(target))
          ? 1
          : 0;
      if (checkAccuracy(move, pokemon, target, this.random, tallGrassBonus)) {
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

    const attackerHeight = this.grid.getTile(pokemon.position)?.height ?? 0;
    const heightMod = getHeightModifier(
      attackerHeight,
      this.grid.getTile(targetPosition)?.height ?? 0,
      move.ignoresHeight ?? false,
    );

    const attackerTile = this.grid.getTile(pokemon.position);
    const terrainMod = attackerTile
      ? getTerrainTypeBonusFactor(
          attackerTile.terrain,
          move.type,
          attackerTypes,
          this.isEffectivelyFlying(pokemon),
        )
      : 1.0;

    const attackOrigin = getAttackOrigin(pokemon, move, targetPosition);
    const facingModifierMap = new Map<string, number>();
    for (const target of targets) {
      facingModifierMap.set(target.id, getFacingModifier(getFacingZone(attackOrigin, target)));
    }

    const effectEvents = processEffects({
      attacker: pokemon,
      targets,
      move,
      state: this.state,
      typeChart: this.typeChart,
      attackerTypes,
      targetTypesMap,
      targetPosition,
      random: this.random,
      heightModifier: heightMod,
      terrainModifier: terrainMod,
      facingModifierMap,
      statusRules: this.statusRules,
      abilityRegistry: this.abilityRegistry ?? undefined,
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

    this.emitPositionLinkedChecks(events);

    if (move.targeting.kind === TargetingKind.Dash) {
      this.dashMoveCaster(pokemon, targetPosition, events);
    }

    this.turnState.hasActed = true;
    this.turnState.lastMoveId = moveId;
    this.preMoveSnapshot = null;

    if (move.recharge && pokemon.currentHp > 0) {
      pokemon.recharging = true;
      const rechargeEvent: BattleEvent = {
        type: BattleEventType.RechargeStarted,
        pokemonId: pokemon.id,
      };
      this.emit(rechargeEvent);
      events.push(rechargeEvent);
    }

    return { success: true, events };
  }

  private executeConfusedMove(pokemon: PokemonInstance): ActionResult {
    if (this.turnState.hasMoved) {
      return { success: false, events: [], error: ActionError.AlreadyMoved };
    }

    const events: BattleEvent[] = [];
    const directions = [Direction.North, Direction.South, Direction.East, Direction.West];
    const randomDirection =
      directions[Math.floor(this.random() * directions.length)] ?? Direction.North;
    const steps = Math.floor(this.random() * 2) + 1;

    const path: Position[] = [];
    let currentPos = pokemon.position;
    for (let i = 0; i < steps; i++) {
      const next = stepInDirection(currentPos, randomDirection, 1);
      if (!this.grid.isInBounds(next)) {
        break;
      }
      const tile = this.grid.getTile(next);
      if (!tile || !isTerrainPassable(tile.terrain)) {
        break;
      }
      const occupant = tile.occupantId;
      if (occupant !== null && occupant !== pokemon.id) {
        const occupantPokemon = this.state.pokemon.get(occupant);
        if (occupantPokemon && occupantPokemon.currentHp > 0) {
          break;
        }
      }
      path.push(next);
      currentPos = next;
    }

    if (path.length === 0) {
      this.turnState.hasMoved = true;
      return { success: true, events };
    }

    const origin = { ...pokemon.position };
    this.grid.setOccupant(origin, null);
    const destination = path[path.length - 1] as Position;
    this.grid.setOccupant(destination, pokemon.id);
    pokemon.position = destination;
    pokemon.orientation = randomDirection;

    const moveEvent: BattleEvent = {
      type: BattleEventType.PokemonMoved,
      pokemonId: pokemon.id,
      path,
    };
    this.emit(moveEvent);
    events.push(moveEvent);

    this.turnState.hasMoved = true;

    this.emitPositionLinkedChecks(events);

    return { success: true, events };
  }

  private executeConfusedUseMove(
    pokemon: PokemonInstance,
    moveId: string,
    targetPosition: Position,
  ): ActionResult {
    const move = this.moveRegistry.get(moveId);
    if (!move) {
      return this.executeUseMove(pokemon, moveId, targetPosition);
    }

    const targeting = move.targeting;
    const isSelfTargeting =
      targeting.kind === TargetingKind.Self ||
      targeting.kind === TargetingKind.Zone ||
      targeting.kind === TargetingKind.Cross;
    const isSelfOnly = targeting.kind === TargetingKind.Self;
    const isSelfBuff =
      isSelfOnly &&
      move.effects.every(
        (e) => e.kind === EffectKind.StatChange && "target" in e && e.target === EffectTarget.Self,
      );

    if (isSelfBuff || isSelfOnly) {
      return this.executeUseMove(pokemon, moveId, targetPosition);
    }

    const isDirectional =
      targeting.kind === TargetingKind.Cone ||
      targeting.kind === TargetingKind.Line ||
      targeting.kind === TargetingKind.Slash;

    if (isDirectional || isSelfTargeting) {
      const directions = [Direction.North, Direction.South, Direction.East, Direction.West];
      const randomDirection =
        directions[Math.floor(this.random() * directions.length)] ?? Direction.North;
      const redirectedTarget = stepInDirection(pokemon.position, randomDirection, 1);

      const events: BattleEvent[] = [];
      const redirectEvent: BattleEvent = {
        type: BattleEventType.ConfusionRedirected,
        pokemonId: pokemon.id,
        originalDirection: directionFromTo(pokemon.position, targetPosition),
        newDirection: randomDirection,
      };
      this.emit(redirectEvent);
      events.push(redirectEvent);

      const result = this.executeUseMove(pokemon, moveId, redirectedTarget);
      return {
        success: result.success,
        events: [...events, ...result.events],
        error: result.error,
      };
    }

    const allies: PokemonInstance[] = [];
    for (const [, p] of this.state.pokemon) {
      if (p.playerId === pokemon.playerId && p.id !== pokemon.id && p.currentHp > 0) {
        if (targeting.kind === TargetingKind.Single) {
          const distance = manhattanDistance(pokemon.position, p.position);
          if (distance >= targeting.range.min && distance <= targeting.range.max) {
            allies.push(p);
          }
        } else if (targeting.kind === TargetingKind.Dash) {
          const distance = manhattanDistance(pokemon.position, p.position);
          if (distance <= targeting.maxDistance) {
            const dx = p.position.x - pokemon.position.x;
            const dy = p.position.y - pokemon.position.y;
            if (dx === 0 || dy === 0) {
              allies.push(p);
            }
          }
        } else if (targeting.kind === TargetingKind.Blast) {
          const distance = manhattanDistance(pokemon.position, p.position);
          if (distance >= targeting.range.min && distance <= targeting.range.max) {
            allies.push(p);
          }
        }
      }
    }

    if (allies.length === 0) {
      const events: BattleEvent[] = [];
      const failEvent: BattleEvent = {
        type: BattleEventType.ConfusionFailed,
        pokemonId: pokemon.id,
        reason: "no_ally_in_range",
      };
      this.emit(failEvent);
      events.push(failEvent);
      this.turnState.hasActed = true;
      this.preMoveSnapshot = null;
      return { success: true, events };
    }

    const randomAlly = allies[Math.floor(this.random() * allies.length)];
    if (!randomAlly) {
      this.turnState.hasActed = true;
      this.preMoveSnapshot = null;
      return { success: true, events: [] };
    }
    const events: BattleEvent[] = [];
    const redirectEvent: BattleEvent = {
      type: BattleEventType.ConfusionRedirected,
      pokemonId: pokemon.id,
      originalTarget: `${targetPosition.x},${targetPosition.y}`,
      newTarget: randomAlly.id,
    };
    this.emit(redirectEvent);
    events.push(redirectEvent);

    const result = this.executeUseMove(pokemon, moveId, randomAlly.position);
    return {
      success: result.success,
      events: [...events, ...result.events],
      error: result.error,
    };
  }

  private dashMoveCaster(
    pokemon: PokemonInstance,
    targetPosition: Position,
    events: BattleEvent[],
  ): void {
    const direction = directionFromTo(pokemon.position, targetPosition);
    let destination: Position | null = null;
    let wallHeightDiff = 0;
    const distance = manhattanDistance(pokemon.position, targetPosition);
    const isFlying = this.isEffectivelyFlying(pokemon);
    let previousHeight = this.grid.getTile(pokemon.position)?.height ?? 0;

    for (let step = 1; step <= distance; step++) {
      const position = stepInDirection(pokemon.position, direction, step);
      if (!this.grid.isInBounds(position)) {
        break;
      }
      const tileHeight = this.grid.getTile(position)?.height ?? 0;
      if (!isFlying && tileHeight - previousHeight > 0.5) {
        wallHeightDiff = tileHeight - previousHeight;
        break;
      }
      const occupant = this.grid.getOccupant(position);
      if (occupant !== null && occupant !== pokemon.id) {
        const occupantPokemon = this.state.pokemon.get(occupant);
        if (occupantPokemon && occupantPokemon.currentHp > 0) {
          break;
        }
        continue;
      }
      destination = position;
      previousHeight = tileHeight;
    }

    if (destination === null) {
      if (wallHeightDiff > 0 && !isFlying) {
        for (const event of applyImpactDamage(pokemon, wallHeightDiff)) {
          this.emit(event);
          events.push(event);
        }
      }
      return;
    }

    const origin = pokemon.position;
    const originHeight = this.grid.getTile(origin)?.height ?? 0;
    const destHeight = this.grid.getTile(destination)?.height ?? 0;
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

    if (wallHeightDiff > 0 && !isFlying) {
      for (const event of applyImpactDamage(pokemon, wallHeightDiff)) {
        this.emit(event);
        events.push(event);
      }
    }

    const dashHeightDiff = originHeight - destHeight;
    if (dashHeightDiff > 0) {
      if (!isFlying) {
        const fallDamage = calculateFallDamage(dashHeightDiff, pokemon.maxHp);
        if (fallDamage > 0) {
          pokemon.currentHp = Math.max(0, pokemon.currentHp - fallDamage);
          const fallEvent: BattleEvent = {
            type: BattleEventType.FallDamageDealt,
            pokemonId: pokemon.id,
            amount: fallDamage,
            heightDiff: dashHeightDiff,
          };
          this.emit(fallEvent);
          events.push(fallEvent);
          if (pokemon.currentHp <= 0) {
            const koEvent: BattleEvent = {
              type: BattleEventType.PokemonKo,
              pokemonId: pokemon.id,
              countdownStart: 0,
            };
            this.emit(koEvent);
            events.push(koEvent);
          }
        }
      }
    }
  }

  private getReachableTiles(pokemon: PokemonInstance): ReachableTile[] {
    const result: ReachableTile[] = [];
    const visited = new Map<string, number>();
    const posKey = (p: Position): string => `${p.x},${p.y}`;
    const pokemonTypes = this.pokemonTypesMap.get(pokemon.definitionId) ?? [];
    const isFlying = this.isEffectivelyFlying(pokemon);
    const isGhost = pokemonTypes.includes(PokemonType.Ghost);
    const immuneTerrains = getImmuneTerrains(pokemonTypes, isFlying);

    const queue: BfsNode[] = [{ position: pokemon.position, path: [], distance: 0 }];
    visited.set(posKey(pokemon.position), 0);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        break;
      }

      if (current.distance > 0) {
        const occupant = this.grid.getOccupant(current.position);
        const currentTile = this.grid.getTile(current.position);
        if (
          occupant === null &&
          currentTile &&
          canStopOn(currentTile.terrain, isFlying, immuneTerrains)
        ) {
          result.push({ position: current.position, path: current.path });
        }
      }

      const neighbors = this.grid.getNeighbors(current.position);
      for (const neighbor of neighbors) {
        const key = posKey(neighbor.position);

        const currentTileForNeighbor = this.grid.getTile(current.position);
        const currentHeight = currentTileForNeighbor?.height ?? 0;
        const currentTerrain = currentTileForNeighbor?.terrain ?? TerrainType.Normal;
        if (
          !canTraverse({
            fromHeight: currentHeight,
            toHeight: neighbor.height,
            fromTerrain: currentTerrain,
            toTerrain: neighbor.terrain,
            isFlying,
            isGhost,
            immuneTerrains,
          })
        ) {
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

        const penalty = getMovementPenalty(neighbor.terrain, pokemonTypes, isFlying);
        const newDistance = current.distance + 1 + penalty;

        if (newDistance > pokemon.derivedStats.movement) {
          continue;
        }

        const existingDistance = visited.get(key);
        if (existingDistance !== undefined && existingDistance <= newDistance) {
          continue;
        }

        visited.set(key, newDistance);
        queue.push({
          position: neighbor.position,
          path: [...current.path, neighbor.position],
          distance: newDistance,
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

    const hadBurn = pokemon.statusEffects.some((s) => s.type === StatusType.Burned);
    this.preMoveSnapshot = {
      position: { ...origin },
      orientation: pokemon.orientation,
      hadBurn,
    };

    const events: BattleEvent[] = [];
    const pokemonTypes = this.pokemonTypesMap.get(pokemon.definitionId) ?? [];

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

    const hasMajor = pokemon.statusEffects.some((s) => isMajorStatus(s.type));
    if (!hasMajor) {
      for (const step of path) {
        const tile = this.grid.getTile(step);
        if (tile?.terrain !== TerrainType.Magma) {
          continue;
        }
        if (isTerrainImmune(TerrainType.Magma, pokemonTypes, this.isEffectivelyFlying(pokemon))) {
          break;
        }
        pokemon.statusEffects.push({ type: StatusType.Burned, remainingTurns: null });
        const statusEvent: BattleEvent = {
          type: BattleEventType.TerrainStatusApplied,
          pokemonId: pokemon.id,
          terrain: TerrainType.Magma,
          status: StatusType.Burned,
        };
        this.emit(statusEvent);
        events.push(statusEvent);
        break;
      }
    }

    this.turnState.hasMoved = true;

    this.emitPositionLinkedChecks(events);

    return { success: true, events };
  }

  private executeUndoMove(pokemon: PokemonInstance): ActionResult {
    if (!this.preMoveSnapshot) {
      return { success: false, events: [], error: ActionError.InvalidAction };
    }

    const events: BattleEvent[] = [];
    const currentPosition = { ...pokemon.position };

    this.grid.setOccupant(currentPosition, null);
    this.grid.setOccupant(this.preMoveSnapshot.position, pokemon.id);
    pokemon.position = { ...this.preMoveSnapshot.position };
    pokemon.orientation = this.preMoveSnapshot.orientation;

    if (!this.preMoveSnapshot.hadBurn) {
      pokemon.statusEffects = pokemon.statusEffects.filter((s) => s.type !== StatusType.Burned);
    }

    this.turnState.hasMoved = false;

    const cancelEvent: BattleEvent = {
      type: BattleEventType.MoveCancelled,
      pokemonId: pokemon.id,
      position: this.preMoveSnapshot.position,
    };
    this.emit(cancelEvent);
    events.push(cancelEvent);

    this.preMoveSnapshot = null;

    this.emitPositionLinkedChecks(events);

    return { success: true, events };
  }

  private validateMovePath(pokemon: PokemonInstance, path: Position[]): ActionError | null {
    if (path.length === 0) {
      return ActionError.EmptyPath;
    }

    const pokemonTypes = this.pokemonTypesMap.get(pokemon.definitionId) ?? [];
    const isFlying = this.isEffectivelyFlying(pokemon);
    const isGhost = pokemonTypes.includes(PokemonType.Ghost);
    const immuneTerrains = getImmuneTerrains(pokemonTypes, isFlying);

    let totalCost = 0;
    let currentPosition = pokemon.position;
    for (const step of path) {
      if (manhattanDistance(currentPosition, step) !== 1) {
        return ActionError.NonAdjacentStep;
      }

      if (!this.grid.isInBounds(step)) {
        return ActionError.OutOfBounds;
      }

      const tile = this.grid.getTile(step);
      if (!tile) {
        return ActionError.ImpassableTile;
      }

      if (!canEnterTerrain(tile.terrain, isFlying, isGhost, immuneTerrains)) {
        return ActionError.ImpassableTile;
      }

      const currentTile = this.grid.getTile(currentPosition);
      const fromHeight = currentTile?.height ?? 0;
      const fromTerrain = currentTile?.terrain ?? TerrainType.Normal;
      if (
        !canTraverse({
          fromHeight,
          toHeight: tile.height,
          fromTerrain,
          toTerrain: tile.terrain,
          isFlying,
          isGhost,
          immuneTerrains,
        })
      ) {
        return ActionError.JumpTooHigh;
      }

      const isLastStep = step === path[path.length - 1];
      if (isLastStep && !canStopOn(tile.terrain, isFlying, immuneTerrains)) {
        return ActionError.ImpassableTile;
      }

      totalCost += 1 + getMovementPenalty(tile.terrain, pokemonTypes, isFlying);
      if (totalCost > pokemon.derivedStats.movement) {
        return ActionError.PathTooLong;
      }

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

    if (pokemon?.recharging && !this.turnState.hasActed) {
      pokemon.recharging = false;
      const rechargeEndEvent: BattleEvent = {
        type: BattleEventType.RechargeEnded,
        pokemonId,
      };
      this.emit(rechargeEndEvent);
      events.push(rechargeEndEvent);
    }

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
      if (this.turnSystemKind === TurnSystemKind.ChargeTime) {
        this.endCurrentTurnCt(pokemonId);
        this.advanceTurnCt(events);
      } else {
        this.advanceTurn(events);
      }
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

      this.turnState = { hasMoved: false, hasActed: false, lastMoveId: null };
      this.preMoveSnapshot = null;
      this.restrictActions = false;
      this.confusedThisTurn = false;
      this.confusionChecked = false;

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

      if (!startTurnResult.skipAction) {
        const nextPokemon = this.state.pokemon.get(nextPokemonId);
        if (nextPokemon) {
          this.processConfusion(nextPokemon, events);
          this.confusionChecked = true;
        }
      }

      break;
    }
  }

  private processConfusion(pokemon: PokemonInstance, events: BattleEvent[]): void {
    const confusionIndex = pokemon.volatileStatuses.findIndex(
      (v) => v.type === StatusType.Confused,
    );
    if (confusionIndex === -1) {
      return;
    }

    const confusion = pokemon.volatileStatuses[confusionIndex];
    if (!confusion) {
      return;
    }
    confusion.remainingTurns--;

    if (confusion.remainingTurns <= 0) {
      pokemon.volatileStatuses.splice(confusionIndex, 1);
      const removedEvent: BattleEvent = {
        type: BattleEventType.StatusRemoved,
        targetId: pokemon.id,
        status: StatusType.Confused,
      };
      this.emit(removedEvent);
      events.push(removedEvent);
      return;
    }

    const roll = this.random();
    if (roll < 0.5) {
      this.confusedThisTurn = true;
      const triggeredEvent: BattleEvent = {
        type: BattleEventType.ConfusionTriggered,
        pokemonId: pokemon.id,
      };
      this.emit(triggeredEvent);
      events.push(triggeredEvent);
    } else {
      const resistedEvent: BattleEvent = {
        type: BattleEventType.ConfusionResisted,
        pokemonId: pokemon.id,
      };
      this.emit(resistedEvent);
      events.push(resistedEvent);
    }
  }

  private handleKo(pokemonId: string, events: BattleEvent[]): void {
    const pokemon = this.state.pokemon.get(pokemonId);
    if (!pokemon) {
      return;
    }

    this.turnManager.removePokemon(pokemonId);
    this.chargeTimeTurnSystem?.onPokemonKO(pokemonId);

    pokemon.activeDefense = null;

    for (const other of this.state.pokemon.values()) {
      const seededBefore = other.volatileStatuses.length;
      other.volatileStatuses = other.volatileStatuses.filter(
        (v) => !(v.type === StatusType.Seeded && v.sourceId === pokemonId),
      );
      if (other.volatileStatuses.length < seededBefore) {
        const removedEvent: BattleEvent = {
          type: BattleEventType.StatusRemoved,
          targetId: other.id,
          status: StatusType.Seeded,
        };
        this.emit(removedEvent);
        events.push(removedEvent);
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

  private getCtGainForPokemon(pokemonId: string): number {
    const pokemon = this.state.pokemon.get(pokemonId);
    if (!pokemon) {
      return 0;
    }
    const baseStat = pokemon.baseStats.speed;
    const stages = pokemon.statStages[StatName.Speed] ?? 0;
    return computeCtGain(baseStat, stages);
  }

  private computeCurrentMoveCost(): number {
    if (!this.turnState.hasActed || !this.turnState.lastMoveId) {
      return 0;
    }
    const move = this.moveRegistry.get(this.turnState.lastMoveId);
    if (!move) {
      return 600;
    }
    return computeMoveCost(move.pp, move.power, move.effectTier);
  }

  private syncCtSnapshot(): void {
    if (this.chargeTimeTurnSystem) {
      this.state.ctSnapshot = this.chargeTimeTurnSystem.getCtSnapshot();
    }
  }

  predictCtTimeline(count: number, moveId?: string): CtTimelineEntry[] {
    if (!this.chargeTimeTurnSystem || count <= 0) {
      return [];
    }

    const activePokemonId = this.state.turnOrder[0];
    if (!activePokemonId) {
      return [];
    }

    let actionCost: number;
    if (moveId === undefined) {
      actionCost = computeCtActionCost(this.turnState.hasMoved, false, 0);
    } else {
      const move = this.moveRegistry.get(moveId);
      const moveCost = move ? computeMoveCost(move.pp, move.power, move.effectTier) : CT_START;
      actionCost = computeCtActionCost(this.turnState.hasMoved, true, moveCost);
    }

    const ctMap = new Map<string, number>(
      Object.entries(this.chargeTimeTurnSystem.getCtSnapshot()),
    );
    const activeCt = ctMap.get(activePokemonId) ?? 0;
    ctMap.set(activePokemonId, activeCt - actionCost);

    const livePokemonIds = new Set(
      [...this.state.pokemon.values()].filter((p) => p.currentHp > 0).map((p) => p.id),
    );
    for (const id of [...ctMap.keys()]) {
      if (!livePokemonIds.has(id)) {
        ctMap.delete(id);
      }
    }

    const result: CtTimelineEntry[] = [];
    const MAX_TICKS = 10_000;
    let ticks = 0;

    while (result.length < count && ticks < MAX_TICKS) {
      let bestId: string | null = null;
      let bestCt = CT_THRESHOLD - 1;
      for (const [id, ct] of ctMap) {
        if (ct > bestCt || (ct === bestCt && bestId !== null && id < bestId)) {
          bestId = id;
          bestCt = ct;
        }
      }

      if (bestId === null) {
        for (const [id, ct] of ctMap) {
          ctMap.set(id, ct + this.getCtGainForPokemon(id));
        }
        ticks++;
      } else {
        result.push({ pokemonId: bestId, ct: ctMap.get(bestId) ?? 0 });
        const current = ctMap.get(bestId) ?? 0;
        ctMap.set(bestId, current - CT_WAIT);
      }
    }

    return result;
  }

  private advanceTurnCt(events: BattleEvent[]): void {
    const ctSystem = this.chargeTimeTurnSystem;
    if (!ctSystem) {
      return;
    }

    const MAX_SKIP_ITERATIONS = 50;
    let iterations = 0;

    while (iterations < MAX_SKIP_ITERATIONS) {
      const nextPokemonId = ctSystem.getNextActorId();

      this.turnState = { hasMoved: false, hasActed: false, lastMoveId: null };
      this.preMoveSnapshot = null;
      this.restrictActions = false;
      this.confusedThisTurn = false;
      this.confusionChecked = false;

      this.state.turnOrder = [nextPokemonId];
      this.state.currentTurnIndex = 0;
      this.syncCtSnapshot();

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
        ctSystem.onActionComplete(nextPokemonId, CT_START);
        this.syncCtSnapshot();
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

        ctSystem.onActionComplete(nextPokemonId, CT_START);
        this.syncCtSnapshot();
        iterations++;
        continue;
      }

      if (startTurnResult.restrictActions) {
        this.restrictActions = true;
      }

      const nextPokemon = this.state.pokemon.get(nextPokemonId);
      if (nextPokemon) {
        this.processConfusion(nextPokemon, events);
        this.confusionChecked = true;
      }

      break;
    }
  }

  private endCurrentTurnCt(pokemonId: string): void {
    const ctSystem = this.chargeTimeTurnSystem;
    if (!ctSystem) {
      return;
    }

    const moveCost = this.computeCurrentMoveCost();
    const actionCost = computeCtActionCost(
      this.turnState.hasMoved,
      this.turnState.hasActed,
      moveCost,
    );

    ctSystem.onActionComplete(pokemonId, actionCost);
    this.syncCtSnapshot();
  }

  private syncTurnState(): void {
    this.state.turnOrder = this.turnManager.getTurnOrder();
    this.state.currentTurnIndex = this.turnManager.getCurrentIndex();
    this.state.predictedNextRoundOrder = this.computePredictedNextRoundOrder();
  }

  private computePredictedNextRoundOrder(): string[] {
    const alivePokemon = this.getAlivePokemon();
    const sorted = [...alivePokemon].sort((a, b) => {
      const initiativeDiff = getEffectiveInitiative(b) - getEffectiveInitiative(a);
      if (initiativeDiff !== 0) {
        return initiativeDiff;
      }
      return a.id.localeCompare(b.id);
    });
    return sorted.map((pokemon) => pokemon.id);
  }
}
