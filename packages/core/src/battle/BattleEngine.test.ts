import { describe, expect, it, vi } from "vitest";
import { ActionError } from "../enums/action-error";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { Category } from "../enums/category";
import { Direction } from "../enums/direction";
import { EffectKind } from "../enums/effect-kind";
import { PlayerId } from "../enums/player-id";
import { StatusType } from "../enums/status-type";
import { TargetingKind } from "../enums/targeting-kind";
import { TerrainType } from "../enums/terrain-type";
import { MockBattle, MockPokemon } from "../testing";
import { MockValidation } from "../testing/mock-validation";
import type { BattleEvent } from "../types/battle-event";
import type { MoveDefinition } from "../types/move-definition";
import { BattleEngine } from "./BattleEngine";

const P1 = MockBattle.player1Fast;
const P2 = MockBattle.player2Slow;

const fresh = MockPokemon.fresh;

describe("BattleEngine", () => {
  it("constructs with a minimal state", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    const gameState = engine.getGameState(PlayerId.Player1);
    expect(gameState.pokemon.size).toBe(2);
    expect(gameState.roundNumber).toBe(1);
  });

  it("synchronizes turnOrder in BattleState from TurnManager", () => {
    const state = MockBattle.stateFrom([fresh(P2), fresh(P1)]);
    const engine = new BattleEngine(state, new Map());

    const gameState = engine.getGameState(PlayerId.Player1);
    expect(gameState.turnOrder).toEqual(["fast", "slow"]);
    expect(gameState.currentTurnIndex).toBe(0);
  });

  it("computes predictedNextRoundOrder sorted by effective initiative", () => {
    const state = MockBattle.stateFrom([fresh(P2), fresh(P1)]);
    const engine = new BattleEngine(state, new Map());

    const gameState = engine.getGameState(PlayerId.Player1);
    expect(gameState.predictedNextRoundOrder).toEqual(["fast", "slow"]);
  });

  it("excludes KO pokemon from predictedNextRoundOrder", () => {
    const p1 = fresh(P1);
    const p2 = fresh(P2, { currentHp: 0 });
    const state = MockBattle.stateFrom([p1, p2]);
    const engine = new BattleEngine(state, new Map());

    const gameState = engine.getGameState(PlayerId.Player1);
    expect(gameState.predictedNextRoundOrder).toEqual(["fast"]);
  });

  it("notifies event handlers via on()", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    const events: BattleEvent[] = [];
    engine.on(BattleEventType.TurnEnded, (event) => events.push(event));

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "fast",
      direction: Direction.South,
    });

    const turnEndedEvents = events.filter((e) => e.type === BattleEventType.TurnEnded);
    expect(turnEndedEvents.length).toBe(1);
  });

  it("stops notifying after off()", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    const handler = vi.fn();
    engine.on(BattleEventType.TurnEnded, handler);
    engine.off(BattleEventType.TurnEnded, handler);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "fast",
      direction: Direction.South,
    });

    expect(handler).not.toHaveBeenCalled();
  });
});

describe("BattleEngine.getLegalActions", () => {
  it("returns end_turn and move actions for the active pokemon", () => {
    const mover = fresh(P1, { id: "mover", position: { x: 2, y: 2 } });
    const state = MockBattle.stateFrom([mover, fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    const actions = engine.getLegalActions(PlayerId.Player1);
    expect(actions.filter((a) => a.kind === ActionKind.EndTurn).length).toBe(4);
    expect(actions.filter((a) => a.kind === ActionKind.Move).length).toBeGreaterThan(0);
  });

  it("returns reachable tiles within movement range on empty grid", () => {
    const mover = fresh(P1, { id: "mover", position: { x: 2, y: 2 } });
    const state = MockBattle.stateFrom([mover, fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    const moveActions = engine
      .getLegalActions(PlayerId.Player1)
      .filter((a) => a.kind === ActionKind.Move);

    expect(moveActions.length).toBeGreaterThan(0);
    expect(moveActions.every((a) => a.kind === ActionKind.Move && a.path.length > 0)).toBe(true);
  });

  it("blocks movement through enemies", () => {
    const mover = fresh(P1, { id: "mover", position: { x: 0, y: 0 } });
    const enemy = fresh(P2, { id: "enemy", position: { x: 2, y: 0 } });
    const state = MockBattle.stateFrom([mover, enemy], 5, 1);
    const engine = new BattleEngine(state, new Map());

    const destinations = engine
      .getLegalActions(PlayerId.Player1)
      .filter((a) => a.kind === ActionKind.Move)
      .map((a) => (a.kind === ActionKind.Move ? a.path[a.path.length - 1] : null));

    expect(destinations).toContainEqual({ x: 1, y: 0 });
    expect(destinations).not.toContainEqual({ x: 2, y: 0 });
    expect(destinations).not.toContainEqual({ x: 3, y: 0 });
  });

  it("allows movement through allies", () => {
    const mover = fresh(P1, { id: "mover", position: { x: 0, y: 0 } });
    const ally = fresh(P1, {
      id: "ally",
      position: { x: 1, y: 0 },
      derivedStats: { ...P1.derivedStats, initiative: 50 },
    });
    const enemy = fresh(P2, { id: "enemy", position: { x: 4, y: 0 } });
    const state = MockBattle.stateFrom([mover, ally, enemy], 5, 1);
    const engine = new BattleEngine(state, new Map());

    const destinations = engine
      .getLegalActions(PlayerId.Player1)
      .filter((a) => a.kind === ActionKind.Move)
      .map((a) => (a.kind === ActionKind.Move ? a.path[a.path.length - 1] : null));

    expect(destinations).toContainEqual({ x: 2, y: 0 });
    expect(destinations).toContainEqual({ x: 3, y: 0 });
    expect(destinations).not.toContainEqual({ x: 1, y: 0 });
  });

  it("respects jump height for elevation changes", () => {
    const mover = fresh(P1, { id: "mover", position: { x: 0, y: 0 } });
    const other = fresh(P2, { id: "other", position: { x: 4, y: 0 } });
    const state = MockBattle.stateFrom([mover, other], 5, 1);
    MockBattle.setTile(state, 1, 0, { height: 2 });
    const engine = new BattleEngine(state, new Map());

    const destinations = engine
      .getLegalActions(PlayerId.Player1)
      .filter((a) => a.kind === ActionKind.Move)
      .map((a) => (a.kind === ActionKind.Move ? a.path[a.path.length - 1] : null));

    expect(destinations).not.toContainEqual({ x: 1, y: 0 });
    expect(destinations).not.toContainEqual({ x: 2, y: 0 });
  });

  it("excludes impassable tiles from reachable tiles", () => {
    const mover = fresh(P1, { id: "mover", position: { x: 0, y: 0 } });
    const state = MockBattle.stateFrom([mover, fresh(P2)], 5, 1);
    MockBattle.setTile(state, 1, 0, { terrain: TerrainType.Obstacle });
    const engine = new BattleEngine(state, new Map());

    expect(
      engine.getLegalActions(PlayerId.Player1).filter((a) => a.kind === ActionKind.Move).length,
    ).toBe(0);
  });

  it("returns empty actions for wrong playerId", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    expect(engine.getLegalActions(PlayerId.Player2)).toEqual([]);
  });
});

describe("BattleEngine.submitAction validation", () => {
  it("rejects action from wrong player", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: "fast",
      direction: Direction.South,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.NotYourTurn);
  });

  it("rejects use_move with unknown move", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "fast",
      moveId: "nonexistent",
      targetPosition: { x: 1, y: 0 },
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.UnknownMove);
  });
});

