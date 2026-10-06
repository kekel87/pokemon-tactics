import { describe, expect, it } from "vitest";
import { isFinalEvolutionStage } from "./final-evolution-stage";

describe("isFinalEvolutionStage", () => {
  it.each([
    ["Florizarre", "venusaur", true],
    ["Bulbizarre", "bulbasaur", false],
    ["Herbizarre", "ivysaur", false],
    ["Métamorph, without evolution", "ditto", true],
    ["Mewtwo, a legendary without evolution", "mewtwo", true],
  ])("%s → %s", (_label, pokemonId, expected) => {
    expect(isFinalEvolutionStage(pokemonId)).toBe(expected);
  });
});
