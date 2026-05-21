export const SemiInvulnerableState = {
  Flying: "flying",
  Burrowing: "burrowing",
  Diving: "diving",
  Vanished: "vanished",
} as const;

export type SemiInvulnerableState =
  (typeof SemiInvulnerableState)[keyof typeof SemiInvulnerableState];
