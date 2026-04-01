import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { MockPokemon, buildMoveTestEngine } from "../../testing";

describe("wide-guard", () => {
  it("blocks an AoE attack (Cone)", () => {
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 2 },
      orientation: Direction.South,
      moveIds: ["wide-guard"],
      currentPp: { "wide-guard": 10 },
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

    expect(attackResult.events.map((e) => e.type)).toContain(BattleEventType.DefenseTriggered);
    expect(state.pokemon.get(defender.id)?.currentHp).toBe(defenderHpBefore);
  });

  it("does not block a Single attack", () => {
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 3 },
      orientation: Direction.South,
      moveIds: ["wide-guard"],
      currentPp: { "wide-guard": 10 },
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

    expect(attackResult.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(defender.id)?.currentHp).toBeLessThan(defenderHpBefore);
  });
});
