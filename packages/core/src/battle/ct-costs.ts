import { EffectTier } from "../enums/effect-tier";

const CT_THRESHOLD = 1000;
const CT_START = 600;
const CT_WAIT = 350;
const CT_MOVE_ONLY = 400;
const CT_COMBO_DISCOUNT = 150;

export { CT_START, CT_THRESHOLD, CT_WAIT };

export function computeCtGain(baseStat: number, speedStages: number): number {
  const base = 30 + Math.floor(20 * Math.log(baseStat + 1));
  const s = speedStages * 0.7;
  const softMult = s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
  return Math.floor(base * softMult);
}

export function ppCost(pp: number): number {
  if (pp >= 20) {
    return 500;
  }
  if (pp >= 16) {
    return 600;
  }
  if (pp >= 12) {
    return 700;
  }
  return 900;
}

export function powerFloor(power: number): number {
  if (power >= 110) {
    return 900;
  }
  if (power >= 90) {
    return 700;
  }
  if (power >= 70) {
    return 600;
  }
  return 0;
}

const EFFECT_FLOOR_BY_TIER: Record<EffectTier, number> = {
  [EffectTier.Reactive]: 500,
  [EffectTier.MajorStatus]: 700,
  [EffectTier.MajorBuff]: 600,
  [EffectTier.DoubleBuff]: 550,
};

export function effectFloor(tier: EffectTier | undefined): number {
  if (tier === undefined) {
    return 0;
  }
  return EFFECT_FLOOR_BY_TIER[tier];
}

export function computeMoveCost(pp: number, power: number, tier: EffectTier | undefined): number {
  if (tier === EffectTier.Reactive) {
    return 500;
  }
  return Math.max(ppCost(pp), powerFloor(power), effectFloor(tier));
}

export function computeCtActionCost(
  hasMoved: boolean,
  hasActed: boolean,
  moveCost: number,
): number {
  if (!hasMoved && !hasActed) {
    return CT_WAIT;
  }
  if (hasMoved && !hasActed) {
    return CT_MOVE_ONLY;
  }
  if (!hasMoved && hasActed) {
    return moveCost;
  }
  return CT_MOVE_ONLY + moveCost - CT_COMBO_DISCOUNT;
}
