import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("rock-smash", () => {
  it("deals damage to target in cardinal cross (adjacent)", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["rock-smash"],
      currentPp: { "rock-smash": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target-1",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const hpBefore = target.currentHp;
    const { engine, state } = buildMoveTestEngine([caster, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "rock-smash",
      targetPosition: caster.position,
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(target.id)?.currentHp).toBeLessThan(hpBefore);
  });

  it("reduces Defense of target in cross", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["rock-smash"],
      currentPp: { "rock-smash": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target-1",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "rock-smash",
      targetPosition: caster.position,
    });

    expect(state.pokemon.get(target.id)?.statStages[StatName.Defense]).toBe(-1);
  });

  it("does not hit target on diagonal", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["rock-smash"],
      currentPp: { "rock-smash": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const diagonalTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "diagonal-target",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 3 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const hpBefore = diagonalTarget.currentHp;
    const { engine, state } = buildMoveTestEngine([caster, diagonalTarget]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "rock-smash",
      targetPosition: caster.position,
    });

    expect(state.pokemon.get(diagonalTarget.id)?.currentHp).toBe(hpBefore);
  });
});
