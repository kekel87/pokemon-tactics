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
} as const;

export type StatusType = (typeof StatusType)[keyof typeof StatusType];
