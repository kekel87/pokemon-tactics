import type { PokemonGender } from "../enums/pokemon-gender";
import type { PokemonInstance } from "../types/pokemon-instance";

/**
 * The gender a mon presents right now: the Morphing/Imposteur copy (`transformState.gender`,
 * plan 157) when transformed, otherwise its own `gender`. Drives Attraction (attract) opposite-sex
 * gating and the AI's Attraction scoring.
 */
export function effectiveGender(pokemon: PokemonInstance): PokemonGender {
  return pokemon.transformState?.gender ?? pokemon.gender;
}
