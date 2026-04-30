import { Nature } from "../enums/nature";
import { StatName } from "../enums/stat-name";
import type { BaseStats } from "../types/base-stats";
import type { NatureEffect } from "../types/nature-effect";

export const NATURE_BOOST_MULTIPLIER = 1.1;
export const NATURE_LOWER_MULTIPLIER = 0.9;

const NATURE_TABLE: Record<Nature, NatureEffect> = {
  [Nature.Hardy]: { boost: null, lowered: null },
  [Nature.Lonely]: { boost: StatName.Attack, lowered: StatName.Defense },
  [Nature.Brave]: { boost: StatName.Attack, lowered: StatName.Speed },
  [Nature.Adamant]: { boost: StatName.Attack, lowered: StatName.SpAttack },
  [Nature.Naughty]: { boost: StatName.Attack, lowered: StatName.SpDefense },
  [Nature.Bold]: { boost: StatName.Defense, lowered: StatName.Attack },
  [Nature.Docile]: { boost: null, lowered: null },
  [Nature.Relaxed]: { boost: StatName.Defense, lowered: StatName.Speed },
  [Nature.Impish]: { boost: StatName.Defense, lowered: StatName.SpAttack },
  [Nature.Lax]: { boost: StatName.Defense, lowered: StatName.SpDefense },
  [Nature.Timid]: { boost: StatName.Speed, lowered: StatName.Attack },
  [Nature.Hasty]: { boost: StatName.Speed, lowered: StatName.Defense },
  [Nature.Serious]: { boost: null, lowered: null },
  [Nature.Jolly]: { boost: StatName.Speed, lowered: StatName.SpAttack },
  [Nature.Naive]: { boost: StatName.Speed, lowered: StatName.SpDefense },
  [Nature.Modest]: { boost: StatName.SpAttack, lowered: StatName.Attack },
  [Nature.Mild]: { boost: StatName.SpAttack, lowered: StatName.Defense },
  [Nature.Quiet]: { boost: StatName.SpAttack, lowered: StatName.Speed },
  [Nature.Bashful]: { boost: null, lowered: null },
  [Nature.Rash]: { boost: StatName.SpAttack, lowered: StatName.SpDefense },
  [Nature.Calm]: { boost: StatName.SpDefense, lowered: StatName.Attack },
  [Nature.Gentle]: { boost: StatName.SpDefense, lowered: StatName.Defense },
  [Nature.Sassy]: { boost: StatName.SpDefense, lowered: StatName.Speed },
  [Nature.Careful]: { boost: StatName.SpDefense, lowered: StatName.SpAttack },
  [Nature.Quirky]: { boost: null, lowered: null },
};

export function applyNatureModifier(stats: BaseStats, nature: Nature): BaseStats {
  const effect = NATURE_TABLE[nature];
  if (effect.boost === null || effect.lowered === null) {
    return stats;
  }
  const result: BaseStats = { ...stats };
  if (effect.boost !== StatName.Hp && effect.boost in result) {
    const key = effect.boost as keyof BaseStats;
    result[key] = Math.floor(stats[key] * NATURE_BOOST_MULTIPLIER);
  }
  if (effect.lowered !== StatName.Hp && effect.lowered in result) {
    const key = effect.lowered as keyof BaseStats;
    result[key] = Math.floor(stats[key] * NATURE_LOWER_MULTIPLIER);
  }
  return result;
}
