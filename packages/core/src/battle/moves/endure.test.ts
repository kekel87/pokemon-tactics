import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { MockPokemon, buildMoveTestEngine } from "../../testing";

describe("endure", () => {
  it("survives a fatal blow at 1 HP", () => {
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      currentHp: 5,
      maxHp: 100,
      orientation: Direction.South,
      moveIds: ["endure"],
      currentPp: { endure: 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 3 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      combatStats: {
        hp: 100,
        attack: 200,
        defense: 55,
        spAttack: 55,
        spDefense: 55,
        speed: 55,
      },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([defender, attacker]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: defender.id,
      moveId: "endure",
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
    expect(state.pokemon.get(defender.id)?.currentHp).toBe(1);
  });

  it("cannot activate Endure on consecutive rounds (spam check)", () => {
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      currentHp: 5,
      maxHp: 100,
      lastEndureRound: 0,
      orientation: Direction.South,
      moveIds: ["endure"],
      currentPp: { endure: 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 3 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      combatStats: {
        hp: 100,
        attack: 200,
        defense: 55,
        spAttack: 55,
        spDefense: 55,
        speed: 55,
      },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([defender, attacker]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: defender.id,
      moveId: "endure",
      targetPosition: defender.position,
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: defender.id,
      direction: Direction.South,
    });

    expect(state.pokemon.get(defender.id)?.activeDefense).toBeNull();
  });

  it("does not trigger when the blow is not fatal", () => {
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      currentHp: 100,
      maxHp: 100,
      orientation: Direction.South,
      moveIds: ["endure"],
      currentPp: { endure: 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 3 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      combatStats: {
        hp: 100,
        attack: 55,
        defense: 55,
        spAttack: 55,
        spDefense: 55,
        speed: 55,
      },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([defender, attacker]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: defender.id,
      moveId: "endure",
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

    const defenderHp = state.pokemon.get(defender.id)?.currentHp ?? 0;

    expect(attackResult.events.map((e) => e.type)).not.toContain(BattleEventType.DefenseTriggered);
    expect(defenderHp).toBeLessThan(100);
    expect(defenderHp).toBeGreaterThan(1);
  });
});
