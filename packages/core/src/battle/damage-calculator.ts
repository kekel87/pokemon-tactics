import { Category } from "../enums/category";
import type { PokemonType } from "../enums/pokemon-type";
import type { StatusType } from "../enums/status-type";
import { StatusType as StatusTypeEnum } from "../enums/status-type";
import type { BaseStats } from "../types/base-stats";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import { getEffectiveStat } from "./stat-modifier";

const BATTLE_LEVEL = 50;

type TypeChart = Record<PokemonType, Record<PokemonType, number>>;

export function calculateDamage(
  attacker: PokemonInstance,
  defender: PokemonInstance,
  move: MoveDefinition,
  typeChart: TypeChart,
  attackerTypes: PokemonType[],
  defenderTypes: PokemonType[],
): number {
  if (move.category === Category.Status || move.power === 0) {
    return 0;
  }

  const effectiveness = getTypeEffectiveness(move.type, defenderTypes, typeChart);
  if (effectiveness === 0) {
    return 0;
  }

  const isPhysical = move.category === Category.Physical;
  const attackStat = isPhysical ? attacker.baseStats.attack : attacker.baseStats.spAttack;
  const defenseStat = isPhysical ? defender.baseStats.defense : defender.baseStats.spDefense;

  const attackStage = isPhysical
    ? attacker.statStages.attack
    : attacker.statStages.spAttack;
  const defenseStage = isPhysical
    ? defender.statStages.defense
    : defender.statStages.spDefense;

  let effectiveAttack = getEffectiveStat(attackStat, attackStage);
  const effectiveDefense = getEffectiveStat(defenseStat, defenseStage);

  const isBurned = attacker.statusEffects.some((s) => s.type === StatusTypeEnum.Burned);
  if (isBurned && isPhysical) {
    effectiveAttack = Math.floor(effectiveAttack / 2);
  }

  const baseDamage = Math.floor(
    (((2 * BATTLE_LEVEL / 5 + 2) * move.power * effectiveAttack) / effectiveDefense / 50 + 2),
  );

  const stab = getStab(move.type, attackerTypes);

  return Math.max(1, Math.floor(baseDamage * stab * effectiveness));
}

export function getTypeEffectiveness(
  moveType: PokemonType,
  defenderTypes: PokemonType[],
  typeChart: TypeChart,
): number {
  let multiplier = 1;
  const attackerRow = typeChart[moveType];
  if (!attackerRow) {
    return 1;
  }
  for (const defType of defenderTypes) {
    const value = attackerRow[defType];
    if (value !== undefined) {
      multiplier *= value;
    }
  }
  return multiplier;
}

export function getStab(moveType: PokemonType, attackerTypes: PokemonType[]): number {
  return attackerTypes.includes(moveType) ? 1.5 : 1;
}
