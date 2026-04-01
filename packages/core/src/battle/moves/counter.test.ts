import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { MockPokemon, buildMoveTestEngine } from "../../testing";

describe("counter", () => {
  it("reflects x2 damage back at adjacent Physical attacker", () => {
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      orientation: Direction.South,
      moveIds: ["counter"],
      currentPp: { counter: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 3 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([defender, attacker]);
    const attackerHpBefore = state.pokemon.get(attacker.id)?.currentHp ?? 0;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: defender.id,
      moveId: "counter",
      targetPosition: defender.position,
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: defender.id,
      direction: Direction.South,
    });

    const attackResult = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "scratch",
      targetPosition: { x: 2, y: 2 },
    });

    expect(attackResult.events.map((e) => e.type)).toContain(BattleEventType.DefenseTriggered);
    expect(state.pokemon.get(attacker.id)?.currentHp).toBeLessThan(attackerHpBefore);
  });

  it("does not reflect damage from a Special attack", () => {
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      orientation: Direction.South,
      moveIds: ["counter"],
      currentPp: { counter: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.charmander, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 3 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([defender, attacker]);
    const attackerHpBefore = state.pokemon.get(attacker.id)?.currentHp ?? 0;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: defender.id,
      moveId: "counter",
      targetPosition: defender.position,
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: defender.id,
      direction: Direction.South,
    });

    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "ember",
      targetPosition: { x: 2, y: 2 },
    });

    expect(state.pokemon.get(attacker.id)?.currentHp).toBe(attackerHpBefore);
  });

  it("does not reflect when Physical attacker is at distance > 1", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 3 },
      orientation: Direction.South,
      moveIds: ["counter"],
      currentPp: { counter: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      moveIds: ["rock-throw"],
      currentPp: { "rock-throw": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([defender, attacker]);
    const attackerHpBefore = state.pokemon.get(attacker.id)?.currentHp ?? 0;
    const defenderHpBefore = state.pokemon.get(defender.id)?.currentHp ?? 0;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: defender.id,
      moveId: "counter",
      targetPosition: defender.position,
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: defender.id,
      direction: Direction.South,
    });

    const attackResult = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "rock-throw",
      targetPosition: { x: 3, y: 3 },
    });

    expect(attackResult.events.map((e) => e.type)).not.toContain(BattleEventType.DefenseTriggered);
    expect(state.pokemon.get(defender.id)?.currentHp).toBeLessThan(defenderHpBefore);
    expect(state.pokemon.get(attacker.id)?.currentHp).toBe(attackerHpBefore);

    vi.restoreAllMocks();
  });
});
