import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("burn-up", () => {
  it("deals damage then strips the caster's Fire type (typeless when mono-Fire)", () => {
    const user = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["burn-up"],
    });
    const foe = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "burn-up",
      targetPosition: foe.position,
    });

    expect(state.pokemon.get(user.id)?.typeOverride).toEqual([]);
    expect(state.pokemon.get(foe.id)?.currentHp).toBeLessThan(foe.maxHp);
  });
});
