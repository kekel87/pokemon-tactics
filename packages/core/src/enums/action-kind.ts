export const ActionKind = {
  Move: "move",
  UseMove: "use_move",
  EndTurn: "end_turn",
} as const;

export type ActionKind = (typeof ActionKind)[keyof typeof ActionKind];
