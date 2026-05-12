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
} as const;

export type StatusType = (typeof StatusType)[keyof typeof StatusType];
