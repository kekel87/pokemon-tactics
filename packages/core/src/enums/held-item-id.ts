export const HeldItemId = {
  Leftovers: "leftovers",
  LifeOrb: "life-orb",
  ChoiceBand: "choice-band",
  ChoiceScarf: "choice-scarf",
  FocusSash: "focus-sash",
  ExpertBelt: "expert-belt",
  RockyHelmet: "rocky-helmet",
  WeaknessPolicy: "weakness-policy",
  ScopeLens: "scope-lens",
  SitrusBerry: "sitrus-berry",
  HeavyDutyBoots: "heavy-duty-boots",
  LightBall: "light-ball",
} as const;

export type HeldItemId = (typeof HeldItemId)[keyof typeof HeldItemId];
