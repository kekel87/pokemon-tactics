import type { PokemonInstance } from "../types/pokemon-instance";

/**
 * The ability id this mon effectively has right now, honouring the ability-manip family (plan 153):
 * - `abilitySuppressed` (Suc Digestif) wins over everything → no ability (undefined).
 * - otherwise `abilityIdOverride` (Soucigraine / Imitation / Échange) replaces the species ability.
 * - otherwise the species ability (`abilityId`).
 *
 * Every ability lookup in combat must read through this. Two paths reach it: the registry chokepoint
 * (`AbilityHandlerRegistry.getForPokemon`) — which also covers the `getForPokemon(...)?.id === "…"`
 * id-checks (Querelleur/scrappy, Glu/sticky-hold) and `resolveDefensiveAbility` transitively — and the
 * direct `effectiveAbilityId(...) === "…"` id-checks (Lévitation, Infiltration, Moiteur, Garde-Ami,
 * Tension, Brise Moule).
 */
export function effectiveAbilityId(pokemon: PokemonInstance): string | undefined {
  if (pokemon.abilitySuppressed) {
    return undefined;
  }
  return pokemon.abilityIdOverride ?? pokemon.abilityId;
}