describe("BattleEngine.submitAction move", () => {
  it("moves a pokemon and updates position and occupants", () => {
    const mover = fresh(P1, { id: "mover" });
    const state = MockBattle.stateFrom([mover, fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get("mover")?.position).toEqual({ x: 2, y: 0 });
    expect(state.grid[0]?.[0]?.occupantId).toBeNull();
    expect(state.grid[0]?.[2]?.occupantId).toBe("mover");
  });

  it("emits PokemonMoved event", () => {
    const mover = fresh(P1, { id: "mover" });
    const state = MockBattle.stateFrom([mover, fresh(P2)]);
    const engine = new BattleEngine(state, new Map());
    const events: BattleEvent[] = [];
    engine.on(BattleEventType.PokemonMoved, (e) => events.push(e));

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [{ x: 1, y: 0 }],
    });

    expect(events.length).toBe(1);
    expect(events[0]?.type).toBe(BattleEventType.PokemonMoved);
  });

  it("updates orientation to the direction of the last step", () => {
    const mover = fresh(P1, { id: "mover" });
    const state = MockBattle.stateFrom([mover, fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [{ x: 0, y: 1 }],
    });

    expect(state.pokemon.get("mover")?.orientation).toBe(Direction.South);
  });

  it("rejects move with path too long", () => {
    const mover = fresh(P1, { id: "mover" });
    const state = MockBattle.stateFrom([mover, fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 1 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects move for wrong pokemon", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "slow",
      path: [{ x: 3, y: 4 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects move with non-adjacent steps", () => {
    const mover = fresh(P1, { id: "mover" });
    const state = MockBattle.stateFrom([mover, fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [{ x: 2, y: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects move through enemy", () => {
    const mover = fresh(P1, { id: "mover", position: { x: 0, y: 0 } });
    const enemy = fresh(P2, { id: "enemy", position: { x: 1, y: 0 } });
    const state = MockBattle.stateFrom([mover, enemy], 5, 1);
    const engine = new BattleEngine(state, new Map());

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("does not advance the turn after a move", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());
    const events: BattleEvent[] = [];
    engine.on(BattleEventType.TurnStarted, (e) => events.push(e));
    engine.on(BattleEventType.TurnEnded, (e) => events.push(e));

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "fast",
      path: [{ x: 1, y: 0 }],
    });

    expect(events.length).toBe(0);
  });

  it("advances the turn after Move + EndTurn", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());
    const events: BattleEvent[] = [];
    engine.on(BattleEventType.TurnStarted, (e) => events.push(e));

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "fast",
      path: [{ x: 1, y: 0 }],
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "fast",
      direction: Direction.South,
    });

    expect(events.length).toBe(1);
    expect(events[0]?.type).toBe(BattleEventType.TurnStarted);
    expect((events[0] as { pokemonId: string }).pokemonId).toBe("slow");
  });

  it("increments roundNumber after a full round", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    expect(state.roundNumber).toBe(1);
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "fast",
      direction: Direction.South,
    });
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: "slow",
      direction: Direction.South,
    });
    expect(state.roundNumber).toBe(2);
  });

  it("rejects move to a tile occupied by an ally", () => {
    const mover = fresh(P1, { id: "mover", position: { x: 0, y: 0 } });
    const ally = fresh(P1, {
      id: "ally",
      position: { x: 2, y: 0 },
      derivedStats: { ...P1.derivedStats, initiative: 50 },
    });
    const enemy = fresh(P2, { id: "enemy" });
    const state = MockBattle.stateFrom([mover, ally, enemy]);
    const engine = new BattleEngine(state, new Map());

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.DestinationOccupied);
  });

  it("rejects move with empty path", () => {
    const mover = fresh(P1, { id: "mover" });
    const state = MockBattle.stateFrom([mover, fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [],
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.EmptyPath);
  });

  it("rejects move to out of bounds", () => {
    const mover = fresh(P1, { id: "mover" });
    const state = MockBattle.stateFrom([mover, fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [{ x: -1, y: 0 }],
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.OutOfBounds);
  });

  it("rejects move through impassable tile", () => {
    const mover = fresh(P1, { id: "mover" });
    const state = MockBattle.stateFrom([mover, fresh(P2)]);
    MockBattle.setTile(state, 1, 0, { terrain: TerrainType.Obstacle });
    const engine = new BattleEngine(state, new Map());

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [{ x: 1, y: 0 }],
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.ImpassableTile);
  });

  it("rejects move with jump too high", () => {
    const mover = fresh(P1, { id: "mover" });
    const state = MockBattle.stateFrom([mover, fresh(P2)]);
    MockBattle.setTile(state, 1, 0, { height: 3 });
    const engine = new BattleEngine(state, new Map());

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [{ x: 1, y: 0 }],
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.JumpTooHigh);
  });

  it("completes 3 full rounds with 2 pokemon", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    for (let round = 0; round < 3; round++) {
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "fast",
        direction: Direction.South,
      });
      engine.submitAction(PlayerId.Player2, {
        kind: ActionKind.EndTurn,
        pokemonId: "slow",
        direction: Direction.South,
      });
    }
    expect(state.roundNumber).toBe(4);
  });
});

