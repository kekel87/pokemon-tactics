export const StatusImmuneReason = {
  Type: "type",
  Weather: "weather",
  Ability: "ability",
} as const;

export type StatusImmuneReason = (typeof StatusImmuneReason)[keyof typeof StatusImmuneReason];
