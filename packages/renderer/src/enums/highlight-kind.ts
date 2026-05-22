export const HighlightKind = {
  Move: "move",
  Attack: "attack",
  EnemyRange: "enemy_range",
  Retreat: "retreat",
} as const;

export type HighlightKind = (typeof HighlightKind)[keyof typeof HighlightKind];
