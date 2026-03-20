export const EffectTarget = {
  Self: "self",
  Targets: "targets",
} as const;

export type EffectTarget = (typeof EffectTarget)[keyof typeof EffectTarget];
