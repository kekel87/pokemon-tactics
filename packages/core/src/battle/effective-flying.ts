import { PokemonType } from "../enums/pokemon-type";
import { StatusType } from "../enums/status-type";
import type { PokemonInstance } from "../types/pokemon-instance";

export function isRoosted(pokemon: PokemonInstance): boolean {
  return pokemon.volatileStatuses.some((v) => v.type === StatusType.Roosted);
}

export function getEffectiveTypes(
  pokemon: PokemonInstance,
  types: readonly PokemonType[],
): PokemonType[] {
  if (isRoosted(pokemon)) {
    return types.filter((t) => t !== PokemonType.Flying);
  }
  return [...types];
}

export function isEffectivelyFlying(
  pokemon: PokemonInstance,
  types: readonly PokemonType[],
): boolean {
  if (isRoosted(pokemon)) {
    return false;
  }
  return types.includes(PokemonType.Flying) || pokemon.abilityId === "levitate";
}
