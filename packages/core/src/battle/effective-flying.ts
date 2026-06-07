import { PokemonType } from "../enums/pokemon-type";
import { StatusType } from "../enums/status-type";
import type { PokemonInstance } from "../types/pokemon-instance";

export function isRoosted(pokemon: PokemonInstance): boolean {
  return pokemon.volatileStatuses.some((v) => v.type === StatusType.Roosted);
}

/** Ingrain (Racines) roots the mon to the ground while active (B2 healing). */
export function isIngrained(pokemon: PokemonInstance): boolean {
  return pokemon.volatileStatuses.some((v) => v.type === StatusType.Ingrain);
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
  // Roost strips the Flying type entirely for the turn; Ingrain only grounds (keeps the type
  // defensively but removes Ground immunity / Levitate / Magnet Rise while rooted).
  if (isRoosted(pokemon) || isIngrained(pokemon)) {
    return false;
  }
  return types.includes(PokemonType.Flying) || pokemon.abilityId === "levitate";
}
