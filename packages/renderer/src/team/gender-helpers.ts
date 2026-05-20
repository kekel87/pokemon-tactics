import { type GenderRatio, PokemonGender } from "@pokemon-tactic/core";
import { getPlayablePokemonById } from "./team-builder-data";

export function pickDefaultGender(
  ratio: GenderRatio,
  rng: () => number = Math.random,
): PokemonGender | undefined {
  if (ratio === "genderless") {
    return undefined;
  }
  if (ratio.male === 0 && ratio.female === 0) {
    return undefined;
  }
  if (ratio.male > ratio.female) {
    return PokemonGender.Male;
  }
  if (ratio.female > ratio.male) {
    return PokemonGender.Female;
  }
  return rng() < 0.5 ? PokemonGender.Male : PokemonGender.Female;
}

export function resolveSlotGender(
  pokemonId: string,
  current: PokemonGender | undefined,
  rng?: () => number,
): PokemonGender | undefined {
  if (current !== undefined) {
    return current;
  }
  const pokemon = getPlayablePokemonById(pokemonId);
  return pokemon === null ? undefined : pickDefaultGender(pokemon.definition.genderRatio, rng);
}

export function toggleGender(current: PokemonGender): PokemonGender {
  return current === PokemonGender.Male ? PokemonGender.Female : PokemonGender.Male;
}
