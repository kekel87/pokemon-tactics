export const EffectKind = {
  Damage: "damage",
  Status: "status",
  StatChange: "stat_change",
  Defensive: "defensive",
  Knockback: "knockback",
} as const;

export type EffectKind = (typeof EffectKind)[keyof typeof EffectKind];
