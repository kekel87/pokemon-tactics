import { StatName } from "../enums/stat-name";
import { StatusType } from "../enums/status-type";
import type { PokemonInstance } from "../types/pokemon-instance";
import { effectiveAbilityId } from "./effective-ability";
import { effectiveCombatStats } from "./effective-combat-stats";
import { getEffectiveStat, isMajorStatus } from "./stat-modifier";

/** The five battle stats shown with an effective value (HP is the life bar, not a stat row). */
export type DisplayStat =
  | typeof StatName.Attack
  | typeof StatName.Defense
  | typeof StatName.SpAttack
  | typeof StatName.SpDefense
  | typeof StatName.Speed;

function hasStatus(pokemon: PokemonInstance, status: StatusType): boolean {
  return pokemon.statusEffects.some((effect) => effect.type === status);
}

function hasMajorStatus(pokemon: PokemonInstance): boolean {
  return pokemon.statusEffects.some((effect) => isMajorStatus(effect.type));
}

/**
 * The stat value a mon actually fights with, for the InfoPanel readout (plan 174): base (EV/nature) →
 * stat-stage crans → the status modifiers the engine applies. Mirrors the damage-calc / initiative
 * paths so the panel never contradicts real combat:
 * - Attack: Brûlure (burn) halves physical Attack, unless Cran (guts) — which instead ×1.5s it while
 *   any major status is active.
 * - Speed: Paralysie (paralysis) halves Speed, unless Pied Véloce (quick-feet) — which instead ×1.5s
 *   it while any major status is active.
 * Other stats take only the stat-stage multiplier. Held-item / weather multipliers stay move-context
 * bound and are out of scope here.
 */
export function effectiveDisplayStat(pokemon: PokemonInstance, stat: DisplayStat): number {
  const base = effectiveCombatStats(pokemon)[stat];
  const staged = getEffectiveStat(base, pokemon.statStages[stat] ?? 0);
  const ability = effectiveAbilityId(pokemon);

  if (stat === StatName.Attack) {
    if (ability === "guts" && hasMajorStatus(pokemon)) {
      return Math.floor(staged * 1.5);
    }
    if (hasStatus(pokemon, StatusType.Burned)) {
      return Math.floor(staged / 2);
    }
    return staged;
  }

  if (stat === StatName.Speed) {
    if (ability === "quick-feet" && hasMajorStatus(pokemon)) {
      return Math.floor(staged * 1.5);
    }
    if (hasStatus(pokemon, StatusType.Paralyzed)) {
      return Math.floor(staged * 0.5);
    }
    return staged;
  }

  return staged;
}
