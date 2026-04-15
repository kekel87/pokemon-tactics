export const EffectTier = {
  Reactive: "reactive",
  MajorStatus: "major-status",
  MajorBuff: "major-buff",
  DoubleBuff: "double-buff",
} as const;

export type EffectTier = (typeof EffectTier)[keyof typeof EffectTier];
