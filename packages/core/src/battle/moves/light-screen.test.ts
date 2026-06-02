import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { AuraKind } from "../../enums/aura-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("light-screen", () => {
  it("posts a LightScreen aura and emits AuraPosted", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["light-screen"],
      currentPp: { "light-screen": 30 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });

    const { engine, state } = buildMoveTestEngine([user, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "light-screen",
      targetPosition: user.position,
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.AuraPosted)).toBe(true);
    expect(state.auras.some((a) => a.kind === AuraKind.LightScreen)).toBe(true);
  });

  it("aura is associated with the caster", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["light-screen"],
      currentPp: { "light-screen": 30 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });

    const { engine, state } = buildMoveTestEngine([user, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "light-screen",
      targetPosition: user.position,
    });

    const aura = state.auras.find((a) => a.kind === AuraKind.LightScreen);
    expect(aura?.casterPokemonId).toBe(user.id);
  });

  it("does not affect foe HP", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["light-screen"],
      currentPp: { "light-screen": 30 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      currentHp: 100,
      maxHp: 100,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });

    const { engine, state } = buildMoveTestEngine([user, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "light-screen",
      targetPosition: user.position,
    });

    expect(state.pokemon.get(foe.id)?.currentHp).toBe(100);
  });
});
