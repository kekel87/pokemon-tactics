import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { PokemonType } from "../../enums/pokemon-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("conversion", () => {
  it("sets the caster's type to its first move's type", () => {
    const user = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["thunderbolt", "conversion"],
    });
    const foe = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "conversion",
      targetPosition: user.position,
    });

    expect(state.pokemon.get(user.id)?.typeOverride).toEqual([PokemonType.Electric]);
  });
});
