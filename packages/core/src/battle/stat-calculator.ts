import type { Nature } from "../enums/nature";
import type { BaseStats } from "../types/base-stats";
import { applyNatureModifier } from "./nature-modifier";

export function computeStatAtLevel(base: number, level: number, isHp: boolean): number {
  const common = Math.floor((2 * base * level) / 100);
  return isHp ? common + level + 10 : common + 5;
}

export function computeCombatStats(
  baseStats: BaseStats,
  level: number,
  nature?: Nature,
): BaseStats {
  const leveled: BaseStats = {
    hp: computeStatAtLevel(baseStats.hp, level, true),
    attack: computeStatAtLevel(baseStats.attack, level, false),
    defense: computeStatAtLevel(baseStats.defense, level, false),
    spAttack: computeStatAtLevel(baseStats.spAttack, level, false),
    spDefense: computeStatAtLevel(baseStats.spDefense, level, false),
    speed: computeStatAtLevel(baseStats.speed, level, false),
  };
  return nature ? applyNatureModifier(leveled, nature) : leveled;
}
