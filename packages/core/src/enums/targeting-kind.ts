export const TargetingKind = {
  Single: "single",
  Self: "self",
  Cone: "cone",
  Cross: "cross",
  Line: "line",
  Dash: "dash",
  Zone: "zone",
  Slash: "slash",
  Blast: "blast",
} as const;

export type TargetingKind = (typeof TargetingKind)[keyof typeof TargetingKind];
