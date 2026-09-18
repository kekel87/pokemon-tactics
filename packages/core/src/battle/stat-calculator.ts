import type { Nature } from "../enums/nature";
import type { BaseStats } from "../types/base-stats";
import type { StatSpread } from "../types/stat-spread";
import { applyNatureModifier } from "./nature-modifier";

const FIXED_IV = 31;

/**
 * Le niveau d'un Pokemon quand personne n'en demande un autre — la parité 50 du mode Combat.
 *
 * 🔴 **Une seule déclaration, et c'est le but** : elle a vécu recopiée dans sept fichiers, toutes
 * d'accord sur 50, donc muettes — pendant que la formule de dégâts lisait la constante au lieu du
 * niveau de l'attaquant (récit complet au graphe, `backlog-champ-level-mort-et-battle-level-en-dur`).
 *
 * 🔴 **Ne PAS y brancher le déplacement ni le temps de charge.** Ils reposent sur `baseSpeed` :
 * `docs/game-design.md` veut un « mouvement constant quel que soit le niveau », pour qu'un joueur
 * qui apprend au niveau 5 ne réapprenne rien au niveau 50. Seuls les dégâts et les PV changent
 * d'échelle.
 */
export const DEFAULT_BATTLE_LEVEL = 50;

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
