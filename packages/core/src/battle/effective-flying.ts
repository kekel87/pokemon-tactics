import { HeldItemId } from "../enums/held-item-id";
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

/**
 * Override-aware base types of an instance: the runtime `typeOverride` (type-manip family) wins over
 * the species types from `pokemonTypesMap`. This is THE single point every type read must go through
 * so a mutated type (Conversion, Détrempage, Flamme Ultime…) propagates to STAB, effectiveness,
 * terrain, hazards and status immunity. Roost filtering is layered separately via `getEffectiveTypes`.
 */
export function resolveBaseTypes(
  pokemon: PokemonInstance,
  pokemonTypesMap: ReadonlyMap<string, PokemonType[]>,
): PokemonType[] {
  return pokemon.typeOverride ?? pokemonTypesMap.get(pokemon.definitionId) ?? [];
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
  // defensively but removes Ground immunity / Levitate / Magnet Rise / Ballon while rooted).
  if (isRoosted(pokemon) || isIngrained(pokemon)) {
    return false;
  }
  // Ballon (air-balloon): holder floats — same airborne treatment as Lévitation (terrain, hazards
  // au sol, knockback). Reverts the instant the balloon pops (heldItemId cleared on the hit).
  return (
    types.includes(PokemonType.Flying) ||
    pokemon.abilityId === "levitate" ||
    pokemon.heldItemId === HeldItemId.AirBalloon
  );
}
