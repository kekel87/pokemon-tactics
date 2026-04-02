import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("recharge", () => {
  function makeAttacker() {
    return MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      moveIds: ["hyper-beam", "scratch"],
      currentPp: { "hyper-beam": 5, scratch: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
  }

  function makeFoe() {
    return MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
  }

  it("blocks use_move actions on the next turn after using a recharge move", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = makeAttacker();
    const foe = makeFoe();
    const { engine, state } = buildMoveTestEngine([attacker, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "hyper-beam",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.RechargeStarted);
    expect(state.pokemon.get(attacker.id)!.recharging).toBe(true);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: attacker.id,
      direction: Direction.East,
    });

    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: foe.id,
      direction: Direction.West,
    });

    const legalActions = engine.getLegalActions(PlayerId.Player1);
    const useMoveActions = legalActions.filter((a) => a.kind === ActionKind.UseMove);
    expect(useMoveActions).toHaveLength(0);

    vi.restoreAllMocks();
  });

  it("allows move (movement) during recharge turn", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = makeAttacker();
    const foe = makeFoe({ position: { x: 5, y: 0 } });
    const { engine } = buildMoveTestEngine([attacker, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "hyper-beam",
      targetPosition: { x: 1, y: 0 },
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: attacker.id,
      direction: Direction.East,
    });
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: foe.id,
      direction: Direction.West,
    });

    const legalActions = engine.getLegalActions(PlayerId.Player1);
    const moveActions = legalActions.filter((a) => a.kind === ActionKind.Move);
    expect(moveActions.length).toBeGreaterThan(0);

    vi.restoreAllMocks();
  });

  it("recharge ends at end of recharge turn", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = makeAttacker();
    const foe = makeFoe();
    const { engine, state } = buildMoveTestEngine([attacker, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "hyper-beam",
      targetPosition: { x: 1, y: 0 },
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: attacker.id,
      direction: Direction.East,
    });
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: foe.id,
      direction: Direction.West,
    });

    const endTurnResult = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: attacker.id,
      direction: Direction.East,
    });

    expect(endTurnResult.events.map((e) => e.type)).toContain(BattleEventType.RechargeEnded);
    expect(state.pokemon.get(attacker.id)!.recharging).toBe(false);

    vi.restoreAllMocks();
  });

  it("does not error if pokemon is KO during recharge", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = makeAttacker({ currentHp: 1, maxHp: 100 });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      combatStats: { hp: 500, attack: 200, defense: 55, spAttack: 55, spDefense: 55, speed: 55 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "hyper-beam",
      targetPosition: { x: 1, y: 0 },
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: attacker.id,
      direction: Direction.East,
    });

    expect(() => {
      engine.submitAction(PlayerId.Player2, {
        kind: ActionKind.UseMove,
        pokemonId: foe.id,
        moveId: "scratch",
        targetPosition: { x: 0, y: 0 },
      });
    }).not.toThrow();

    vi.restoreAllMocks();
  });
});
