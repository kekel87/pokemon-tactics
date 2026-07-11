import { describe, expect, it } from "vitest";
import { PokemonType } from "../enums/pokemon-type";
import { MockMove, MockPokemon } from "../testing";
import { isImmuneToPowderMove } from "./powder-immunity";

const powderMove = MockMove.fresh(MockMove.status, { flags: { powder: true } });
const nonPowderMove = MockMove.fresh(MockMove.status, { flags: { powder: false } });

describe("isImmuneToPowderMove", () => {
  it("returns false for a non-powder move regardless of type", () => {
    const target = MockPokemon.fresh(MockPokemon.base);
    expect(
      isImmuneToPowderMove(
        target,
        nonPowderMove,
        [PokemonType.Grass],
        MockPokemon.fresh(MockPokemon.base),
        undefined,
        undefined,
      ),
    ).toBe(false);
  });

  it("returns true for a powder move against a Grass-type target", () => {
    const target = MockPokemon.fresh(MockPokemon.base);
    expect(
      isImmuneToPowderMove(
        target,
        powderMove,
        [PokemonType.Grass, PokemonType.Poison],
        MockPokemon.fresh(MockPokemon.base),
        undefined,
        undefined,
      ),
    ).toBe(true);
  });

  it("returns false for a powder move against a non-immune target", () => {
    const target = MockPokemon.fresh(MockPokemon.base);
    expect(
      isImmuneToPowderMove(
        target,
        powderMove,
        [PokemonType.Fire],
        MockPokemon.fresh(MockPokemon.base),
        undefined,
        undefined,
      ),
    ).toBe(false);
  });
});
