import type { BaseStats } from "../types/base-stats";
import type { PokemonInstance } from "../types/pokemon-instance";

/**
 * The combat stats a mon fights with right now: the Morphing/Imposteur copy
 * (`transformState.combatStats`, plan 157) when transformed, otherwise its own `combatStats`.
 * Note HP is never sourced from here for the life bar — `maxHp`/`currentHp` stay the caster's
 * (#649); this only drives the Atk/Def/SpA/SpD/Spe used by the damage calc and stat-based effects.
 */
export function effectiveCombatStats(pokemon: PokemonInstance): BaseStats {
  const base = pokemon.transformState?.combatStats ?? pokemon.combatStats;
  // Partage Garde (guard-split, plan 162): a by-instance override pins the raw Def / Sp. Def to the
  // caster↔target average. Return a fresh object so the shared `combatStats`/`transformState` are
  // never mutated.
  if (pokemon.defenseStatOverride === undefined && pokemon.spDefenseStatOverride === undefined) {
    return base;
  }
  return {
    ...base,
    defense: pokemon.defenseStatOverride ?? base.defense,
    spDefense: pokemon.spDefenseStatOverride ?? base.spDefense,
  };
}
