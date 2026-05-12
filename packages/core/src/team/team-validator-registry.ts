import type { HeldItemId } from "../enums/held-item-id";
import type { PokemonGender } from "../enums/pokemon-gender";

export interface TeamValidatorRegistry {
  pokemonIds: ReadonlySet<string>;
  moveIds: ReadonlySet<string>;
  abilityIds: ReadonlySet<string>;
  itemIds: ReadonlySet<HeldItemId>;
  getLegalAbilities(pokemonId: string): readonly string[];
  getLegalMoves(pokemonId: string): ReadonlySet<string>;
  getSpeciesRoot(pokemonId: string): string;
  getGenderConstraint(pokemonId: string): GenderConstraint;
}

export const GenderConstraint = {
  Any: "any",
  MaleOnly: "male-only",
  FemaleOnly: "female-only",
  Genderless: "genderless",
} as const;

export type GenderConstraint = (typeof GenderConstraint)[keyof typeof GenderConstraint];

export function isGenderAllowed(
  gender: PokemonGender | undefined,
  constraint: GenderConstraint,
): boolean {
  if (gender === undefined) {
    return true;
  }
  switch (constraint) {
    case GenderConstraint.Any:
      return gender !== "genderless";
    case GenderConstraint.MaleOnly:
      return gender === "male";
    case GenderConstraint.FemaleOnly:
      return gender === "female";
    case GenderConstraint.Genderless:
      return gender === "genderless";
  }
}
