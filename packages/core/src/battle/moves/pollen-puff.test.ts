import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import type { BattleEvent } from "../../types/battle-event";

function damageTo(events: BattleEvent[], targetId: string): number {
  return events
    .filter(
      (e): e is Extract<BattleEvent, { type: typeof BattleEventType.DamageDealt }> =>
        e.type === BattleEventType.DamageDealt,
    )
    .filter((e) => e.targetId === targetId)
    .reduce((sum, e) => sum + e.amount, 0);
}

describe("pollen-puff", () => {
  it("deals damage to an enemy target and does not heal them", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["pollen-puff"],
      currentPp: { "pollen-puff": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      currentHp: 300,
      maxHp: 300,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, foe]);
    const foHpBefore = state.pokemon.get(foe.id)?.currentHp ?? 0;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "pollen-puff",
      targetPosition: { x: 2, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(damageTo(result.events, foe.id)).toBeGreaterThan(0);
    expect(state.pokemon.get(foe.id)?.currentHp).toBeLessThan(foHpBefore);
    expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.HpRestored);
  });

  it("heals an ally target and does not deal damage", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["pollen-puff"],
      currentPp: { "pollen-puff": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 0 },
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
    const { engine, state } = buildMoveTestEngine([caster, ally, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "pollen-puff",
      targetPosition: { x: 2, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(damageTo(result.events, ally.id)).toBe(0);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.HpRestored);
    // floor(200 * 0.5) = 100; 50 + 100 = 150
    expect(state.pokemon.get(ally.id)?.currentHp).toBe(150);
  });

  it("ally branch heal does not overshoot maxHp", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["pollen-puff"],
      currentPp: { "pollen-puff": 15 },
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
      moveId: "pollen-puff",
      targetPosition: { x: 2, y: 0 },
    });

    expect(state.pokemon.get(ally.id)?.currentHp).toBe(200);
  });
});
