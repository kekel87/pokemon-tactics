import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("whirlwind", () => {
  it("ejects an adjacent enemy back to its spawn zone without dealing damage", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["whirlwind"],
      currentPp: { whirlwind: 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      spawnPosition: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);
    const hpBefore = state.pokemon.get(defender.id)?.currentHp;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "whirlwind",
      targetPosition: attacker.position,
    });

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.Teleported);
    expect(result.events.map((event) => event.type)).not.toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(defender.id)?.position).toEqual({ x: 5, y: 5 });
    expect(state.pokemon.get(defender.id)?.currentHp).toBe(hpBefore);
    vi.restoreAllMocks();
  });

  it("does not phaze an enemy outside the radius-1 zone", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["whirlwind"],
      currentPp: { whirlwind: 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      spawnPosition: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "whirlwind",
      targetPosition: attacker.position,
    });

    expect(result.events.map((event) => event.type)).not.toContain(BattleEventType.Teleported);
    expect(state.pokemon.get(defender.id)?.position).toEqual({ x: 4, y: 4 });
    vi.restoreAllMocks();
  });
});
