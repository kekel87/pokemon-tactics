import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("razor-wind", () => {
  it("T1 charge locks caster on razor-wind without dealing damage", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 0 },
      moveIds: ["razor-wind"],
      currentPp: { "razor-wind": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 3 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "razor-wind",
      targetPosition: { x: 2, y: 3 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.MoveCharging);
    const casterState = state.pokemon.get(attacker.id);
    expect(casterState?.chargingMove?.moveId).toBe("razor-wind");
    expect(casterState?.lockedMoveId).toBe("razor-wind");
    expect(state.pokemon.get(defender.id)?.currentHp).toBe(MockPokemon.charmander.currentHp);
  });

  it("T2 fires Cone r3 damage on enemies in cone pattern", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 0 },
      moveIds: ["razor-wind"],
      currentPp: { "razor-wind": 9 },
      chargingMove: { moveId: "razor-wind", targetPosition: { x: 2, y: 0 } },
      lockedMoveId: "razor-wind",
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 3 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "razor-wind",
      targetPosition: { x: 2, y: 3 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    const defenderAfter = state.pokemon.get(defender.id);
    expect(defenderAfter?.currentHp).toBeLessThan(MockPokemon.charmander.currentHp);
    const casterAfter = state.pokemon.get(attacker.id);
    expect(casterAfter?.chargingMove).toBeUndefined();
  });
});
