import type { PokemonInstance } from "../types/pokemon-instance";

/**
 * The raw Speed stat that drives movement + turn order (ctGain): the by-instance
 * `speedStatOverride` (Permuvitesse / speed-swap) when set, otherwise the species `baseStats.speed`.
 * The InfoPanel base-stat display keeps reading `baseStats.speed` directly (decision #597).
 */
export function effectiveBaseSpeed(pokemon: PokemonInstance): number {
  return pokemon.speedStatOverride ?? pokemon.baseStats.speed;
}
