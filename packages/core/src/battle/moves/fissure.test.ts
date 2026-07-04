import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("fissure", () => {
  it("one-hit KOs every target along the straight line (length 3) on hit", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      definitionId: "dugtrio",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 2 },
      moveIds: ["fissure"],
      currentPp: { fissure: 5 },
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
      moveId: "fissure",
      targetPosition: { x: 3, y: 2 },
    });

    expect(state.pokemon.get("near")?.currentHp).toBe(0);
    expect(state.pokemon.get("far")?.currentHp).toBe(0);
    vi.restoreAllMocks();
  });
});
