import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockBattle, MockPokemon } from "../../testing";

describe("magnitude", () => {
  it("hits two targets within radius 2", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 3 },
      moveIds: ["magnitude"],
      currentPp: { magnitude: 30 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target1 = MockPokemon.fresh(MockPokemon.base, {
      id: "target-1",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 3 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const target2 = MockPokemon.fresh(MockPokemon.base, {
      id: "target-2",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const hpBefore1 = target1.currentHp;
    const hpBefore2 = target2.currentHp;
    const { engine, state } = buildMoveTestEngine([caster, target1, target2]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "magnitude",
      targetPosition: caster.position,
    });

    expect(result.success).toBe(true);
    const damageEvents = result.events.filter((e) => e.type === BattleEventType.DamageDealt);
    expect(damageEvents.length).toBeGreaterThanOrEqual(2);
    expect(state.pokemon.get(target1.id)?.currentHp).toBeLessThan(hpBefore1);
    expect(state.pokemon.get(target2.id)?.currentHp).toBeLessThan(hpBefore2);
  });

  it("does not hit target at distance 3", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["magnitude"],
      currentPp: { magnitude: 30 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const farTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "far-target",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const hpBefore = farTarget.currentHp;
    const { engine, state } = buildMoveTestEngine([caster, farTarget]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "magnitude",
      targetPosition: caster.position,
    });

    expect(state.pokemon.get(farTarget.id)?.currentHp).toBe(hpBefore);
  });

  it("ignores a pillar (height 2) because it is a ground-type zone move", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["magnitude"],
      currentPp: { magnitude: 30 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foeBehindPillar = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-behind",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });

    const { engine, state } = buildMoveTestEngine([caster, foeBehindPillar], 6);
    MockBattle.setTile(state, 3, 2, { height: 2 });
    const hpBefore = state.pokemon.get(foeBehindPillar.id)?.currentHp ?? 0;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "magnitude",
      targetPosition: caster.position,
    });

    expect(state.pokemon.get(foeBehindPillar.id)?.currentHp).toBeLessThan(hpBefore);
  });
});
