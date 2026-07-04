import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("horn-drill", () => {
  it("one-hit KOs targets along the piercing line (length 2) on hit", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      definitionId: "rhydon",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 2 },
      moveIds: ["horn-drill"],
      currentPp: { "horn-drill": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const near = MockPokemon.fresh(MockPokemon.base, {
      id: "near",
      definitionId: "machop",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      currentHp: 200,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const far = MockPokemon.fresh(MockPokemon.base, {
      id: "far",
      definitionId: "machop",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      currentHp: 200,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const { engine, state } = buildMoveTestEngine([user, near, far]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "user",
      moveId: "horn-drill",
      targetPosition: { x: 3, y: 2 },
    });

    expect(state.pokemon.get("near")?.currentHp).toBe(0);
    expect(state.pokemon.get("far")?.currentHp).toBe(0);
    vi.restoreAllMocks();
  });
});
