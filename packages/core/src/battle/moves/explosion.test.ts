import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("explosion", () => {
  it("damages targets in the zone and KOs the user (self-KO AoE)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["explosion"],
      currentPp: { explosion: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      definitionId: "pidgey",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe]);
    const foeHpBefore = state.pokemon.get("foe")?.currentHp ?? 0;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "user",
      moveId: "explosion",
      targetPosition: { x: 2, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get("foe")?.currentHp).toBeLessThan(foeHpBefore);
    expect(state.pokemon.get("user")?.currentHp).toBe(0);
    vi.restoreAllMocks();
  });
});
