export const StatusType = {
  Burned: "burned",
  Paralyzed: "paralyzed",
  Poisoned: "poisoned",
  BadlyPoisoned: "badly_poisoned",
  Frozen: "frozen",
  Asleep: "asleep",
  Confused: "confused",
  Seeded: "seeded",
  Trapped: "trapped",
  Intimidated: "intimidated",
  Infatuated: "infatuated",
  LockedOn: "locked-on",
  Roosted: "roosted",
  Flinch: "flinch",
  Taunted: "taunted",
  Disabled: "disabled",
  Encored: "encored",
  /** Charge volatile: the user's next Electric move is doubled (B3). */
  Charged: "charged",
  /** Ingrain volatile (B2): heals 1/8 HP/turn if the mon did not move; grounds it. Persistent. */
  Ingrain: "ingrain",
  /** Aqua Ring volatile (B2): heals 1/16 HP/turn unconditionally. Persistent. */
  AquaRing: "aqua-ring",
} as const;

export type StatusType = (typeof StatusType)[keyof typeof StatusType];
