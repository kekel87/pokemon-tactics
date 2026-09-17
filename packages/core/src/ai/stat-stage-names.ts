import { StatName } from "../enums/stat-name";

/**
 * Les 5 crans de stats de combat (hors Précision / Esquive).
 *
 * Extrait de `action-scorer.ts` au plan 214 pour que `repetition-guard.ts` compose la même signature
 * de position que le scorer lit : deux listes séparées auraient divergé au premier ajout de stat, et
 * la divergence n'aurait rien cassé de visible — juste rendu le filet anti-boucle aveugle à une stat.
 */
export const BATTLE_STAT_STAGE_NAMES: readonly StatName[] = [
  StatName.Attack,
  StatName.Defense,
  StatName.SpAttack,
  StatName.SpDefense,
  StatName.Speed,
];
