import { typeChart } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { PokemonType } from "../../enums/pokemon-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import { getTypeEffectiveness } from "../damage-calculator";

describe("conversion-2", () => {
  it("becomes a type that resists the target's last-used move", () => {
    const user = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["conversion-2"],
    });
    const foe = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      lastUsedMoveId: "thunderbolt",
    });
    const { engine, state } = buildMoveTestEngine([user, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "conversion-2",
      targetPosition: foe.position,
    });

    const chosen = state.pokemon.get(user.id)?.typeOverride;
    expect(chosen).toHaveLength(1);
    expect(getTypeEffectiveness(PokemonType.Electric, chosen ?? [], typeChart)).toBeLessThan(1);
  });
});
