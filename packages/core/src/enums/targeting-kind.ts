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
  Teleport: "teleport",
  HitAndRun: "hit-and-run",
  /** Aim a single ground tile within range (occupant indifferent) — entry-hazard setters. */
  GroundTarget: "ground-target",
} as const;

export type TargetingKind = (typeof TargetingKind)[keyof typeof TargetingKind];
