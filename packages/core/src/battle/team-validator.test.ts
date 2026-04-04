import { describe, expect, it } from "vitest";
import { TeamValidationError } from "../enums/team-validation-error";
import { MockTeamSelection } from "../testing/mock-team-selection";
import { validateTeamSelection } from "./team-validator";

const ALL_IDS = ["bulbasaur", "charmander", "squirtle", "pikachu", "machop", "abra"];

describe("validateTeamSelection", () => {
  it("accepts a valid team of 6 distinct Pokemon", () => {
    const result = validateTeamSelection(
      { ...MockTeamSelection.base, pokemonDefinitionIds: ALL_IDS },
      ALL_IDS,
      6,
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts a team with fewer than max size", () => {
    const result = validateTeamSelection(
      { ...MockTeamSelection.base, pokemonDefinitionIds: ["bulbasaur", "charmander", "squirtle"] },
      ALL_IDS,
      6,
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects an empty team", () => {
    const result = validateTeamSelection(
      { ...MockTeamSelection.base, pokemonDefinitionIds: [] },
      ALL_IDS,
      6,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([TeamValidationError.EmptyTeam]);
  });

  it("rejects a team with duplicates", () => {
    const result = validateTeamSelection(
      { ...MockTeamSelection.base, pokemonDefinitionIds: ["bulbasaur", "charmander", "bulbasaur"] },
      ALL_IDS,
      6,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([TeamValidationError.DuplicatePokemon]);
  });

  it("rejects a team exceeding max size", () => {
    const result = validateTeamSelection(
      {
        ...MockTeamSelection.base,
        pokemonDefinitionIds: [
          "bulbasaur",
          "charmander",
          "squirtle",
          "pikachu",
          "machop",
          "abra",
          "extra",
        ],
      },
      [...ALL_IDS, "extra"],
      6,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([TeamValidationError.ExceedsMaxSize]);
  });

  it("rejects unknown Pokemon ids", () => {
    const result = validateTeamSelection(
      { ...MockTeamSelection.base, pokemonDefinitionIds: ["bulbasaur", "mewtwo"] },
      ALL_IDS,
      6,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([TeamValidationError.UnknownPokemon]);
  });

  it("reports multiple distinct errors at once", () => {
    const result = validateTeamSelection(
      { ...MockTeamSelection.base, pokemonDefinitionIds: ["bulbasaur", "bulbasaur", "mewtwo"] },
      ALL_IDS,
      6,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      TeamValidationError.DuplicatePokemon,
      TeamValidationError.UnknownPokemon,
    ]);
  });
});
