import { PokemonGender } from "../enums/pokemon-gender";
import type { GenderRatio } from "../types/gender-ratio";

export function rollGender(ratio: GenderRatio, rng: () => number): PokemonGender {
  if (ratio === "genderless") {
    return PokemonGender.Genderless;
  }
  return rng() * 100 < ratio.male ? PokemonGender.Male : PokemonGender.Female;
}
