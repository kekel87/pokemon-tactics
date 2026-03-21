export const TurnPhase = {
  StartTurn: "start_turn",
  Action: "action",
  EndTurn: "end_turn",
} as const;

export type TurnPhase = (typeof TurnPhase)[keyof typeof TurnPhase];
