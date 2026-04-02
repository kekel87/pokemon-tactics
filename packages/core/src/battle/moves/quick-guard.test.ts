import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("quick-guard", () => {
  it("blocks one attack from any direction", () => {
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 3 },
      orientation: Direction.North,
      moveIds: ["quick-guard"],
      currentPp: { "quick-guard": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 4 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([defender, attacker]);
    const defenderHpBefore = state.pokemon.get(defender.id)?.currentHp ?? 0;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: defender.id,
      moveId: "quick-guard",
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
      moveId: "scratch",
      targetPosition: { x: 3, y: 3 },
    });

    expect(attackResult.events.map((e) => e.type)).toContain(BattleEventType.DefenseTriggered);
    expect(attackResult.events.map((e) => e.type)).not.toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(defender.id)?.currentHp).toBe(defenderHpBefore);
  });

  it("consumes the defense after blocking one attack", () => {
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 3 },
      orientation: Direction.North,
      moveIds: ["quick-guard"],
      currentPp: { "quick-guard": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 4 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([defender, attacker]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: defender.id,
      moveId: "quick-guard",
      targetPosition: defender.position,
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: defender.id,
      direction: Direction.North,
    });

    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "scratch",
      targetPosition: { x: 3, y: 3 },
    });

    expect(state.pokemon.get(defender.id)?.activeDefense).toBeNull();
  });

  it("second attack goes through after Quick Guard is consumed", () => {
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 3 },
      orientation: Direction.North,
      moveIds: ["quick-guard"],
      currentPp: { "quick-guard": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const attacker1 = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker-1",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 4 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    const attacker2 = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker-2",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([defender, attacker1, attacker2]);
    const defenderHpBefore = state.pokemon.get(defender.id)?.currentHp ?? 0;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: defender.id,
      moveId: "quick-guard",
      targetPosition: defender.position,
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: defender.id,
      direction: Direction.North,
    });

    const blockedResult = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: attacker1.id,
      moveId: "scratch",
      targetPosition: { x: 3, y: 3 },
    });
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: attacker1.id,
      direction: Direction.North,
    });

    const hitResult = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: attacker2.id,
      moveId: "scratch",
      targetPosition: { x: 3, y: 3 },
    });

    expect(blockedResult.events.map((e) => e.type)).toContain(BattleEventType.DefenseTriggered);
    expect(blockedResult.events.map((e) => e.type)).not.toContain(BattleEventType.DamageDealt);
    expect(hitResult.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(defender.id)?.currentHp).toBeLessThan(defenderHpBefore);
  });
});