describe("BattleEngine.getLegalActions — use_move", () => {
  const singleMove: MoveDefinition = {
    ...MockValidation.validMove,
    id: "tackle",
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
  };

  const selfMove: MoveDefinition = {
    ...MockValidation.validMove,
    id: "growth",
    category: Category.Status,
    power: 0,
    targeting: { kind: TargetingKind.Self },
    effects: [
      { kind: EffectKind.StatChange, stat: "attack" as never, stages: 1, target: "self" as never },
    ],
  };

  const coneMove: MoveDefinition = {
    ...MockValidation.validMove,
    id: "heat-wave",
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 2 } },
  };

  const dashMove: MoveDefinition = {
    ...MockValidation.validMove,
    id: "quick-attack",
    targeting: { kind: TargetingKind.Dash, maxDistance: 3 },
  };

  it("returns use_move actions for each valid target position", () => {
    const registry = new Map([["tackle", singleMove]]);
    const mover = fresh(P1, {
      id: "mover",
      position: { x: 2, y: 2 },
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
    });
    const state = MockBattle.stateFrom([mover, fresh(P2)]);
    const engine = new BattleEngine(state, registry);

    const useMoveActions = engine
      .getLegalActions(PlayerId.Player1)
      .filter((a) => a.kind === ActionKind.UseMove);

    expect(useMoveActions.length).toBeGreaterThan(0);
    expect(
      useMoveActions.every((a) => a.kind === ActionKind.UseMove && a.moveId === "tackle"),
    ).toBe(true);
  });

  it("excludes moves with 0 PP", () => {
    const registry = new Map([["tackle", singleMove]]);
    const mover = fresh(P1, {
      id: "mover",
      position: { x: 2, y: 2 },
      moveIds: ["tackle"],
      currentPp: { tackle: 0 },
    });
    const state = MockBattle.stateFrom([mover, fresh(P2)]);
    const engine = new BattleEngine(state, registry);

    const useMoveActions = engine
      .getLegalActions(PlayerId.Player1)
      .filter((a) => a.kind === ActionKind.UseMove);

    expect(useMoveActions.length).toBe(0);
  });

  it("returns single-target positions within range 1 to 3", () => {
    const registry = new Map([["tackle", singleMove]]);
    const mover = fresh(P1, {
      id: "mover",
      position: { x: 2, y: 2 },
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
    });
    const state = MockBattle.stateFrom([mover, fresh(P2)]);
    const engine = new BattleEngine(state, registry);

    const targets = engine
      .getLegalActions(PlayerId.Player1)
      .filter(
        (a): a is Extract<typeof a, { kind: typeof ActionKind.UseMove }> =>
          a.kind === ActionKind.UseMove,
      )
      .map((a) => a.targetPosition);

    expect(targets).toContainEqual({ x: 3, y: 2 });
    expect(targets).toContainEqual({ x: 4, y: 2 });
    expect(targets).not.toContainEqual({ x: 2, y: 2 });
  });

  it("returns one action for self-targeting move", () => {
    const registry = new Map([["growth", selfMove]]);
    const mover = fresh(P1, {
      id: "mover",
      position: { x: 2, y: 2 },
      moveIds: ["growth"],
      currentPp: { growth: 20 },
    });
    const state = MockBattle.stateFrom([mover, fresh(P2)]);
    const engine = new BattleEngine(state, registry);

    const useMoveActions = engine
      .getLegalActions(PlayerId.Player1)
      .filter((a) => a.kind === ActionKind.UseMove);

    expect(useMoveActions.length).toBe(1);
    expect(
      useMoveActions[0]?.kind === ActionKind.UseMove && useMoveActions[0].targetPosition,
    ).toEqual({ x: 2, y: 2 });
  });

  it("returns 4 directional actions for cone-targeting move", () => {
    const registry = new Map([["heat-wave", coneMove]]);
    const mover = fresh(P1, {
      id: "mover",
      position: { x: 2, y: 2 },
      moveIds: ["heat-wave"],
      currentPp: { "heat-wave": 10 },
    });
    const state = MockBattle.stateFrom([mover, fresh(P2)]);
    const engine = new BattleEngine(state, registry);

    const useMoveActions = engine
      .getLegalActions(PlayerId.Player1)
      .filter((a) => a.kind === ActionKind.UseMove);

    expect(useMoveActions.length).toBe(4);
  });

  it("returns actions for all reachable tiles in 4 directions for dash-targeting move", () => {
    const registry = new Map([["quick-attack", dashMove]]);
    const mover = fresh(P1, {
      id: "mover",
      position: { x: 2, y: 2 },
      moveIds: ["quick-attack"],
      currentPp: { "quick-attack": 30 },
    });
    const state = MockBattle.stateFrom([mover, fresh(P2)]);
    const engine = new BattleEngine(state, registry);

    const useMoveActions = engine
      .getLegalActions(PlayerId.Player1)
      .filter((a) => a.kind === ActionKind.UseMove);

    expect(useMoveActions.length).toBe(8);
  });

  it("lists use_move for multiple moves with PP", () => {
    const registry = new Map([
      ["tackle", singleMove],
      ["growth", selfMove],
    ]);
    const mover = fresh(P1, {
      id: "mover",
      position: { x: 2, y: 2 },
      moveIds: ["tackle", "growth"],
      currentPp: { tackle: 35, growth: 20 },
    });
    const state = MockBattle.stateFrom([mover, fresh(P2)]);
    const engine = new BattleEngine(state, registry);

    const useMoveActions = engine
      .getLegalActions(PlayerId.Player1)
      .filter((a) => a.kind === ActionKind.UseMove);

    const moveIds = [
      ...new Set(useMoveActions.map((a) => (a.kind === ActionKind.UseMove ? a.moveId : ""))),
    ];
    expect(moveIds).toContain("tackle");
    expect(moveIds).toContain("growth");
  });

  describe("handleKo", () => {
    it("KO removes pokemon from turn order but body stays on tile", () => {
      const p1 = fresh(P1, {
        currentHp: 1,
        statusEffects: [{ type: StatusType.Poisoned, remainingTurns: null }],
      });
      const p2 = fresh(P2);
      const state = MockBattle.stateFrom([p1, p2]);
      const engine = new BattleEngine(state, new Map());

      const events: BattleEvent[] = [];
      engine.on(BattleEventType.PokemonEliminated, (e) => events.push(e));
      engine.on(BattleEventType.BattleEnded, (e) => events.push(e));

      // P1 (fast) skips → P2 (slow) skips → round 2 → P1 turn starts → poison KO
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "fast",
        direction: Direction.South,
      });
      engine.submitAction(PlayerId.Player2, {
        kind: ActionKind.EndTurn,
        pokemonId: "slow",
        direction: Direction.South,
      });

      expect(p1.currentHp).toBe(0);
      expect(state.grid[0]?.[0]?.occupantId).toBe("fast");
      expect(events.some((e) => e.type === BattleEventType.PokemonEliminated)).toBe(true);
      expect(events.some((e) => e.type === BattleEventType.BattleEnded)).toBe(true);
    });

    it("KO from status tick does not end battle when other teammates alive", () => {
      const p1 = fresh(P1, {
        id: "p1-fast",
        currentHp: 1,
        statusEffects: [{ type: StatusType.Poisoned, remainingTurns: null }],
        derivedStats: { movement: 3, jump: 1, initiative: 90 },
      });
      const p1b = fresh(P1, {
        id: "p1-medium",
        playerId: PlayerId.Player1,
        position: { x: 2, y: 0 },
        derivedStats: { movement: 3, jump: 1, initiative: 50 },
      });
      const p2 = fresh(P2, {
        derivedStats: { movement: 3, jump: 1, initiative: 30 },
      });
      const state = MockBattle.stateFrom([p1, p1b, p2]);
      const engine = new BattleEngine(state, new Map());

      const events: BattleEvent[] = [];
      engine.on(BattleEventType.PokemonEliminated, (e) => events.push(e));
      engine.on(BattleEventType.BattleEnded, (e) => events.push(e));

      // Round 1: p1-fast skips, p1-medium skips, p2 skips
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "p1-fast",
        direction: Direction.South,
      });
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "p1-medium",
        direction: Direction.South,
      });
      engine.submitAction(PlayerId.Player2, {
        kind: ActionKind.EndTurn,
        pokemonId: "slow",
        direction: Direction.South,
      });

      // Round 2: p1-fast starts → poison KO → battle continues (p1-medium alive)
      expect(p1.currentHp).toBe(0);
      expect(events.some((e) => e.type === BattleEventType.PokemonEliminated)).toBe(true);
      expect(events.some((e) => e.type === BattleEventType.BattleEnded)).toBe(false);
    });
  });

  describe("battleOver", () => {
    it("getLegalActions returns empty after battle ends", () => {
      const p1 = fresh(P1, {
        currentHp: 1,
        statusEffects: [{ type: StatusType.Poisoned, remainingTurns: null }],
      });
      const p2 = fresh(P2);
      const state = MockBattle.stateFrom([p1, p2]);
      const engine = new BattleEngine(state, new Map());

      // Both skip → round 2 → P1 poison KO → battle over
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "fast",
        direction: Direction.South,
      });
      engine.submitAction(PlayerId.Player2, {
        kind: ActionKind.EndTurn,
        pokemonId: "slow",
        direction: Direction.South,
      });

      expect(engine.getLegalActions(PlayerId.Player1)).toEqual([]);
      expect(engine.getLegalActions(PlayerId.Player2)).toEqual([]);
    });

    it("submitAction returns BattleOver error after battle ends", () => {
      const p1 = fresh(P1, {
        currentHp: 1,
        statusEffects: [{ type: StatusType.Poisoned, remainingTurns: null }],
      });
      const p2 = fresh(P2);
      const state = MockBattle.stateFrom([p1, p2]);
      const engine = new BattleEngine(state, new Map());

      // Both skip → round 2 → P1 poison KO → battle over
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "fast",
        direction: Direction.South,
      });
      engine.submitAction(PlayerId.Player2, {
        kind: ActionKind.EndTurn,
        pokemonId: "slow",
        direction: Direction.South,
      });

      const result = engine.submitAction(PlayerId.Player2, {
        kind: ActionKind.EndTurn,
        pokemonId: "slow",
        direction: Direction.South,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe(ActionError.BattleOver);
    });
  });
});

