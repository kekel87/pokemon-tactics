const FALL_DAMAGE_PERCENT: readonly number[] = [0, 0, 33, 66, 100];

export function calculateFallDamage(heightDiff: number, maxHp: number): number {
  if (heightDiff <= 1.0) {
    return 0;
  }

  const tier = Math.min(Math.floor(heightDiff), FALL_DAMAGE_PERCENT.length - 1);
  const percent = FALL_DAMAGE_PERCENT[tier] ?? 100;

  return Math.floor((percent / 100) * maxHp);
}
