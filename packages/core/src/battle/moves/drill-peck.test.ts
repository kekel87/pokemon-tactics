import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("drill-peck", () => {
  it("deals damage to target in slash pattern", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["drill-peck"],
      currentPp: { "drill-peck": 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const hpBefore = defender.currentHp;
    const { engine, state } = buildMoveTestEngine([attacker, defender]);

    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "drill-peck",
      targetPosition: { x: 1, y: 0 },
    });

    vi.restoreAllMocks();

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(defender.id)?.currentHp).toBeLessThan(hpBefore);
  });

  it("does not apply any status", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["drill-peck"],
      currentPp: { "drill-peck": 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);

    vi.spyOn(Math, "random").mockReturnValue(0);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "drill-peck",
      targetPosition: { x: 1, y: 0 },
    });

    vi.restoreAllMocks();

    expect(state.pokemon.get(defender.id)?.statusEffects).toHaveLength(0);
  });
});
