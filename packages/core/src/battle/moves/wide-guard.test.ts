import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockBattle, MockPokemon } from "../../testing";

describe("wide-guard", () => {
  it("blocks an AoE attack (Cone)", () => {
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 2 },
      orientation: Direction.South,
      moveIds: ["wide-guard"],
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.pidgey, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 5 },
      orientation: Direction.North,
      derivedStats: { movement: 4, jump: 2, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([defender, attacker]);
    const defenderHpBefore = state.pokemon.get(defender.id)?.currentHp ?? 0;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: defender.id,
      moveId: "wide-guard",
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
      moveId: "gust",
      targetPosition: { x: 3, y: 4 },
    });

    expect(attackResult.events.map((event) => event.type)).toContain(
      BattleEventType.DefenseTriggered,
    );
    expect(state.pokemon.get(defender.id)?.currentHp).toBe(defenderHpBefore);
  });

  it("does not block an AoE attack coming from behind the caster", () => {
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 2 },
      orientation: Direction.North,
      moveIds: ["wide-guard"],
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.pidgey, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 5 },
      orientation: Direction.North,
      derivedStats: { movement: 4, jump: 2, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([defender, attacker]);
    const defenderHpBefore = state.pokemon.get(defender.id)?.currentHp ?? 0;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: defender.id,
      moveId: "wide-guard",
      targetPosition: defender.position,
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: defender.id,
      direction: Direction.North,
    });

    const attackResult = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "gust",
      targetPosition: { x: 3, y: 4 },
    });

    expect(attackResult.events.map((event) => event.type)).not.toContain(
      BattleEventType.DefenseTriggered,
    );
    expect(state.pokemon.get(defender.id)?.currentHp).toBeLessThan(defenderHpBefore);
  });

  it("does not block a Single attack", () => {
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 3 },
      orientation: Direction.South,
      moveIds: ["wide-guard"],
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.charmander, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([defender, attacker]);
    const defenderHpBefore = state.pokemon.get(defender.id)?.currentHp ?? 0;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: defender.id,
      moveId: "wide-guard",
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
      targetPosition: { x: 3, y: 3 },
    });

    expect(attackResult.events.map((event) => event.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(defender.id)?.currentHp).toBeLessThan(defenderHpBefore);
  });

  it("also covers an ally within 2 tiles when hit from the front", () => {
    const guard = MockPokemon.fresh(MockPokemon.base, {
      id: "guard",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 2 },
      orientation: Direction.South,
      moveIds: ["wide-guard"],
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const nearAlly = MockPokemon.fresh(MockPokemon.base, {
      id: "near-ally",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 4 },
      orientation: Direction.South,
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.pidgey, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 7 },
      orientation: Direction.North,
      derivedStats: { movement: 4, jump: 2, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([guard, nearAlly, attacker]);
    const nearHpBefore = state.pokemon.get(nearAlly.id)?.currentHp ?? 0;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: guard.id,
      moveId: "wide-guard",
      targetPosition: guard.position,
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: guard.id,
      direction: Direction.South,
    });

    const nearResult = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "gust",
      targetPosition: { x: 3, y: 6 },
    });

    expect(nearResult.events.map((event) => event.type)).toContain(
      BattleEventType.DefenseTriggered,
    );
    expect(state.pokemon.get(nearAlly.id)?.currentHp).toBe(nearHpBefore);
  });

  it("does not cover an ally behind a wall", () => {
    const guard = MockPokemon.fresh(MockPokemon.base, {
      id: "guard",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 2 },
      orientation: Direction.South,
      moveIds: ["wide-guard"],
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const wallAlly = MockPokemon.fresh(MockPokemon.base, {
      id: "wall-ally",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 4 },
      orientation: Direction.South,
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.pidgey, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 7 },
      orientation: Direction.North,
      derivedStats: { movement: 4, jump: 2, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([guard, wallAlly, attacker]);
    MockBattle.setTile(state, 3, 3, { height: 4 });
    const allyHpBefore = state.pokemon.get(wallAlly.id)?.currentHp ?? 0;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: guard.id,
      moveId: "wide-guard",
      targetPosition: guard.position,
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: guard.id,
      direction: Direction.South,
    });

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "gust",
      targetPosition: { x: 3, y: 6 },
    });

    expect(result.events.map((event) => event.type)).not.toContain(
      BattleEventType.DefenseTriggered,
    );
    expect(state.pokemon.get(wallAlly.id)?.currentHp).toBeLessThan(allyHpBefore);
  });

  it("does not cover an ally hit from behind", () => {
    const guard = MockPokemon.fresh(MockPokemon.base, {
      id: "guard",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 2 },
      orientation: Direction.South,
      moveIds: ["wide-guard"],
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const nearAlly = MockPokemon.fresh(MockPokemon.base, {
      id: "near-ally",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 4 },
      orientation: Direction.North,
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.pidgey, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 7 },
      orientation: Direction.North,
      derivedStats: { movement: 4, jump: 2, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([guard, nearAlly, attacker]);
    const nearHpBefore = state.pokemon.get(nearAlly.id)?.currentHp ?? 0;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: guard.id,
      moveId: "wide-guard",
      targetPosition: guard.position,
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: guard.id,
      direction: Direction.South,
    });

    const nearResult = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "gust",
      targetPosition: { x: 3, y: 6 },
    });

    expect(nearResult.events.map((event) => event.type)).not.toContain(
      BattleEventType.DefenseTriggered,
    );
    expect(state.pokemon.get(nearAlly.id)?.currentHp).toBeLessThan(nearHpBefore);
  });
});
