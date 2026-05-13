export const EffectKind = {
  Damage: "damage",
  Status: "status",
  StatChange: "stat_change",
  Defensive: "defensive",
  Knockback: "knockback",
  HealSelf: "heal_self",
  Recoil: "recoil",
  Drain: "drain",
  SetWeather: "set_weather",
} as const;

export type EffectKind = (typeof EffectKind)[keyof typeof EffectKind];