describe("BattleEngine Move+Act (FFTA-like)", () => {
  it("allows Move then UseMove in the same turn", () => {
    const attacker = fresh(P1, {
      id: "attacker",
      position: { x: 0, y: 0 },
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
    });
    const target = fresh(P2, { id: "target", position: { x: 2, y: 0 } });
    const singleMove: MoveDefinition = {
      ...MockValidation.validMove,
      id: "tackle",
      targeting: { kind: TargetingKind.Single, range: { min: 1, max: 2 } },
    };
    const state = MockBattle.stateFrom([attacker, target], 5, 1);
    const engine = new BattleEngine(state, new Map([["tackle", singleMove]]));

    const moveResult = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "attacker",
      path: [{ x: 1, y: 0 }],
    });
    expect(moveResult.success).toBe(true);

    const useMoveResult = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "tackle",
      targetPosition: { x: 2, y: 0 },
    });
    expect(useMoveResult.success).toBe(true);
  });

  it("allows UseMove then Move in the same turn", () => {
    const attacker = fresh(P1, {
      id: "attacker",
      position: { x: 1, y: 0 },
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
    });
    const target = fresh(P2, { id: "target", position: { x: 2, y: 0 } });
    const singleMove: MoveDefinition = {
      ...MockValidation.validMove,
      id: "tackle",
      targeting: { kind: TargetingKind.Single, range: { min: 1, max: 2 } },
    };
    const state = MockBattle.stateFrom([attacker, target], 5, 1);
    const engine = new BattleEngine(state, new Map([["tackle", singleMove]]));

    vi.spyOn(Math, "random").mockReturnValue(0);

    const useMoveResult = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "tackle",
      targetPosition: { x: 2, y: 0 },
    });
    expect(useMoveResult.success).toBe(true);

    const moveResult = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "attacker",
      path: [{ x: 0, y: 0 }],
    });
    expect(moveResult.success).toBe(true);

    vi.restoreAllMocks();
  });

  it("rejects a second Move with AlreadyMoved", () => {
    const mover = fresh(P1, { id: "mover", position: { x: 0, y: 0 } });
    const state = MockBattle.stateFrom([mover, fresh(P2)], 5, 1);
    const engine = new BattleEngine(state, new Map());

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [{ x: 1, y: 0 }],
    });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [{ x: 2, y: 0 }],
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.AlreadyMoved);
  });

  it("rejects a second UseMove with AlreadyActed", () => {
    const attacker = fresh(P1, {
      id: "attacker",
      position: { x: 1, y: 0 },
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
    });
    const target = fresh(P2, { id: "target", position: { x: 2, y: 0 } });
    const singleMove: MoveDefinition = {
      ...MockValidation.validMove,
      id: "tackle",
      targeting: { kind: TargetingKind.Single, range: { min: 1, max: 2 } },
    };
    const state = MockBattle.stateFrom([attacker, target], 5, 1);
    const engine = new BattleEngine(state, new Map([["tackle", singleMove]]));

    vi.spyOn(Math, "random").mockReturnValue(0);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "tackle",
      targetPosition: { x: 2, y: 0 },
    });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "tackle",
      targetPosition: { x: 2, y: 0 },
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.AlreadyActed);

    vi.restoreAllMocks();
  });

  it("EndTurn without any action works (former SkipTurn)", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());
    const events: BattleEvent[] = [];
    engine.on(BattleEventType.TurnStarted, (e) => events.push(e));

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "fast",
      direction: Direction.South,
    });
    expect(result.success).toBe(true);
    expect(events.length).toBe(1);
    expect((events[0] as { pokemonId: string }).pokemonId).toBe("slow");
  });

  it("EndTurn with direction updates orientation", () => {
    const mover = fresh(P1, { id: "mover" });
    const state = MockBattle.stateFrom([mover, fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "mover",
      direction: Direction.West,
    });

    expect(state.pokemon.get("mover")?.orientation).toBe(Direction.West);
  });

  it("getLegalActions returns EndTurn with all 4 directions", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    const endTurnActions = engine
      .getLegalActions(PlayerId.Player1)
      .filter((a) => a.kind === ActionKind.EndTurn);

    expect(endTurnActions).toHaveLength(4);
    const directions = endTurnActions.map((a) => a.kind === ActionKind.EndTurn && a.direction);
    expect(directions).toContain(Direction.North);
    expect(directions).toContain(Direction.South);
    expect(directions).toContain(Direction.East);
    expect(directions).toContain(Direction.West);
  });

  it("getLegalActions after Move excludes Move but includes UseMove and EndTurn", () => {
    const attacker = fresh(P1, {
      id: "attacker",
      position: { x: 0, y: 0 },
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
    });
    const target = fresh(P2, { id: "target", position: { x: 3, y: 0 } });
    const singleMove: MoveDefinition = {
      ...MockValidation.validMove,
      id: "tackle",
      targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    };
    const state = MockBattle.stateFrom([attacker, target], 5, 1);
    const engine = new BattleEngine(state, new Map([["tackle", singleMove]]));

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "attacker",
      path: [{ x: 1, y: 0 }],
    });

    const actions = engine.getLegalActions(PlayerId.Player1);
    expect(actions.filter((a) => a.kind === ActionKind.Move)).toHaveLength(0);
    expect(actions.filter((a) => a.kind === ActionKind.UseMove).length).toBeGreaterThan(0);
    expect(actions.filter((a) => a.kind === ActionKind.EndTurn)).toHaveLength(4);
  });

  it("getLegalActions after UseMove excludes UseMove but includes Move and EndTurn", () => {
    const attacker = fresh(P1, {
      id: "attacker",
      position: { x: 1, y: 0 },
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
    });
    const target = fresh(P2, { id: "target", position: { x: 2, y: 0 } });
    const singleMove: MoveDefinition = {
      ...MockValidation.validMove,
      id: "tackle",
      targeting: { kind: TargetingKind.Single, range: { min: 1, max: 2 } },
    };
    const state = MockBattle.stateFrom([attacker, target], 5, 1);
    const engine = new BattleEngine(state, new Map([["tackle", singleMove]]));

    vi.spyOn(Math, "random").mockReturnValue(0);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "tackle",
      targetPosition: { x: 2, y: 0 },
    });

    const actions = engine.getLegalActions(PlayerId.Player1);
    expect(actions.filter((a) => a.kind === ActionKind.UseMove)).toHaveLength(0);
    expect(actions.filter((a) => a.kind === ActionKind.Move).length).toBeGreaterThan(0);
    expect(actions.filter((a) => a.kind === ActionKind.EndTurn)).toHaveLength(4);

    vi.restoreAllMocks();
  });

  it("getLegalActions after Move+UseMove returns only EndTurn", () => {
    const attacker = fresh(P1, {
      id: "attacker",
      position: { x: 0, y: 0 },
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
    });
    const target = fresh(P2, { id: "target", position: { x: 2, y: 0 } });
    const singleMove: MoveDefinition = {
      ...MockValidation.validMove,
      id: "tackle",
      targeting: { kind: TargetingKind.Single, range: { min: 1, max: 2 } },
    };
    const state = MockBattle.stateFrom([attacker, target], 5, 1);
    const engine = new BattleEngine(state, new Map([["tackle", singleMove]]));

    vi.spyOn(Math, "random").mockReturnValue(0);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "attacker",
      path: [{ x: 1, y: 0 }],
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "tackle",
      targetPosition: { x: 2, y: 0 },
    });

    const actions = engine.getLegalActions(PlayerId.Player1);
    expect(actions).toHaveLength(4);
    expect(actions.every((a) => a.kind === ActionKind.EndTurn)).toBe(true);

    vi.restoreAllMocks();
  });
});

