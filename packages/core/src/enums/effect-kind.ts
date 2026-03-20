export const EffectKind = {
  Damage: "damage",
  Status: "status",
  StatChange: "stat_change",
  Link: "link",
} as const;

export type EffectKind = (typeof EffectKind)[keyof typeof EffectKind];
