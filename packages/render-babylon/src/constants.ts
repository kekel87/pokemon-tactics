/**
 * Babylon render-backend visual constants (plan 125/126). World-space sizes,
 * timings and palette that are engine-agnostic now live once in
 * `@pokemon-tactic/view-core` (plan 126 lot E) and are re-exported here (these
 * ones keep their unprefixed names; the `BABYLON_`-prefixed tunables alias them in
 * `babylon-constants.ts`). Only the Babylon-only palette stays declared locally.
 */

import { PokemonType } from "@pokemon-tactic/core";

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

export const FIELD_TERRAIN_OUTLINE_ALPHA = 0.95;

export const TILE_HIGHLIGHT_MOVE_COLOR = 0x4488cc;
export const TILE_HIGHLIGHT_ATTACK_COLOR = 0xcc4444;
export const TILE_HIGHLIGHT_ENEMY_RANGE_COLOR = 0xdd6622;
export const TILE_HIGHLIGHT_ENEMY_RANGE_ALPHA = 0.35;
export const TILE_HIGHLIGHT_RETREAT_COLOR = 0x55ccff;

export const TILE_PREVIEW_ATTACK_COLOR = 0xcc4444;
export const TILE_PREVIEW_BUFF_COLOR = 0x4488cc;
export const TILE_PREVIEW_HEAL_COLOR = 0x44dd44;
export const TILE_PREVIEW_DASH_COLOR = 0xffdd44;
export const TILE_PREVIEW_BLAST_INTERCEPT_COLOR = 0xffaa33;
export const TILE_PREVIEW_ALPHA = 0.5;
export const TILE_RANGE_OUTLINE_COLOR = 0xcc4444;
export const TILE_RANGE_OUTLINE_ALPHA = 0.6;

/**
 * Move-effect tint per type (plan 234): the same palette as the DOM type badges
 * (`--type-*` in `packages/app/src/styles/tokens.css`). The PMDO particles are white, the tint
 * colours them; `MOVE_EFFECT_TINT_WHITE_MIX` lifts the darkest types so they stay visible.
 */
export const MOVE_EFFECT_TYPE_COLORS: Readonly<Record<PokemonType, number>> = {
  [PokemonType.Normal]: 0x98a098,
  [PokemonType.Fire]: 0xe02828,
  [PokemonType.Water]: 0x2880e8,
  [PokemonType.Grass]: 0x38a028,
  [PokemonType.Electric]: 0xf8c000,
  [PokemonType.Ice]: 0x38d8f8,
  [PokemonType.Fighting]: 0xf88000,
  [PokemonType.Poison]: 0x9040c8,
  [PokemonType.Ground]: 0x905020,
  [PokemonType.Flying]: 0x80b8e8,
  [PokemonType.Psychic]: 0xe84078,
  [PokemonType.Bug]: 0x90a018,
  [PokemonType.Rock]: 0xa8a880,
  [PokemonType.Ghost]: 0x704070,
  [PokemonType.Dragon]: 0x5060e0,
  [PokemonType.Dark]: 0x504038,
  [PokemonType.Steel]: 0x60a0b8,
  [PokemonType.Fairy]: 0xe870e8,
};
/** Stat changes read the series' way, whatever the stat or the move's type: red rising, blue falling. */
export const MOVE_EFFECT_STAT_UP_COLOR = 0xf04a3a;
export const MOVE_EFFECT_STAT_DOWN_COLOR = 0x4f8cff;
/** Restored HP: the ground ring and the rising sparkles. */
export const MOVE_EFFECT_HEAL_COLOR = 0xa8f0a0;
/** Drained HP flies back to the caster as green bubbles. */
export const MOVE_EFFECT_DRAIN_COLOR = 0x88e070;
/** Share of white mixed into a move effect's type tint (0 = raw type colour). */
export const MOVE_EFFECT_TINT_WHITE_MIX = 0.25;
/** Impact sparks keep most of their own colour: a lighter touch of the type. */
export const MOVE_EFFECT_SPARK_WHITE_MIX = 0.6;
