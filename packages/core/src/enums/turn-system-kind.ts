export const TurnSystemKind = {
  RoundRobin: "round-robin",
  ChargeTime: "charge-time",
} as const;

export type TurnSystemKind = (typeof TurnSystemKind)[keyof typeof TurnSystemKind];
