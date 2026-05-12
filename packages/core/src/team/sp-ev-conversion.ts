import type { BaseStats } from "../types/base-stats";
import type { StatSpread } from "../types/stat-spread";

export type EvSpread = Partial<BaseStats>;

export const SP_TO_EV_RATIO = 8;
export const EV_PER_STAT_MAX = 252;
export const EV_TOTAL_MAX = 510;
export const SP_PER_STAT_MAX_LOCAL = 32;
export const SP_TOTAL_MAX_LOCAL = 66;

const STAT_KEYS: readonly (keyof BaseStats)[] = [
  "hp",
  "attack",
  "defense",
  "spAttack",
  "spDefense",
  "speed",
];

export function spToEv(spread: StatSpread): EvSpread {
  const result: EvSpread = {};
  let total = 0;
  for (const key of STAT_KEYS) {
    const sp = spread[key] ?? 0;
    const raw = sp * SP_TO_EV_RATIO;
    const clamped = Math.min(raw, EV_PER_STAT_MAX);
    const remaining = EV_TOTAL_MAX - total;
    const final = Math.max(0, Math.min(clamped, remaining));
    if (final > 0) {
      result[key] = final;
      total += final;
    }
  }
  return result;
}

export function evToSp(ev: EvSpread): StatSpread {
  const result: StatSpread = {};
  let total = 0;
  for (const key of STAT_KEYS) {
    const evValue = ev[key] ?? 0;
    const raw = Math.floor(evValue / SP_TO_EV_RATIO);
    const clamped = Math.min(raw, SP_PER_STAT_MAX_LOCAL);
    const remaining = SP_TOTAL_MAX_LOCAL - total;
    const final = Math.max(0, Math.min(clamped, remaining));
    if (final > 0) {
      result[key] = final;
      total += final;
    }
  }
  return result;
}
