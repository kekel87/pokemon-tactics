import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("dragon-tail", () => {
  it("deals damage and knocks back target with slash pattern", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      orientation: Direction.East,
      moveIds: ["dragon-tail"],
      currentPp: { "dragon-tail": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);
    const hpBefore = state.pokemon.get(defender.id)!.currentHp;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "dragon-tail",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.KnockbackApplied);
    expect(state.pokemon.get(defender.id)!.currentHp).toBeLessThan(hpBefore);
    expect(state.pokemon.get(defender.id)!.position).toEqual({ x: 4, y: 2 });
    vi.restoreAllMocks();
  });

  it("hits all 3 slash tiles", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      orientation: Direction.East,
      moveIds: ["dragon-tail"],
      currentPp: { "dragon-tail": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const front = MockPokemon.fresh(MockPokemon.base, {
      id: "front",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const diag1 = MockPokemon.fresh(MockPokemon.base, {
      id: "diag1",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 1 },
      derivedStats: { movement: 3, jump: 1, initiative: 9 },
    });
    const diag2 = MockPokemon.fresh(MockPokemon.base, {
      id: "diag2",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 3 },
      derivedStats: { movement: 3, jump: 1, initiative: 8 },
    });
    const { engine } = buildMoveTestEngine([attacker, front, diag1, diag2]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "dragon-tail",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    const damageEvents = result.events.filter((e) => e.type === BattleEventType.DamageDealt);
    expect(damageEvents).toHaveLength(3);
    vi.restoreAllMocks();
  });
});
