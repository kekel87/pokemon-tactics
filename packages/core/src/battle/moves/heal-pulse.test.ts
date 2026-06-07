import { describe, expect, it } from "vitest";
import { ActionError } from "../../enums/action-error";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("heal-pulse", () => {
  it("heals an ally in range for 50% of their maxHp", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["heal-pulse"],
      currentPp: { "heal-pulse": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 0 },
      currentHp: 60,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, ally, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "heal-pulse",
      targetPosition: { x: 2, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.HpRestored);
    // floor(200 * 0.5) = 100, but only missing 140, so heals 100
    expect(state.pokemon.get(ally.id)?.currentHp).toBe(160);
  });

  it("can also heal a foe if targeted (intended risk)", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["heal-pulse"],
      currentPp: { "heal-pulse": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      currentHp: 50,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "heal-pulse",
      targetPosition: { x: 2, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.HpRestored);
    expect(state.pokemon.get(foe.id)?.currentHp).toBe(150);
  });

  it("does not heal beyond maxHp", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["heal-pulse"],
      currentPp: { "heal-pulse": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 0 },
      currentHp: 190,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, ally, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "heal-pulse",
      targetPosition: { x: 2, y: 0 },
    });

    expect(state.pokemon.get(ally.id)?.currentHp).toBe(200);
  });

  it("cannot reach a target beyond range 4", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["heal-pulse"],
      currentPp: { "heal-pulse": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([caster, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "heal-pulse",
      targetPosition: { x: 5, y: 0 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.InvalidTarget);
  });
});
