export const HighlightKind = {
  Move: "move",
  Attack: "attack",
} as const;

export type HighlightKind = (typeof HighlightKind)[keyof typeof HighlightKind];
