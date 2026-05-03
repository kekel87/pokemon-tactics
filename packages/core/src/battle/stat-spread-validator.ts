import { SP_PER_STAT_MAX, SP_TOTAL_MAX, type StatSpread } from "../types/stat-spread";

export function validateStatSpread(spread: StatSpread): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const keys = ["hp", "attack", "defense", "spAttack", "spDefense", "speed"] as const;
  let total = 0;

  for (const key of keys) {
    const value = spread[key] ?? 0;
    if (value < 0) {
      errors.push(`${key}: must be >= 0 (got ${value})`);
    } else if (value > SP_PER_STAT_MAX) {
      errors.push(`${key}: must be <= ${SP_PER_STAT_MAX} (got ${value})`);
    }
    total += value;
  }

  if (total > SP_TOTAL_MAX) {
    errors.push(`total SP must be <= ${SP_TOTAL_MAX} (got ${total})`);
  }

  return { valid: errors.length === 0, errors };
}