describe("BattleEngine dash move", () => {
  const dashMove: MoveDefinition = {
    ...MockValidation.validMove,
    id: "quick-attack",
    targeting: { kind: TargetingKind.Dash, maxDistance: 3 },
  };

  const dashRegistry = new Map([["quick-attack", dashMove]]);

  it("moves caster to the targeted empty tile", () => {
    const attacker = fresh(P1, {
      id: "attacker",
      position: { x: 0, y: 0 },
      moveIds: ["quick-attack"],
      currentPp: { "quick-attack": 30 },
    });
    const state = MockBattle.stateFrom([attacker, fresh(P2)]);
    const engine = new BattleEngine(state, dashRegistry);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "quick-attack",
      targetPosition: { x: 2, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get("attacker")?.position).toEqual({ x: 2, y: 0 });
  });

  it("frees the origin tile and occupies the destination tile in the grid", () => {
    const attacker = fresh(P1, {
      id: "attacker",
      position: { x: 0, y: 0 },
      moveIds: ["quick-attack"],
      currentPp: { "quick-attack": 30 },
    });
    const state = MockBattle.stateFrom([attacker, fresh(P2)]);
    const engine = new BattleEngine(state, dashRegistry);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "quick-attack",
      targetPosition: { x: 2, y: 0 },
    });

    expect(state.grid[0]?.[0]?.occupantId).toBeNull();
    expect(state.grid[0]?.[2]?.occupantId).toBe("attacker");
  });

  it("emits PokemonMoved event with caster id and destination", () => {
    const attacker = fresh(P1, {
      id: "attacker",
      position: { x: 0, y: 0 },
      moveIds: ["quick-attack"],
      currentPp: { "quick-attack": 30 },
    });
    const state = MockBattle.stateFrom([attacker, fresh(P2)]);
    const engine = new BattleEngine(state, dashRegistry);

    const events: BattleEvent[] = [];
    engine.on(BattleEventType.PokemonMoved, (e) => events.push(e));

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "quick-attack",
      targetPosition: { x: 2, y: 0 },
    });

    const movedEvents = events.filter((e) => e.type === BattleEventType.PokemonMoved);
    expect(movedEvents.length).toBe(1);
    expect(movedEvents[0]).toMatchObject({
      type: BattleEventType.PokemonMoved,
      pokemonId: "attacker",
      path: [{ x: 2, y: 0 }],
    });
  });

  it("stops just before an enemy on the path and attacks the enemy", () => {
    const attacker = fresh(P1, {
      id: "attacker",
      position: { x: 0, y: 0 },
      moveIds: ["quick-attack"],
      currentPp: { "quick-attack": 30 },
    });
    const enemy = fresh(P2, { id: "enemy", position: { x: 2, y: 0 } });
    const state = MockBattle.stateFrom([attacker, enemy], 5, 1);
    const engine = new BattleEngine(state, dashRegistry);

    vi.spyOn(Math, "random").mockReturnValue(0);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "quick-attack",
      targetPosition: { x: 2, y: 0 },
    });

    expect(state.pokemon.get("attacker")?.position).toEqual({ x: 1, y: 0 });

    vi.restoreAllMocks();
  });

  it("does not move caster when enemy is directly adjacent (no room to stop before)", () => {
    const attacker = fresh(P1, {
      id: "attacker",
      position: { x: 0, y: 0 },
      moveIds: ["quick-attack"],
      currentPp: { "quick-attack": 30 },
    });
    const enemy = fresh(P2, { id: "enemy", position: { x: 1, y: 0 } });
    const state = MockBattle.stateFrom([attacker, enemy], 5, 1);
    const engine = new BattleEngine(state, dashRegistry);

    vi.spyOn(Math, "random").mockReturnValue(0);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "quick-attack",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get("attacker")?.position).toEqual({ x: 0, y: 0 });

    vi.restoreAllMocks();
  });

  it("does not emit PokemonMoved when caster cannot advance", () => {
    const attacker = fresh(P1, {
      id: "attacker",
      position: { x: 0, y: 0 },
      moveIds: ["quick-attack"],
      currentPp: { "quick-attack": 30 },
    });
    const enemy = fresh(P2, { id: "enemy", position: { x: 1, y: 0 } });
    const state = MockBattle.stateFrom([attacker, enemy], 5, 1);
    const engine = new BattleEngine(state, dashRegistry);

    vi.spyOn(Math, "random").mockReturnValue(0);

    const events: BattleEvent[] = [];
    engine.on(BattleEventType.PokemonMoved, (e) => events.push(e));

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "quick-attack",
      targetPosition: { x: 1, y: 0 },
    });

    expect(events.filter((e) => e.type === BattleEventType.PokemonMoved)).toHaveLength(0);

    vi.restoreAllMocks();
  });

  it("consumes hasActed — cannot use another move after dash", () => {
    const attacker = fresh(P1, {
      id: "attacker",
      position: { x: 0, y: 0 },
      moveIds: ["quick-attack"],
      currentPp: { "quick-attack": 30 },
    });
    const state = MockBattle.stateFrom([attacker, fresh(P2)]);
    const engine = new BattleEngine(state, dashRegistry);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "quick-attack",
      targetPosition: { x: 2, y: 0 },
    });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "quick-attack",
      targetPosition: { x: 3, y: 0 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.AlreadyActed);
  });

  it("does not consume hasMoved — caster can still move after dash", () => {
    const attacker = fresh(P1, {
      id: "attacker",
      position: { x: 0, y: 0 },
      moveIds: ["quick-attack"],
      currentPp: { "quick-attack": 30 },
    });
    const state = MockBattle.stateFrom([attacker, fresh(P2)]);
    const engine = new BattleEngine(state, dashRegistry);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "quick-attack",
      targetPosition: { x: 2, y: 0 },
    });

    const moveResult = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "attacker",
      path: [{ x: 2, y: 1 }],
    });

    expect(moveResult.success).toBe(true);
  });

  it("getLegalActions after dash excludes UseMove but includes Move", () => {
    const attacker = fresh(P1, {
      id: "attacker",
      position: { x: 0, y: 0 },
      moveIds: ["quick-attack"],
      currentPp: { "quick-attack": 30 },
    });
    const state = MockBattle.stateFrom([attacker, fresh(P2)]);
    const engine = new BattleEngine(state, dashRegistry);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "quick-attack",
      targetPosition: { x: 2, y: 0 },
    });

    const actions = engine.getLegalActions(PlayerId.Player1);
    expect(actions.filter((a) => a.kind === ActionKind.UseMove)).toHaveLength(0);
    expect(actions.filter((a) => a.kind === ActionKind.Move).length).toBeGreaterThan(0);
    expect(actions.filter((a) => a.kind === ActionKind.EndTurn)).toHaveLength(4);
  });

  it("updates caster orientation toward target after dash", () => {
    const attacker = fresh(P1, {
      id: "attacker",
      position: { x: 0, y: 0 },
      moveIds: ["quick-attack"],
      currentPp: { "quick-attack": 30 },
    });
    const state = MockBattle.stateFrom([attacker, fresh(P2)]);
    const engine = new BattleEngine(state, dashRegistry);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "quick-attack",
      targetPosition: { x: 0, y: 2 },
    });

    expect(state.pokemon.get("attacker")?.orientation).toBe(Direction.South);
  });
});

