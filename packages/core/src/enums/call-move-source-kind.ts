/**
 * Move-copy family (plan 144): how a "call move" resolves the move it will execute at use time.
 *  - `RandomAll`: any implemented move minus the exclusion list (Métronome).
 *  - `RandomOwnAsleep`: a random move from the user's own moveset minus exclusions; gated behind
 *    sleep via `requiresAsleep` (Blabla Dodo).
 *  - `TargetLast`: the selected target's last used move (Mimique).
 *  - `GlobalLast`: the last move used by anyone on the field (Photocopie).
 */
export const CallMoveSourceKind = {
  RandomAll: "random-all",
  RandomOwnAsleep: "random-own-asleep",
  TargetLast: "target-last",
  GlobalLast: "global-last",
} as const;

export type CallMoveSourceKind = (typeof CallMoveSourceKind)[keyof typeof CallMoveSourceKind];
