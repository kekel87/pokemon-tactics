import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("healing-wish", () => {
  it("revives a KO'd ally to 50% HP, clears status, and KOs the caster", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["healing-wish"],
      currentPp: { "healing-wish": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 2 },
      currentHp: 0,
      maxHp: 200,
      statusEffects: [{ type: StatusType.Burned, remainingTurns: null }],
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 1 },
    });
    const { engine, state } = buildMoveTestEngine([caster, ally, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "user",
      moveId: "healing-wish",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get("ally")?.currentHp).toBe(100);
    expect(state.pokemon.get("ally")?.statusEffects).toEqual([]);
    expect(state.pokemon.get("user")?.currentHp).toBe(0);
    expect(result.events.some((e) => e.type === BattleEventType.PokemonRevived)).toBe(true);
  });

  it("fully heals a living ally to 100% and KOs the caster", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["healing-wish"],
      currentPp: { "healing-wish": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 2 },
      currentHp: 40,
      maxHp: 200,
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 1 },
    });
    const { engine, state } = buildMoveTestEngine([caster, ally, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "user",
      moveId: "healing-wish",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get("ally")?.currentHp).toBe(200);
    expect(state.pokemon.get("user")?.currentHp).toBe(0);
  });

  it("whiffs on an empty tile but the caster still faints", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["healing-wish"],
      currentPp: { "healing-wish": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 1 },
    });
    const { engine, state } = buildMoveTestEngine([caster, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "user",
      moveId: "healing-wish",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.ReviveOrHealFailed)).toBe(true);
    expect(state.pokemon.get("user")?.currentHp).toBe(0);
  });
});
