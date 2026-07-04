import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("sheer-cold", () => {
  it("one-hit KOs a non-Ice target in the cone (Cône 1-2) on hit", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      definitionId: "lapras",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 2 },
      moveIds: ["sheer-cold"],
      currentPp: { "sheer-cold": 5 },
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
      moveId: "sheer-cold",
      targetPosition: { x: 2, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get("foe")?.currentHp).toBe(0);
    vi.restoreAllMocks();
  });
});
