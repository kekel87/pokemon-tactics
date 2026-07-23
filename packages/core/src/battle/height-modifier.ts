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

/** Highest ranged bonus an attacker can gain from elevation (in tiles). */
export const HEIGHT_RANGE_BONUS_CAP = 2;
/** Levels of elevation over the aimed tile needed for each +1 tile of range. */
const HEIGHT_LEVELS_PER_RANGE_BONUS = 2;

/**
 * Extra targeting range (in tiles) an attacker gains for aiming at a tile BELOW it: +1 per
 * `HEIGHT_LEVELS_PER_RANGE_BONUS` levels of elevation above the aimed tile, clamped to
 * `[0, HEIGHT_RANGE_BONUS_CAP]`. Never negative — shooting uphill costs no range (the disadvantage
 * is already carried by the damage penalty in `getHeightModifier`). Applies to ranged targeting
 * only (Single with range > 1, Blast, Line, Cone); melee and Dash are unaffected.
 */
export function getHeightRangeBonus(attackerHeight: number, targetHeight: number): number {
  const diff = attackerHeight - targetHeight;
  if (diff <= 0) {
    return 0;
  }
  return Math.min(HEIGHT_RANGE_BONUS_CAP, Math.floor(diff / HEIGHT_LEVELS_PER_RANGE_BONUS));
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

export function heightBlocks(obstacleHeight: number, referenceHeight: number): boolean {
  return obstacleHeight > referenceHeight + 1;
}

export function withinHeightReach(attackerHeight: number, targetHeight: number): boolean {
  return Math.abs(attackerHeight - targetHeight) < MELEE_HEIGHT_LIMIT;
}
