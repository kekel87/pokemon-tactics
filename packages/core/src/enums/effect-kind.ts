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
  TransferStatStages: "transfer_stat_stages",
  PostAura: "post_aura",
} as const;

export type EffectKind = (typeof EffectKind)[keyof typeof EffectKind];
