import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("soft-boiled", () => {
  it("heals 50% of maxHp on self", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["soft-boiled"],
      currentPp: { "soft-boiled": 10 },
      currentHp: 50,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "soft-boiled",
      targetPosition: { x: 0, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.HpRestored);
    expect(state.pokemon.get(user.id)?.currentHp).toBe(150);
  });

  it("does not heal above maxHp", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["soft-boiled"],
      currentPp: { "soft-boiled": 10 },
      currentHp: 190,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "soft-boiled",
      targetPosition: { x: 0, y: 0 },
    });

    expect(state.pokemon.get(user.id)?.currentHp).toBe(200);
  });

  it("emits no HpRestored when already at full HP", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["soft-boiled"],
      currentPp: { "soft-boiled": 10 },
      currentHp: 200,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([user, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "soft-boiled",
      targetPosition: { x: 0, y: 0 },
    });

    expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.HpRestored);
  });

  it("does not affect the foe", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["soft-boiled"],
      currentPp: { "soft-boiled": 10 },
      currentHp: 50,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe]);
    const foeHpBefore = state.pokemon.get(foe.id)?.currentHp;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "soft-boiled",
      targetPosition: { x: 0, y: 0 },
    });

    expect(state.pokemon.get(foe.id)?.currentHp).toBe(foeHpBefore);
  });
});
