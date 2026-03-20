export const StatusType = {
  Burned: "burned",
  Paralyzed: "paralyzed",
  Poisoned: "poisoned",
  BadlyPoisoned: "badly_poisoned",
  Frozen: "frozen",
  Asleep: "asleep",
  Confused: "confused",
} as const;

export type StatusType = (typeof StatusType)[keyof typeof StatusType];
