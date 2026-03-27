export const HighlightKind = {
  Move: "move",
  Attack: "attack",
  AoePreview: "aoe-preview",
} as const;

export type HighlightKind = (typeof HighlightKind)[keyof typeof HighlightKind];
