import type { PokemonInstance } from "../types/pokemon-instance";

/**
 * The raw Speed stat that drives movement + turn order (ctGain). Priority (#656):
 * `speedStatOverride` (Permuvitesse / speed-swap) > `transformState.baseSpeed` (Morphing/Imposteur,
 * plan 157) > species `baseStats.speed`. The InfoPanel base-stat display keeps reading
 * `baseStats.speed` directly (decision #597).
 */
export function effectiveBaseSpeed(pokemon: PokemonInstance): number {
  return pokemon.speedStatOverride ?? pokemon.transformState?.baseSpeed ?? pokemon.baseStats.speed;
}
