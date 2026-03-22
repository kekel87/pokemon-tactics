import { describe, expect, it, vi } from "vitest";
import { ActionError } from "../enums/action-error";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { Category } from "../enums/category";
import { Direction } from "../enums/direction";
import { EffectKind } from "../enums/effect-kind";
import { LinkType } from "../enums/link-type";
import { StatusType } from "../enums/status-type";
import { TargetingKind } from "../enums/targeting-kind";
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

    const gameState = engine.getGameState("player-1");
    expect(gameState.pokemon.size).toBe(2);
    expect(gameState.roundNumber).toBe(1);
  });

  it("synchronizes turnOrder in BattleState from TurnManager", () => {
    const state = MockBattle.stateFrom([fresh(P2), fresh(P1)]);
    const engine = new BattleEngine(state, new Map());

    const gameState = engine.getGameState("player-1");
    expect(gameState.turnOrder).toEqual(["fast", "slow"]);
    expect(gameState.currentTurnIndex).toBe(0);
  });

  it("notifies event handlers via on()", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    const events: BattleEvent[] = [];
    engine.on(BattleEventType.TurnEnded, (event) => events.push(event));

    engine.submitAction("player-1", { kind: ActionKind.EndTurn, pokemonId: "fast" });

    const turnEndedEvents = events.filter((e) => e.type === BattleEventType.TurnEnded);
    expect(turnEndedEvents.length).toBe(1);
  });

  it("stops notifying after off()", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    const handler = vi.fn();
    engine.on(BattleEventType.TurnEnded, handler);
    engine.off(BattleEventType.TurnEnded, handler);

    engine.submitAction("player-1", { kind: ActionKind.EndTurn, pokemonId: "fast" });

    expect(handler).not.toHaveBeenCalled();
  });
});

