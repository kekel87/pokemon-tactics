import type { PokemonInstance } from "../types/pokemon-instance";

/**
 * The body weight (kg) a mon has right now: the Morphing/Imposteur copy (`transformState.weight`,
 * plan 157) when transformed, otherwise its species `weight`. Drives weight-based move power
 * (Grosse Puissance / Fracasser).
 */
export function effectiveWeight(pokemon: PokemonInstance): number {
  return pokemon.transformState?.weight ?? pokemon.weight;
}
