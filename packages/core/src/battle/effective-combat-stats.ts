import type { BaseStats } from "../types/base-stats";
import type { PokemonInstance } from "../types/pokemon-instance";

/**
 * The combat stats a mon fights with right now: the Morphing/Imposteur copy
 * (`transformState.combatStats`, plan 157) when transformed, otherwise its own `combatStats`.
 * Note HP is never sourced from here for the life bar — `maxHp`/`currentHp` stay the caster's
 * (#649); this only drives the Atk/Def/SpA/SpD/Spe used by the damage calc and stat-based effects.
 */
export function effectiveCombatStats(pokemon: PokemonInstance): BaseStats {
  return pokemon.transformState?.combatStats ?? pokemon.combatStats;
}
