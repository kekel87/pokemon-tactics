import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("life-dew", () => {
  it("heals all allies within Manhattan radius 2 of the caster for 25% of their maxHp", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["life-dew"],
      currentPp: { "life-dew": 10 },
      currentHp: 60,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const allyNear = MockPokemon.fresh(MockPokemon.base, {
      id: "ally-near",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 2 },
      currentHp: 50,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 0, y: 0 },
      currentHp: 50,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, allyNear, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "life-dew",
      targetPosition: { x: 2, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.HpRestored);
    // Caster healed: floor(200 * 0.25) = 50
    expect(state.pokemon.get(caster.id)?.currentHp).toBe(110);
    // Near ally healed: floor(200 * 0.25) = 50
    expect(state.pokemon.get(allyNear.id)?.currentHp).toBe(100);
  });

  it("does not heal allies outside the radius 2", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["life-dew"],
      currentPp: { "life-dew": 10 },
      currentHp: 50,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const allyFar = MockPokemon.fresh(MockPokemon.base, {
      id: "ally-far",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 0 },
      currentHp: 50,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, allyFar, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "life-dew",
      targetPosition: { x: 0, y: 0 },
    });

    // allyFar at distance 3 is outside radius 2 — not healed
    expect(state.pokemon.get(allyFar.id)?.currentHp).toBe(50);
  });

  it("does not heal foes even if within radius 2", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["life-dew"],
      currentPp: { "life-dew": 10 },
      currentHp: 100,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foeNear = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-near",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 3 },
      currentHp: 50,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, foeNear]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "life-dew",
      targetPosition: { x: 2, y: 2 },
    });

    expect(state.pokemon.get(foeNear.id)?.currentHp).toBe(50);
  });
});
