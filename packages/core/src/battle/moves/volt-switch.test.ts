import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import { createPrng } from "../../utils/prng";

describe("volt-switch", () => {
  it("deals damage and retreats to a valid position", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["volt-switch"],
      currentPp: { "volt-switch": 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, foe], {
      gridSize: 8,
      random: createPrng(0),
    });
    const hpBefore = state.pokemon.get(foe.id)?.currentHp ?? 0;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "volt-switch",
      targetPosition: { x: 3, y: 2 },
      retreatPosition: { x: 0, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(foe.id)?.currentHp).toBeLessThan(hpBefore);
    expect(state.pokemon.get(caster.id)?.position).toEqual({ x: 0, y: 2 });
  });

  it("can hit a target at range 2", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["volt-switch"],
      currentPp: { "volt-switch": 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, foe], {
      gridSize: 8,
      random: createPrng(0),
    });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "volt-switch",
      targetPosition: { x: 4, y: 2 },
      retreatPosition: { x: 0, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get(foe.id)?.currentHp).toBeLessThan(foe.maxHp);
    expect(state.pokemon.get(caster.id)?.position).toEqual({ x: 0, y: 2 });
  });

  it("stays in place when retreat position is missing", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["volt-switch"],
      currentPp: { "volt-switch": 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, foe], {
      gridSize: 8,
      random: createPrng(0),
    });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "volt-switch",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    const fallback = result.events.find((e) => e.type === BattleEventType.HitAndRunRetreatFallback);
    expect(fallback).toBeDefined();
    expect(state.pokemon.get(caster.id)?.position).toEqual({ x: 2, y: 2 });
  });
});
