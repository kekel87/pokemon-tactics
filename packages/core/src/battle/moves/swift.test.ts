import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("swift", () => {
  it("deals damage to target within blast radius 1", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["swift"],
      currentPp: { swift: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);
    const hpBefore = state.pokemon.get("target")?.currentHp ?? 0;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "swift",
      targetPosition: { x: 3, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get("target")?.currentHp).toBeLessThan(hpBefore);
  });

  it("hits multiple targets within blast radius", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["swift"],
      currentPp: { swift: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target1 = MockPokemon.fresh(MockPokemon.base, {
      id: "target1",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const target2 = MockPokemon.fresh(MockPokemon.base, {
      id: "target2",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 1 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 9 },
    });
    const { engine } = buildMoveTestEngine([caster, target1, target2]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "swift",
      targetPosition: { x: 3, y: 0 },
    });

    expect(result.success).toBe(true);
    const damageEvents = result.events.filter((e) => e.type === BattleEventType.DamageDealt);
    expect(damageEvents.length).toBeGreaterThanOrEqual(2);
  });

  it("does not hit target outside blast radius", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["swift"],
      currentPp: { swift: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const farTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "far-target",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 9 },
    });
    const hpBefore = farTarget.currentHp;
    const { engine, state } = buildMoveTestEngine([caster, target, farTarget]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "swift",
      targetPosition: { x: 3, y: 0 },
    });

    expect(state.pokemon.get("far-target")?.currentHp).toBe(hpBefore);
  });
});
