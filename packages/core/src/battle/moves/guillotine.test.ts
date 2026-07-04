import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("guillotine", () => {
  it("one-hit KOs an adjacent target (Single 1-1) on hit", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      definitionId: "krabby",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 2 },
      moveIds: ["guillotine"],
      currentPp: { guillotine: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      definitionId: "machop",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      currentHp: 250,
      maxHp: 250,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "user",
      moveId: "guillotine",
      targetPosition: { x: 2, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get("foe")?.currentHp).toBe(0);
    vi.restoreAllMocks();
  });
});
