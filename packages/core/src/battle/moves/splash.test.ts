import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("splash", () => {
  it("succeeds with no game-state changes", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["splash"],
      currentPp: { splash: 40 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const dummy = MockPokemon.fresh(MockPokemon.base, {
      id: "dummy",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, dummy]);
    const hpBefore = state.pokemon.get(dummy.id)?.currentHp;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "splash",
      targetPosition: { x: 0, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get(dummy.id)?.currentHp).toBe(hpBefore);
    expect(state.pokemon.get(user.id)?.currentHp).toBe(MockPokemon.base.currentHp);
  });
});
