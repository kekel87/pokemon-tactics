import type { Nature } from "../enums/nature";
import type { BaseStats } from "../types/base-stats";
import type { StatSpread } from "../types/stat-spread";
import { applyNatureModifier } from "./nature-modifier";

const FIXED_IV = 31;

export function computeStatAtLevel(base: number, level: number, isHp: boolean): number {
  const common = Math.floor(((2 * base + FIXED_IV) * level) / 100);
  return isHp ? common + level + 10 : common + 5;
}

export function computeCombatStats(
  baseStats: BaseStats,
  level: number,
  nature?: Nature,
  statSpread?: StatSpread,
): BaseStats {
  const leveled: BaseStats = {
    hp: computeStatAtLevel(baseStats.hp, level, true),
    attack: computeStatAtLevel(baseStats.attack, level, false),
    defense: computeStatAtLevel(baseStats.defense, level, false),
    spAttack: computeStatAtLevel(baseStats.spAttack, level, false),
    spDefense: computeStatAtLevel(baseStats.spDefense, level, false),
    speed: computeStatAtLevel(baseStats.speed, level, false),
  };
  const withNature = nature ? applyNatureModifier(leveled, nature) : leveled;
  if (!statSpread) {
    return withNature;
  }
  return {
    hp: withNature.hp + (statSpread.hp ?? 0),
    attack: withNature.attack + (statSpread.attack ?? 0),
    defense: withNature.defense + (statSpread.defense ?? 0),
    spAttack: withNature.spAttack + (statSpread.spAttack ?? 0),
    spDefense: withNature.spDefense + (statSpread.spDefense ?? 0),
    speed: withNature.speed + (statSpread.speed ?? 0),
  };
}
