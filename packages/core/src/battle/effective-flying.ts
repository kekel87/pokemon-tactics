import { PokemonType } from "../enums/pokemon-type";
import type { PokemonInstance } from "../types/pokemon-instance";

export function isEffectivelyFlying(
  pokemon: PokemonInstance,
  types: readonly PokemonType[],
): boolean {
  return types.includes(PokemonType.Flying) || pokemon.abilityId === "levitate";
}
