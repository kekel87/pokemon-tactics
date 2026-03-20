import { describe, expect, it, vi } from "vitest";
import { ActionError } from "../enums/action-error";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { Direction } from "../enums/direction";
import type { BattleEvent } from "../types/battle-event";
import type { PokemonInstance } from "../types/pokemon-instance";
import { MockBattle } from "../testing/mock-battle";
import { BattleEngine } from "./BattleEngine";

const P1 = MockBattle.player1Fast;
const P2 = MockBattle.player2Slow;

function fresh(base: PokemonInstance, overrides?: Partial<PokemonInstance>): PokemonInstance {
  return {
    ...base,
    position: { ...base.position },
    baseStats: { ...base.baseStats },
    derivedStats: { ...base.derivedStats },
    statStages: { ...base.statStages },
    statusEffects: [...base.statusEffects],
    moveIds: [...base.moveIds],
    currentPp: { ...base.currentPp },
    ...overrides,
  };
}

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

    engine.submitAction("player-1", { kind: ActionKind.SkipTurn, pokemonId: "fast" });

    const turnEndedEvents = events.filter((e) => e.type === BattleEventType.TurnEnded);
    expect(turnEndedEvents.length).toBe(1);
  });

  it("stops notifying after off()", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    const handler = vi.fn();
    engine.on(BattleEventType.TurnEnded, handler);
    engine.off(BattleEventType.TurnEnded, handler);

    engine.submitAction("player-1", { kind: ActionKind.SkipTurn, pokemonId: "fast" });

    expect(handler).not.toHaveBeenCalled();
  });
});

describe("BattleEngine.getLegalActions", () => {
  it("returns skip_turn and move actions for the active pokemon", () => {
    const mover = fresh(P1, { id: "mover", position: { x: 2, y: 2 } });
    const state = MockBattle.stateFrom([mover, fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    const actions = engine.getLegalActions("player-1");
    expect(actions.filter((a) => a.kind === ActionKind.SkipTurn).length).toBe(1);
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
      kind: ActionKind.SkipTurn,
      pokemonId: "fast",
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.NotYourTurn);
  });

  it("rejects use_move as not implemented", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    const result = engine.submitAction("player-1", {
      kind: ActionKind.UseMove,
      pokemonId: "fast",
      moveId: "tackle",
      targetPosition: { x: 1, y: 0 },
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.NotImplemented);
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

  it("advances the turn after a move", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());
    const events: BattleEvent[] = [];
    engine.on(BattleEventType.TurnStarted, (e) => events.push(e));

    engine.submitAction("player-1", {
      kind: ActionKind.Move,
      pokemonId: "fast",
      path: [{ x: 1, y: 0 }],
    });

    expect(events.length).toBe(1);
    expect(events[0]?.type).toBe(BattleEventType.TurnStarted);
    expect((events[0] as { pokemonId: string }).pokemonId).toBe("slow");
  });

  it("increments roundNumber after a full round", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    expect(state.roundNumber).toBe(1);
    engine.submitAction("player-1", { kind: ActionKind.SkipTurn, pokemonId: "fast" });
    engine.submitAction("player-2", { kind: ActionKind.SkipTurn, pokemonId: "slow" });
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
      engine.submitAction("player-1", { kind: ActionKind.SkipTurn, pokemonId: "fast" });
      engine.submitAction("player-2", { kind: ActionKind.SkipTurn, pokemonId: "slow" });
    }
    expect(state.roundNumber).toBe(4);
  });
});
