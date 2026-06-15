/**
 * Babylon render-backend visual constants (plan 125/126). World-space sizes,
 * timings and palette that are engine-agnostic now live once in
 * `@pokemon-tactic/view-core` (plan 126 lot E) and are re-exported here (these
 * ones keep their unprefixed names; the `BABYLON_`-prefixed tunables alias them in
 * `babylon-constants.ts`). Only the Babylon-only palette stays declared locally.
 */

export { teamColorByIndex } from "@pokemon-tactic/render-ports";
export {
  BATTLE_TEXT_DURATION_MS,
  BATTLE_TEXT_QUEUE_DELAY_MS,
  BATTLE_TEXT_STROKE_COLOR,
  DAMAGE_ESTIMATE_ALPHA_GUARANTEED,
  DAMAGE_ESTIMATE_ALPHA_POSSIBLE,
  DAMAGE_ESTIMATE_IMMUNE_COLOR,
  DAMAGE_ESTIMATE_TEXT_COLOR,
  DAMAGE_ESTIMATE_TEXT_STROKE_COLOR,
  DAMAGE_FLASH_DURATION_MS,
  DAMAGE_FLASH_REPEAT,
  FONT_FAMILY,
  HP_BAR_BG_COLOR,
  HP_BAR_BORDER_COLOR,
  KO_TINT_COLOR,
  MOVE_TWEEN_DURATION_MS,
  PULSE_MAX_SCALE,
  PULSE_MIN_SCALE,
  STATUS_ASSET_KEY,
  SUBSTITUTE_SPRITE_ID,
  TEXT_COLOR_PRIMARY,
} from "@pokemon-tactic/view-core";

export const CURSOR_COLOR = 0xffdd44;

// Each cursor sprite has its own ideal on-screen scale — the baseline reads well
// at 0.5, but the pokéball-integrated variants need more size to stay legible.
export const HOVER_CURSOR_OPTIONS = [
  { key: "hover-cursor", label: "Flèche", scale: 0.5 },
  { key: "hover-cursor-variant-claw-arrow", label: "Claw", scale: 0.75 },
  { key: "hover-cursor-variant-teardrop", label: "Goutte", scale: 0.75 },
  { key: "hover-cursor-variant-v-wings", label: "V-Wings", scale: 0.75 },
] as const;
export type HoverCursorOption = (typeof HOVER_CURSOR_OPTIONS)[number];

export const AURA_HOVER_MAX_ICONS = 6;
export const SCREEN_HOVER_AURA_ALPHA = 0.7;
export const FIELD_TERRAIN_OUTLINE_ALPHA = 0.95;

export const TILE_HIGHLIGHT_MOVE_COLOR = 0x4488cc;
export const TILE_HIGHLIGHT_ATTACK_COLOR = 0xcc4444;
export const TILE_HIGHLIGHT_ENEMY_RANGE_COLOR = 0xdd6622;
export const TILE_HIGHLIGHT_ENEMY_RANGE_ALPHA = 0.35;
export const TILE_HIGHLIGHT_RETREAT_COLOR = 0x55ccff;

export const TILE_PREVIEW_ATTACK_COLOR = 0xcc4444;
export const TILE_PREVIEW_BUFF_COLOR = 0x4488cc;
export const TILE_PREVIEW_BLAST_INTERCEPT_COLOR = 0xffaa33;
export const TILE_PREVIEW_ALPHA = 0.5;
export const TILE_RANGE_OUTLINE_COLOR = 0xcc4444;
export const TILE_RANGE_OUTLINE_ALPHA = 0.6;
