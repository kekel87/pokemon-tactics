export const HighlightKind = {
  Move: "move",
  Attack: "attack",
  EnemyRange: "enemy_range",
} as const;

export type HighlightKind = (typeof HighlightKind)[keyof typeof HighlightKind];
