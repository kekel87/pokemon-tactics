export const ActionKind = {
  Move: "move",
  UseMove: "use_move",
  SkipTurn: "skip_turn",
} as const;

export type ActionKind = (typeof ActionKind)[keyof typeof ActionKind];