describe("BattleEngine.getLegalActions", () => {
  it("returns end_turn and move actions for the active pokemon", () => {
    const mover = fresh(P1, { id: "mover", position: { x: 2, y: 2 } });
    const state = MockBattle.stateFrom([mover, fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    const actions = engine.getLegalActions("player-1");
    expect(actions.filter((a) => a.kind === ActionKind.EndTurn).length).toBe(1);
    expect(actions.filter((a) => a.kind === ActionKind.Move).length).toBeGreaterThan(0);
  });

  it("returns reachable tiles within movement range on empty grid", () => {
    const mover = fresh(P1, { id: "mover", position: { x: 2, y: 2 } });
    const state = MockBattle.stateFrom([mover, fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    const moveActions = engine
      .getLegalActions("player-1")
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
      .getLegalActions("player-1")
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
      .getLegalActions("player-1")
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
      .getLegalActions("player-1")
      .filter((a) => a.kind === ActionKind.Move)
      .map((a) => (a.kind === ActionKind.Move ? a.path[a.path.length - 1] : null));

    expect(destinations).not.toContainEqual({ x: 1, y: 0 });
    expect(destinations).not.toContainEqual({ x: 2, y: 0 });
  });

  it("excludes impassable tiles from reachable tiles", () => {
    const mover = fresh(P1, { id: "mover", position: { x: 0, y: 0 } });
    const state = MockBattle.stateFrom([mover, fresh(P2)], 5, 1);
    MockBattle.setTile(state, 1, 0, { isPassable: false });
    const engine = new BattleEngine(state, new Map());

    expect(
      engine.getLegalActions("player-1").filter((a) => a.kind === ActionKind.Move).length,
    ).toBe(0);
  });

  it("returns empty actions for wrong playerId", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    expect(engine.getLegalActions("player-2")).toEqual([]);
  });
});

describe("BattleEngine.submitAction validation", () => {
  it("rejects action from wrong player", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    const result = engine.submitAction("player-2", {
      kind: ActionKind.EndTurn,
      pokemonId: "fast",
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.NotYourTurn);
  });

  it("rejects use_move with unknown move", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    const result = engine.submitAction("player-1", {
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

    const result = engine.submitAction("player-1", {
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

    engine.submitAction("player-1", {
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

    engine.submitAction("player-1", {
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

    const result = engine.submitAction("player-1", {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 4, y: 0 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects move for wrong pokemon", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    const result = engine.submitAction("player-1", {
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

    const result = engine.submitAction("player-1", {
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

    const result = engine.submitAction("player-1", {
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

    engine.submitAction("player-1", {
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

    engine.submitAction("player-1", {
      kind: ActionKind.Move,
      pokemonId: "fast",
      path: [{ x: 1, y: 0 }],
    });
    engine.submitAction("player-1", {
      kind: ActionKind.EndTurn,
      pokemonId: "fast",
    });

    expect(events.length).toBe(1);
    expect(events[0]?.type).toBe(BattleEventType.TurnStarted);
    expect((events[0] as { pokemonId: string }).pokemonId).toBe("slow");
  });

  it("increments roundNumber after a full round", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    expect(state.roundNumber).toBe(1);
    engine.submitAction("player-1", { kind: ActionKind.EndTurn, pokemonId: "fast" });
    engine.submitAction("player-2", { kind: ActionKind.EndTurn, pokemonId: "slow" });
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

    const result = engine.submitAction("player-1", {
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

    const result = engine.submitAction("player-1", {
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

    const result = engine.submitAction("player-1", {
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
    MockBattle.setTile(state, 1, 0, { isPassable: false });
    const engine = new BattleEngine(state, new Map());

    const result = engine.submitAction("player-1", {
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

    const result = engine.submitAction("player-1", {
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
      engine.submitAction("player-1", { kind: ActionKind.EndTurn, pokemonId: "fast" });
      engine.submitAction("player-2", { kind: ActionKind.EndTurn, pokemonId: "slow" });
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
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 2 }, width: 3 },
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
      .getLegalActions("player-1")
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
      .getLegalActions("player-1")
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
      .getLegalActions("player-1")
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
      .getLegalActions("player-1")
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
      .getLegalActions("player-1")
      .filter((a) => a.kind === ActionKind.UseMove);

    expect(useMoveActions.length).toBe(4);
  });

  it("returns 4 directional actions for dash-targeting move", () => {
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
      .getLegalActions("player-1")
      .filter((a) => a.kind === ActionKind.UseMove);

    expect(useMoveActions.length).toBe(4);
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
      .getLegalActions("player-1")
      .filter((a) => a.kind === ActionKind.UseMove);

    const moveIds = [
      ...new Set(useMoveActions.map((a) => (a.kind === ActionKind.UseMove ? a.moveId : ""))),
    ];
    expect(moveIds).toContain("tackle");
    expect(moveIds).toContain("growth");
  });

  describe("handleKo", () => {
    it("KO removes pokemon from turn order and frees tile", () => {
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
      engine.submitAction("player-1", { kind: ActionKind.EndTurn, pokemonId: "fast" });
      engine.submitAction("player-2", { kind: ActionKind.EndTurn, pokemonId: "slow" });

      expect(p1.currentHp).toBe(0);
      expect(state.grid[0]?.[0]?.occupantId).toBeNull();
      expect(events.some((e) => e.type === BattleEventType.PokemonEliminated)).toBe(true);
      expect(events.some((e) => e.type === BattleEventType.BattleEnded)).toBe(true);
    });

    it("KO breaks all links involving the KO'd pokemon", () => {
      const p1 = fresh(P1, {
        currentHp: 1,
        statusEffects: [{ type: StatusType.Poisoned, remainingTurns: null }],
      });
      const p2 = fresh(P2);
      const state = MockBattle.stateFrom([p1, p2]);
      state.activeLinks = [
        {
          sourceId: p1.id,
          targetId: p2.id,
          linkType: LinkType.LeechSeed,
          remainingTurns: null,
          maxRange: 10,
          drainFraction: 1 / 8,
        },
        {
          sourceId: p2.id,
          targetId: p1.id,
          linkType: LinkType.LeechSeed,
          remainingTurns: null,
          maxRange: 10,
          drainFraction: 1 / 8,
        },
      ];
      const engine = new BattleEngine(state, new Map());

      const events: BattleEvent[] = [];
      engine.on(BattleEventType.LinkBroken, (e) => events.push(e));

      // P1 skips → P2 skips → round 2 → P1 turn starts → poison KO → links break
      engine.submitAction("player-1", { kind: ActionKind.EndTurn, pokemonId: "fast" });
      engine.submitAction("player-2", { kind: ActionKind.EndTurn, pokemonId: "slow" });

      expect(state.activeLinks).toHaveLength(0);
      const linkBrokenEvents = events.filter((e) => e.type === BattleEventType.LinkBroken);
      expect(linkBrokenEvents.length).toBeGreaterThanOrEqual(2);
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
        playerId: "player-1",
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
      engine.submitAction("player-1", { kind: ActionKind.EndTurn, pokemonId: "p1-fast" });
      engine.submitAction("player-1", { kind: ActionKind.EndTurn, pokemonId: "p1-medium" });
      engine.submitAction("player-2", { kind: ActionKind.EndTurn, pokemonId: "slow" });

      // Round 2: p1-fast starts → poison KO → battle continues (p1-medium alive)
      expect(p1.currentHp).toBe(0);
      expect(events.some((e) => e.type === BattleEventType.PokemonEliminated)).toBe(true);
      expect(events.some((e) => e.type === BattleEventType.BattleEnded)).toBe(false);
    });

    it("KO from EndTurn drain during skip (sleep + leech seed)", () => {
      const source = fresh(P1, {
        id: "source",
        currentHp: 50,
        derivedStats: { movement: 3, jump: 1, initiative: 90 },
      });
      const target = fresh(P2, {
        id: "target",
        currentHp: 1,
        statusEffects: [{ type: StatusType.Asleep, remainingTurns: 3 }],
        derivedStats: { movement: 3, jump: 1, initiative: 30 },
      });
      const state = MockBattle.stateFrom([source, target]);
      state.activeLinks = [
        {
          sourceId: "source",
          targetId: "target",
          linkType: LinkType.LeechSeed,
          remainingTurns: null,
          maxRange: 10,
          drainFraction: 1 / 8,
        },
      ];
      const engine = new BattleEngine(state, new Map());

      const events: BattleEvent[] = [];
      engine.on(BattleEventType.PokemonKo, (e) => events.push(e));
      engine.on(BattleEventType.BattleEnded, (e) => events.push(e));

      // Source skips → target's turn → sleep skip → EndTurn drain → target KO
      engine.submitAction("player-1", { kind: ActionKind.EndTurn, pokemonId: "source" });

      expect(target.currentHp).toBe(0);
      expect(events.some((e) => e.type === BattleEventType.PokemonKo)).toBe(true);
      expect(events.some((e) => e.type === BattleEventType.BattleEnded)).toBe(true);
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
      engine.submitAction("player-1", { kind: ActionKind.EndTurn, pokemonId: "fast" });
      engine.submitAction("player-2", { kind: ActionKind.EndTurn, pokemonId: "slow" });

      expect(engine.getLegalActions("player-1")).toEqual([]);
      expect(engine.getLegalActions("player-2")).toEqual([]);
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
      engine.submitAction("player-1", { kind: ActionKind.EndTurn, pokemonId: "fast" });
      engine.submitAction("player-2", { kind: ActionKind.EndTurn, pokemonId: "slow" });

      const result = engine.submitAction("player-2", {
        kind: ActionKind.EndTurn,
        pokemonId: "slow",
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

    const moveResult = engine.submitAction("player-1", {
      kind: ActionKind.Move,
      pokemonId: "attacker",
      path: [{ x: 1, y: 0 }],
    });
    expect(moveResult.success).toBe(true);

    const useMoveResult = engine.submitAction("player-1", {
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

    const useMoveResult = engine.submitAction("player-1", {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "tackle",
      targetPosition: { x: 2, y: 0 },
    });
    expect(useMoveResult.success).toBe(true);

    const moveResult = engine.submitAction("player-1", {
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

    engine.submitAction("player-1", {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [{ x: 1, y: 0 }],
    });

    const result = engine.submitAction("player-1", {
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

    engine.submitAction("player-1", {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "tackle",
      targetPosition: { x: 2, y: 0 },
    });

    const result = engine.submitAction("player-1", {
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

    const result = engine.submitAction("player-1", {
      kind: ActionKind.EndTurn,
      pokemonId: "fast",
    });
    expect(result.success).toBe(true);
    expect(events.length).toBe(1);
    expect((events[0] as { pokemonId: string }).pokemonId).toBe("slow");
  });

  it("EndTurn with direction updates orientation", () => {
    const mover = fresh(P1, { id: "mover" });
    const state = MockBattle.stateFrom([mover, fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    engine.submitAction("player-1", {
      kind: ActionKind.EndTurn,
      pokemonId: "mover",
      direction: Direction.West,
    });

    expect(state.pokemon.get("mover")?.orientation).toBe(Direction.West);
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

    engine.submitAction("player-1", {
      kind: ActionKind.Move,
      pokemonId: "attacker",
      path: [{ x: 1, y: 0 }],
    });

    const actions = engine.getLegalActions("player-1");
    expect(actions.filter((a) => a.kind === ActionKind.Move)).toHaveLength(0);
    expect(actions.filter((a) => a.kind === ActionKind.UseMove).length).toBeGreaterThan(0);
    expect(actions.filter((a) => a.kind === ActionKind.EndTurn)).toHaveLength(1);
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

    engine.submitAction("player-1", {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "tackle",
      targetPosition: { x: 2, y: 0 },
    });

    const actions = engine.getLegalActions("player-1");
    expect(actions.filter((a) => a.kind === ActionKind.UseMove)).toHaveLength(0);
    expect(actions.filter((a) => a.kind === ActionKind.Move).length).toBeGreaterThan(0);
    expect(actions.filter((a) => a.kind === ActionKind.EndTurn)).toHaveLength(1);

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

    engine.submitAction("player-1", {
      kind: ActionKind.Move,
      pokemonId: "attacker",
      path: [{ x: 1, y: 0 }],
    });
    engine.submitAction("player-1", {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "tackle",
      targetPosition: { x: 2, y: 0 },
    });

    const actions = engine.getLegalActions("player-1");
    expect(actions).toHaveLength(1);
    expect(actions[0]?.kind).toBe(ActionKind.EndTurn);

    vi.restoreAllMocks();
  });
});
