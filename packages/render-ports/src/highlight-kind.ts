/**
 * Board highlight kinds (plan 125). A board concept shared by the render backend
 * (tile highlight meshes) and the app-shell screens that request highlights, so
 * it lives in the contract package alongside `BoardHighlight`.
 */
export const HighlightKind = {
  Move: "move",
  Attack: "attack",
  EnemyRange: "enemy_range",
  Retreat: "retreat",
  /** Attack-target previews (affected tiles for the hovered/locked target). */
  PreviewBuff: "preview_buff",
  PreviewAttack: "preview_attack",
  PreviewHeal: "preview_heal",
  PreviewDash: "preview_dash",
  PreviewBlast: "preview_blast",
} as const;

export type HighlightKind = (typeof HighlightKind)[keyof typeof HighlightKind];
