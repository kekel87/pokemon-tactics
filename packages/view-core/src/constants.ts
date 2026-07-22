/**
 * Presentation-domain constants (plan 125). Engine-agnostic values consumed by
 * the orchestrator / view-builders / floating-text content: field-terrain pill
 * colours, aura & charging symbols, movement tween durations, and the whole
 * battle-text cluster (colours + timing). Pure visual constants tied to a single
 * renderer (depths, font sizes, stroke widths) stay in that renderer's package.
 *
 * The Babylon renderer re-imports the few it needs (text duration / stroke colour /
 * queue delay, floating-text lifts, tween durations) via `renderer`'s `constants.ts`
 * re-export, so its import sites stay unchanged.
 */

import type { AuraKind as AuraKindType } from "@pokemon-tactic/core";
import { AuraKind } from "@pokemon-tactic/core";

// ---------------------------------------------------------------------------
// Shared renderer view tunables (plan 126). World-space sizes, camera/iso math,
// sprite timings and palette that BOTH renderers must keep in lockstep so the
// two engines place and animate the board identically. Each renderer re-exports
// these from its own `constants.ts` (Babylon under a `BABYLON_` alias) so import
// sites stay unchanged. Engine-shaped values (Babylon `alphaIndex`/rendering
// groups vs Three `renderOrder`, clear-colour representation, near/far) stay in
// each renderer's local file.
// ---------------------------------------------------------------------------

// --- Camera / isometric framing ---
export const CAMERA_AZIMUTH = Math.PI / 4;
export const DIMETRIC_ELEVATION = Math.atan(1 / Math.sqrt(2));
export const CAMERA_DISTANCE = 20;
export const VIEW_SIZE = 13;
/**
 * Discrete zoom levels the mouse-wheel steps between (overview → medium → close),
 * as orthographic zoom factors relative to `VIEW_SIZE`. Higher = closer. The wheel
 * moves one level per notch instead of a continuous scale.
 */
export const ZOOM_LEVELS = [0.7, 1.1, 1.8] as const;
/** Starting level index into `ZOOM_LEVELS` (medium). */
export const ZOOM_DEFAULT_INDEX = 1;
export const AZIMUTH_STEP = Math.PI / 2;
export const AZIMUTH_LERP_EPSILON = 0.001;
export const ROTATION_LERP = 5;
export const CAMERA_PAN_LERP = 6;
export const CAMERA_PAN_EPSILON = 0.01;
/** Eased zoom: lerp rate toward the target level, and the snap threshold. */
export const ZOOM_LERP = 9;
export const ZOOM_LERP_EPSILON = 0.001;
export const PICK_DRAG_THRESHOLD_PX = 5;
export const HEMI_LIGHT_INTENSITY = 0.8;
export const DIRECTIONAL_LIGHT_INTENSITY = 0.6;

// --- Tile geometry ---
export const TILE_MIN_HEIGHT = 0.5;
export const TILE_HEIGHT_SCALE = 0.866;
export const SIDE_DARKEN = 0.65;

// --- Liquid tiles (plan 166) ---
// A liquid tile's rendered body is read in sixths. All liquids share a surface at
// 5/6 (a 1/6 air lip below the neighbouring solid ground, so the wall of adjacent
// tiles shows above the water). Walkable liquids (water/swamp) get an opaque floor
// up to 3/6 with translucent water 3/6→5/6; grounded sprites plant their feet at
// 3/6 so they read as wading/submerged. Fractions are tunable — bump them if the
// immersion looks too deep in playtest (100 % visual, gameplay height untouched).
export const LIQUID_SURFACE_RATIO = 5 / 6;
export const LIQUID_DEPTH_RATIO = 3 / 6;

// --- Sprite atlas / grounding / shadow ---
export const SPRITE_PIXELS_PER_UNIT = 24;
export const DEFAULT_FRAME_DURATION_MS = 100;
export const PMD_TICK_DURATION_MS = 24;
export const PMD_DEFAULT_FRAME_TICKS = 4;
export const SPRITE_GROUND_OFFSET_PX = 5;
export const HUD_ANCHOR_MARGIN_PX = 20;
export const SEMI_INVULNERABLE_LIFT = 1.5;
export const SHADOW_RADIUS_BY_SIZE: Readonly<Record<number, number>> = { 0: 0.14, 1: 0.2, 2: 0.3 };
export const SHADOW_RADIUS_DEFAULT = 0.2;
export const SHADOW_ALPHA = 0.3;
export const SHADOW_GROUND_OFFSET = 0.02;
export const SPRITE_HEAD_LIFT_FALLBACK = 1;

// --- Sprite flash / pulse / wobble timings ---
export const PULSE_PERIOD_MS = 900;
export const PULSE_MIN_SCALE = 1.0;
export const PULSE_MAX_SCALE = 1.1;
export const DAMAGE_FLASH_DURATION_MS = 100;
export const DAMAGE_FLASH_REPEAT = 2;
/**
 * Real time (ms) the damage flash takes to play out: each repeat is a bright +
 * a dark half-cycle, so `repeat * 2` half-cycles of `DAMAGE_FLASH_DURATION_MS`.
 * Used to let the damage reaction finish before a lethal hit's Faint cuts in.
 */
