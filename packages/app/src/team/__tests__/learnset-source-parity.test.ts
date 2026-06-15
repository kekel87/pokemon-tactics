import { getLegalMoves, loadData } from "@pokemon-tactic/data";
import { beforeAll, describe, expect, it } from "vitest";
import { getLearnsetForPokemon } from "../team-builder-data";

describe("learnset source parity (sandbox vs team builder)", () => {
  beforeAll(() => {
    loadData();
  });

  const samplePokemon = ["pikachu", "eevee", "pidgey", "mew", "charizard", "venusaur"];

  for (const pokemonId of samplePokemon) {
    it(`returns identical move sets for ${pokemonId} via both paths`, () => {
      const directIds = Array.from(getLegalMoves(pokemonId)).sort();
      const validatorIds = Array.from(getLearnsetForPokemon(pokemonId)).sort();
      expect(validatorIds).toEqual(directIds);
    });
  }

  it("multi-word kebab IDs are present (regression: plan 089 normalization)", () => {
    const venusaurMoves = getLegalMoves("venusaur");
    expect(venusaurMoves.has("vine-whip")).toBe(true);
    expect(venusaurMoves.has("razor-leaf")).toBe(true);
    expect(venusaurMoves.has("leech-seed")).toBe(true);
  });
});
