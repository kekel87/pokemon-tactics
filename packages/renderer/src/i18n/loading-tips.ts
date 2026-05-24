import type { RandomFn } from "@pokemon-tactic/core";

import { type TranslationKey, t } from "./index";

export interface LoadingTip {
  id: string;
  key: TranslationKey;
}

export const LOADING_TIPS: readonly LoadingTip[] = [
  { id: "facing-bonus", key: "loadingTip.facingBonus" },
  { id: "terrain-effects", key: "loadingTip.terrainEffects" },
  { id: "height-damage", key: "loadingTip.heightDamage" },
  { id: "weather-water-fire", key: "loadingTip.weatherWaterFire" },
  { id: "reflect-protection", key: "loadingTip.reflectProtection" },
  { id: "brick-break", key: "loadingTip.brickBreak" },
  { id: "undo-movement", key: "loadingTip.undoMovement" },
  { id: "ct-system", key: "loadingTip.ctSystem" },
] as const;

export function pickRandomTip(random: RandomFn, lastShownIds: readonly string[]): LoadingTip {
  const candidates = LOADING_TIPS.filter((tip) => !lastShownIds.includes(tip.id));
  const pool: readonly LoadingTip[] = candidates.length > 0 ? candidates : LOADING_TIPS;
  const index = Math.floor(random() * pool.length);
  const tip = pool[index] ?? pool[0];
  if (!tip) {
    throw new Error("LOADING_TIPS is empty");
  }
  return tip;
}

export function createTipProvider(random: RandomFn): () => string {
  const recentIds: string[] = [];
  const recentCap = Math.min(3, LOADING_TIPS.length - 1);
  return () => {
    const tip = pickRandomTip(random, recentIds);
    recentIds.push(tip.id);
    if (recentIds.length > recentCap) {
      recentIds.shift();
    }
    return t(tip.key);
  };
}
