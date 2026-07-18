import type { PokemonInstance } from "../types/pokemon-instance";

/**
 * The ability id this mon effectively has right now, honouring the ability-manip family (plan 153):
 * - `abilitySuppressed` (Suc Digestif) wins over everything → no ability (undefined).
 * - otherwise `abilityIdOverride` (Soucigraine / Imitation / Échange) replaces the species ability.
 * - otherwise a Morphing/Imposteur copy (`transformState.abilityId`, plan 157) — note this can be
 *   `undefined` (morphed into a mon with no ability): the ternary on `transformState` presence avoids
 *   falling through to the species ability in that case.
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
  let baseId: string | undefined;
  if (pokemon.abilityIdOverride) {
    baseId = pokemon.abilityIdOverride;
  } else if (pokemon.transformState) {
    baseId = pokemon.transformState.abilityId;
  } else {
    baseId = pokemon.abilityId;
  }
  // Gaz Inhibiteur (neutralizing-gas, plan 163): within its r2 aura every ability is neutralized —
  // except Gaz Inhibiteur itself (a holder never suppresses its own gas).
  if (pokemon.abilitySuppressedByGas && baseId !== "neutralizing-gas") {
    return undefined;
  }
  return baseId;
}
