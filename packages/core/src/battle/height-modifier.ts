const HEIGHT_BONUS_PER_LEVEL = 0.1;
const MAX_HEIGHT_BONUS = 0.5;
const MAX_HEIGHT_PENALTY = -0.3;

export function getHeightModifier(
  attackerHeight: number,
  defenderHeight: number,
  ignoresHeight: boolean,
): number {
  if (ignoresHeight) {
    return 1.0;
  }

  const diff = attackerHeight - defenderHeight;

  if (diff === 0) {
    return 1.0;
  }

  const rawBonus = diff * HEIGHT_BONUS_PER_LEVEL;
  const clampedBonus = Math.max(MAX_HEIGHT_PENALTY, Math.min(MAX_HEIGHT_BONUS, rawBonus));
  return 1.0 + clampedBonus;
}

const MELEE_HEIGHT_LIMIT = 2;

export function isMeleeBlockedByHeight(
  attackerHeight: number,
  defenderHeight: number,
  moveRange: number,
): boolean {
  if (moveRange > 1) {
    return false;
  }

  return Math.abs(attackerHeight - defenderHeight) >= MELEE_HEIGHT_LIMIT;
}
