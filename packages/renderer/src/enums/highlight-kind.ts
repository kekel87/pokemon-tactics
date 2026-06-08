export const HighlightKind = {
  Move: "move",
  Attack: "attack",
  EnemyRange: "enemy_range",
  Retreat: "retreat",
  /** Attack-target previews (affected tiles for the hovered/locked target). */
  PreviewBuff: "preview_buff",
  PreviewAttack: "preview_attack",
  PreviewBlast: "preview_blast",
} as const;

export type HighlightKind = (typeof HighlightKind)[keyof typeof HighlightKind];
