export const HitAndRunRetreatFallbackReason = {
  Miss: "miss",
  Invalid: "invalid",
  Missing: "missing",
} as const;

export type HitAndRunRetreatFallbackReason =
  (typeof HitAndRunRetreatFallbackReason)[keyof typeof HitAndRunRetreatFallbackReason];