export const DAMAGE_FLASH_TOTAL_MS = DAMAGE_FLASH_DURATION_MS * DAMAGE_FLASH_REPEAT * 2;
/** Grey level a sprite dims to on a damage-flash dark half-cycle (0..1). */
export const DAMAGE_FLASH_DIM = 0.25;
/** Dimmest grey of the confirm-attack preview pulse (0..1). */
export const PREVIEW_FLASH_DIM = 0.35;
export const PREVIEW_FLASH_PERIOD_MS = 600;
export const CONFUSION_WOBBLE_ANGLE = (5 * Math.PI) / 180;
export const CONFUSION_WOBBLE_PERIOD_MS = 1200;
/** Dark tint colour (0xRRGGBB) applied to a knocked-out sprite. */
export const KO_TINT_COLOR = 0x444444;

// --- Movement / attack pacing ---
export const JUMP_VERTICAL_LEAD = 0.45;
export const ATTACK_ANIMATION_MAX_MS = 1000;
export const KNOCKBACK_SHAKE_AMPLITUDE = 0.12;
export const KNOCKBACK_SHAKE_DURATION_MS = 250;
export const KNOCKBACK_SHAKE_CYCLES = 3;

// --- Tile-range overlays + hover cursor ---
export const TILE_HIGHLIGHT_ALPHA = 0.4;
export const TILE_OUTLINE_Y_OFFSET = 0.02;
export const TILE_CURSOR_WIDTH = 0.05;
export const TILE_RANGE_OUTLINE_WIDTH = 0.06;
export const HOVER_CURSOR_GAP = 0.35;

// --- Field terrain ("Champs") ---
export const FIELD_TERRAIN_FILL_ALPHA = 0.3;
export const FIELD_TERRAIN_OUTLINE_WIDTH = 0.04;
export const CHAMP_PILL_HEIGHT = 0.5;
export const CHAMP_PILL_LIFT = 0.25;

// --- Ground aura hover icons ---
export const AURA_HOVER_ICON_HEIGHT = 0.28;
export const AURA_HOVER_ICON_OFFSET = 0.2;
export const AURA_HOVER_ICON_LIFT = 0.12;

// --- Placement direction arrows ---
export const DIRECTION_ARROW_Y_OFFSET = 0.03;
export const DIRECTION_ARROW_TILE_FRACTION = 0.6;
export const DIRECTION_ARROW_ACTIVE_EMISSIVE = { r: 0.55, g: 0.5, b: 0.15 } as const;

// --- World-anchored HUD (HP bar / status / damage preview / floating text) ---
export const HP_BAR_WIDTH = 0.78;
export const HP_BAR_HEIGHT = 0.12;
export const HP_BAR_BG_COLOR = 0x222222;
export const HP_BAR_BORDER_COLOR = 0x000000;
export const HUD_STATUS_ICON_SIZE = 0.26;
export const HUD_STATUS_GAP = 0.06;
export const HUD_AURA_ICON_SIZE = 0.22;
export const HUD_AURA_FIRST_GAP = 0.13;
export const HUD_AURA_SLOT_OFFSET = 0.22;
export const HUD_DAMAGE_TEXT_HEIGHT = 0.52;
export const HUD_DAMAGE_TEXT_GAP = 0.0;
export const HUD_TEXT_FONT_PX = 32;
export const HUD_TEXT_PADDING_PX = 8;
export const TEXT_COLOR_PRIMARY = "#ffffff";
export const FONT_FAMILY = '"PokemonEmeraldPro", monospace';
export const DAMAGE_ESTIMATE_ALPHA_GUARANTEED = 0.4;
export const DAMAGE_ESTIMATE_ALPHA_POSSIBLE = 0.2;
export const DAMAGE_ESTIMATE_IMMUNE_COLOR = "#888888";
export const DAMAGE_ESTIMATE_TEXT_COLOR = "#ffffff";
export const DAMAGE_ESTIMATE_TEXT_STROKE_COLOR = "#000000";
export const STATUS_ASSET_KEY: Partial<Record<string, string>> = {
  burned: "burned",
  frozen: "frozen",
  paralyzed: "paralyzed",
  poisoned: "poisoned",
  badly_poisoned: "badly-poisoned",
  asleep: "asleep",
};
export const SUBSTITUTE_SPRITE_ID = "dummy";

// --- Floating combat text ---
export const FLOATING_TEXT_LIFT = 1.0;
export const FLOATING_TEXT_HEIGHT = 0.62;
export const FLOATING_TEXT_SECONDARY_SCALE = 0.8;
export const FLOATING_TEXT_RISE = 0.7;
/**
 * Extra world-space lift for a "secondary" label (e.g. the effectiveness text) so it sits ABOVE
 * the primary damage number of the same beat instead of overlapping it. Both labels rise together,
 * so a constant offset keeps them separated for the whole scroll.
 */
