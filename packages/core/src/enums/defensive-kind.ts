export const DefensiveKind = {
  Protect: "protect",
  Detect: "detect",
  WideGuard: "wide_guard",
  QuickGuard: "quick_guard",
  Counter: "counter",
  MirrorCoat: "mirror_coat",
  MetalBurst: "metal_burst",
  Endure: "endure",
} as const;

export type DefensiveKind = (typeof DefensiveKind)[keyof typeof DefensiveKind];