describe("BattleEngine KO body blocking", () => {
  const dashMove: MoveDefinition = {
    ...MockValidation.validMove,
    id: "quick-attack",
    targeting: { kind: TargetingKind.Dash, maxDistance: 5 },
  };

  const aoeMove: MoveDefinition = {
    ...MockValidation.validMove,
    id: "earthquake",
    targeting: { kind: TargetingKind.Zone, radius: 2 },
  };

  it("getLegalActions includes a tile beyond a KO body", () => {
    const attacker = fresh(P1, {
      id: "attacker",
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 90 },
    });
    const koEnemy = fresh(P2, {
      id: "ko-enemy",
      position: { x: 1, y: 0 },
      currentHp: 0,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const state = MockBattle.stateFrom([attacker, koEnemy], 5, 1);
    const engine = new BattleEngine(state, new Map());

    const destinations = engine
      .getLegalActions(PlayerId.Player1)
      .filter((a) => a.kind === ActionKind.Move)
      .map((a) => (a.kind === ActionKind.Move ? a.path[a.path.length - 1] : null));

    expect(destinations).toContainEqual({ x: 2, y: 0 });
  });

  it("getLegalActions excludes the tile occupied by a KO body", () => {
    const attacker = fresh(P1, {
      id: "attacker",
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 90 },
    });
    const koEnemy = fresh(P2, {
      id: "ko-enemy",
      position: { x: 1, y: 0 },
      currentHp: 0,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const state = MockBattle.stateFrom([attacker, koEnemy], 5, 1);
    const engine = new BattleEngine(state, new Map());

    const destinations = engine
      .getLegalActions(PlayerId.Player1)
      .filter((a) => a.kind === ActionKind.Move)
      .map((a) => (a.kind === ActionKind.Move ? a.path[a.path.length - 1] : null));

    expect(destinations).not.toContainEqual({ x: 1, y: 0 });
  });

  it("dash traverses a KO body and stops just before a living enemy", () => {
    const attacker = fresh(P1, {
      id: "attacker",
      position: { x: 0, y: 0 },
      moveIds: ["quick-attack"],
      currentPp: { "quick-attack": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 90 },
    });
    const koEnemy = fresh(P2, {
      id: "ko-enemy",
      position: { x: 1, y: 0 },
      currentHp: 0,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const livingEnemy = fresh(P2, {
      id: "living-enemy",
      position: { x: 3, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const state = MockBattle.stateFrom([attacker, koEnemy, livingEnemy], 5, 1);
    const engine = new BattleEngine(state, new Map([["quick-attack", dashMove]]));

    vi.spyOn(Math, "random").mockReturnValue(0);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "quick-attack",
      targetPosition: { x: 3, y: 0 },
    });

    expect(state.pokemon.get("attacker")?.position).toEqual({ x: 2, y: 0 });

    vi.restoreAllMocks();
  });

  it("dash stops just before a living enemy (unaffected by KO body logic)", () => {
    const attacker = fresh(P1, {
      id: "attacker",
      position: { x: 0, y: 0 },
      moveIds: ["quick-attack"],
      currentPp: { "quick-attack": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 90 },
    });
    const livingEnemy = fresh(P2, {
      id: "living-enemy",
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const state = MockBattle.stateFrom([attacker, livingEnemy], 5, 1);
    const engine = new BattleEngine(state, new Map([["quick-attack", dashMove]]));

    vi.spyOn(Math, "random").mockReturnValue(0);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "quick-attack",
      targetPosition: { x: 2, y: 0 },
    });

    expect(state.pokemon.get("attacker")?.position).toEqual({ x: 1, y: 0 });

    vi.restoreAllMocks();
  });

  it("AoE move does not deal damage to a KO body on an affected tile", () => {
    const attacker = fresh(P1, {
      id: "attacker",
      position: { x: 0, y: 0 },
      moveIds: ["earthquake"],
      currentPp: { earthquake: 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 90 },
    });
    const koEnemy = fresh(P2, {
      id: "ko-enemy",
      position: { x: 1, y: 0 },
      currentHp: 0,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const state = MockBattle.stateFrom([attacker, koEnemy], 5, 5);
    const engine = new BattleEngine(state, new Map([["earthquake", aoeMove]]));

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "earthquake",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get("ko-enemy")?.currentHp).toBe(0);
  });

  describe("getReachableTilesForPokemon", () => {
    it("returns reachable positions for an alive Pokemon", () => {
      const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
      const engine = new BattleEngine(state, new Map());

      const tiles = engine.getReachableTilesForPokemon("fast");
      expect(tiles.length).toBeGreaterThan(0);
      expect(tiles.every((t) => t.x !== undefined && t.y !== undefined)).toBe(true);
      expect(tiles.find((t) => t.x === 0 && t.y === 0)).toBeUndefined();
    });

    it("returns empty array for a KO Pokemon", () => {
      const p1 = fresh(P1);
      const p2 = fresh(P2, { currentHp: 0 });
      const state = MockBattle.stateFrom([p1, p2]);
      const engine = new BattleEngine(state, new Map());

      expect(engine.getReachableTilesForPokemon("slow")).toEqual([]);
    });

    it("returns empty array for a non-existent Pokemon", () => {
      const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
      const engine = new BattleEngine(state, new Map());

      expect(engine.getReachableTilesForPokemon("does-not-exist")).toEqual([]);
    });

    it("returns empty array when battle is over", () => {
      const p1 = fresh(P1, { position: { x: 0, y: 0 } });
      const p2 = fresh(P2, { position: { x: 1, y: 0 }, currentHp: 1 });
      const _state = MockBattle.stateFrom([p1, p2]);
      const move: MoveDefinition = {
        id: "test-hit",
        name: "Test Hit",
        type: "normal",
        category: Category.Physical,
        power: 200,
        accuracy: 100,
        pp: 10,
        targeting: { kind: TargetingKind.Single, range: 1 },
        effects: [{ kind: EffectKind.Damage, target: "foe" }],
      };
      const engine = new BattleEngine(
        MockBattle.stateFrom([
          fresh(P1, {
            position: { x: 0, y: 0 },
            moveIds: ["test-hit"],
            currentPp: { "test-hit": 10 },
          }),
          fresh(P2, { position: { x: 1, y: 0 }, currentHp: 1 }),
        ]),
        new Map([["test-hit", move]]),
      );

      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "fast",
        moveId: "test-hit",
        targetPosition: { x: 1, y: 0 },
      });

      expect(engine.getReachableTilesForPokemon("fast")).toEqual([]);
    });

    it("does not include tiles occupied by living enemies", () => {
      const p1 = fresh(P1, { position: { x: 0, y: 0 } });
      const p2 = fresh(P2, { position: { x: 1, y: 0 } });
      const state = MockBattle.stateFrom([p1, p2]);
      const engine = new BattleEngine(state, new Map());

      const tiles = engine.getReachableTilesForPokemon("fast");
      expect(tiles.find((t) => t.x === 1 && t.y === 0)).toBeUndefined();
    });
  });
});