export const FLOATING_TEXT_SECONDARY_LIFT = 0.38;

// --- Movement tween durations (movement-animation) -------------------------
export const MOVE_TWEEN_DURATION_MS = 300;
export const MOVE_TWEEN_DURATION_FLYING_MS = 400;
/**
 * Duration of a single jump tween (walk-to-edge then fall/rise), in ms.
 * Shorter than the raw Hop sprite animation (≈792 ms) — the Hop anim is
 * slightly truncated on the trailing recovery frames so the movement
 * between tiles feels snappy on a staircase while still reading as a jump.
 */
export const JUMP_TWEEN_DURATION_MS = 800;

// --- Field-terrain pill colours --------------------------------------------
export const FIELD_TERRAIN_COLOR_GRASSY = 0x5fcf6a;
export const FIELD_TERRAIN_COLOR_ELECTRIC = 0xf2d33b;
export const FIELD_TERRAIN_COLOR_MISTY = 0xf49ad1;
export const FIELD_TERRAIN_COLOR_PSYCHIC = 0xb060e0;
/** Distorsion (Trick Room) zone — vivid indigo, distinct from the magenta Psychic terrain. */
export const DISTORTION_ZONE_COLOR = 0x7a5cff;
// --- Field-global zone pill colours (Gravité / Zone Étrange / Zone Magique) ----------------
/** Gravité zone — heavy slate blue (the gravity well). */
export const FIELD_GLOBAL_COLOR_GRAVITY = 0x5b7fb0;
/** Zone Étrange (wonder-room) — teal. */
export const FIELD_GLOBAL_COLOR_WONDER_ROOM = 0x3fb7a6;
/** Zone Magique (magic-room) — deep rose. */
export const FIELD_GLOBAL_COLOR_MAGIC_ROOM = 0xc0567f;
/** Requiem (perish-song) death-aura indicator (left of the HP bar + hover-zone ground marker). */
export const PERISH_AURA_INDICATOR_SYMBOL = "🎵";

// --- Charging / aura indicators --------------------------------------------
export const CHARGING_INDICATOR_SYMBOL = "⚡";
export const CHARGING_INDICATOR_ID = "charging";

export const AURA_INDICATOR_SYMBOL: Record<AuraKindType, string> = {
  [AuraKind.Reflect]: "🛡️",
  [AuraKind.LightScreen]: "✨",
  [AuraKind.Mist]: "🌫️",
  [AuraKind.Safeguard]: "🕊️",
};

// --- Battle floating-text: timing ------------------------------------------
export const BATTLE_TEXT_DURATION_MS = 1000;
export const BATTLE_TEXT_STROKE_COLOR = "#000000";
// Delay between two independent battle-text beats on the same target, as a
// FRACTION of the lifetime (so the cadence scales automatically when the
// duration changes — no second hardcoded number to keep in sync). The first
// beat spawns immediately; subsequent beats queue with this gap so each reads.
// ~0.5 ⇒ about two labels on screen at once (readable, slight overlap).
export const BATTLE_TEXT_QUEUE_DELAY_FACTOR = 0.5;
export const BATTLE_TEXT_QUEUE_DELAY_MS = Math.round(
  BATTLE_TEXT_DURATION_MS * BATTLE_TEXT_QUEUE_DELAY_FACTOR,
);

// --- Battle floating-text: colours -----------------------------------------
export const BATTLE_TEXT_COLOR_DAMAGE = "#ffffff";
export const BATTLE_TEXT_COLOR_HEAL = "#44dd44";
export const BATTLE_TEXT_COLOR_MISS = "#888888";
export const BATTLE_TEXT_COLOR_IMMUNE = "#888888";
export const BATTLE_TEXT_COLOR_EXTREMELY_EFFECTIVE = "#ff6600";
export const BATTLE_TEXT_COLOR_SUPER_EFFECTIVE = "#ffcc00";
export const BATTLE_TEXT_COLOR_NOT_VERY_EFFECTIVE = "#aaaaaa";
export const BATTLE_TEXT_COLOR_MOSTLY_INEFFECTIVE = "#777777";
export const BATTLE_TEXT_COLOR_FALL_DAMAGE = "#ff8844";
export const BATTLE_TEXT_COLOR_BUFF = "#4488ff";
export const BATTLE_TEXT_COLOR_DEBUFF = "#ff4444";
export const BATTLE_TEXT_COLOR_CONFUSED = "#aa44dd";
export const BATTLE_TEXT_COLOR_FLINCH = "#cc88ff";
export const BATTLE_TEXT_COLOR_INFO = "#dddddd";
export const BATTLE_TEXT_COLOR_ABILITY = "#ffe066";
export const BATTLE_TEXT_COLOR_ITEM = "#88ff88";
export const BATTLE_TEXT_COLOR_ITEM_CONSUMED = "#888888";
export const BATTLE_TEXT_COLOR_CRITICAL = "#ff8800";
export const BATTLE_TEXT_COLOR_KO = "#ff2222";
export const BATTLE_TEXT_COLOR_TAUNT = "#ff8855";
