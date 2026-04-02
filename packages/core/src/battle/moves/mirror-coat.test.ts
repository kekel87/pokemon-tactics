import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("mirror-coat", () => {
  it("reflects x2 damage back at Special attacker", () => {
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      orientation: Direction.South,
      moveIds: ["mirror-coat"],
      currentPp: { "mirror-coat": 20 },
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
      moveId: "mirror-coat",
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
      moveId: "ember",
      targetPosition: { x: 2, y: 2 },
    });

    expect(attackResult.events.map((e) => e.type)).toContain(BattleEventType.DefenseTriggered);
    expect(state.pokemon.get(attacker.id)?.currentHp).toBeLessThan(attackerHpBefore);
  });

  it("does not reflect damage from a Physical attack", () => {
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      orientation: Direction.South,
      moveIds: ["mirror-coat"],
      currentPp: { "mirror-coat": 20 },
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
      moveId: "mirror-coat",
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
      moveId: "scratch",
      targetPosition: { x: 2, y: 2 },
    });

    expect(state.pokemon.get(attacker.id)?.currentHp).toBe(attackerHpBefore);
  });
});
