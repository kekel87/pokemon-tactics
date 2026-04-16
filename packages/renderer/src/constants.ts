export const TILE_WIDTH = 32;
export const TILE_HEIGHT = 16;
export const TILE_ELEVATION_STEP = 16;

export const GRID_SIZE = 12;

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

export const BACKGROUND_COLOR = 0x1a1a2e;
export const BACKGROUND_COLOR_CSS = "#1a1a2e";

export const TILE_FILL_COLOR = 0x4a7c59;
export const TILE_STROKE_COLOR = 0x2d5a3f;
export const TILE_HIGHLIGHT_MOVE_COLOR = 0x4488cc;
export const TILE_HIGHLIGHT_ATTACK_COLOR = 0xcc4444;
export const TILE_HIGHLIGHT_ENEMY_RANGE_COLOR = 0xdd6622;
export const TILE_HIGHLIGHT_ENEMY_RANGE_ALPHA = 0.35;
export const TILE_STROKE_WIDTH = 1;

export const CURSOR_COLOR = 0xffdd44;
export const CURSOR_STROKE_WIDTH = 1;
export const CURSOR_PULSE_MIN_ALPHA = 0.7;
export const CURSOR_PULSE_MAX_ALPHA = 1.0;
export const CURSOR_PULSE_DURATION_MS = 600;

export const HP_BAR_WIDTH = 18;
export const HP_BAR_HEIGHT = 2;
export const HP_BAR_BG_COLOR = 0x222222;
export const HP_BAR_BG_ALPHA = 0.9;
export const HP_BAR_BORDER_COLOR = 0x000000;

export const POKEMON_SPRITE_RADIUS = 6;
export const POKEMON_SPRITE_BORDER_WIDTH = 1;
export const POKEMON_SPRITE_BORDER_ALPHA = 0.6;
export const POKEMON_SPRITE_SCALE = 1;
export const POKEMON_SPRITE_GROUND_OFFSET_Y = -2;
export const PORTRAIT_SIZE = 40;
export const DAMAGE_FLASH_ALPHA = 0.3;

export const TYPE_COLORS: Partial<Record<string, number>> = {
  fire: 0xe85d3a,
  water: 0x4a90d9,
  grass: 0x5dba5d,
  normal: 0xa0a0a0,
  flying: 0x9db7f5,
  poison: 0xa040a0,
};

export const TYPE_NAMES = [
  "normal",
  "fighting",
  "flying",
  "poison",
  "ground",
  "rock",
  "bug",
  "ghost",
  "steel",
  "fire",
  "water",
  "grass",
  "electric",
  "psychic",
  "ice",
  "dragon",
  "dark",
  "fairy",
] as const;

export const TOOLTIP_WIDTH = 160;
export const TOOLTIP_CELL_SIZE = 10;
export const TOOLTIP_CELL_GAP = 2;
export const TOOLTIP_BG_COLOR = 0x111122;
export const TOOLTIP_BG_ALPHA = 0.95;
export const DEPTH_TOOLTIP = 1250;

export const MOVE_TWEEN_DURATION_MS = 300;
export const MOVE_TWEEN_DURATION_FLYING_MS = 400;
/**
 * Duration of a single jump tween (walk-to-edge then fall/rise), in ms.
 * Shorter than the raw Hop sprite animation (≈792 ms) — the Hop anim is
 * slightly truncated on the trailing recovery frames so the movement
 * between tiles feels snappy on a staircase while still reading as a jump.
 */
export const JUMP_TWEEN_DURATION_MS = 800;
export const DAMAGE_FLASH_DURATION_MS = 100;
export const DAMAGE_FLASH_REPEAT = 2;
export const FADEOUT_DURATION_MS = 400;
export const KO_TINT_COLOR = 0x444444;

export const VICTORY_TEXT_X = 640;
export const VICTORY_TEXT_Y = 320;
export const VICTORY_BUTTON_Y = 420;

export const TEAM_COLORS: readonly number[] = [
  0x2255aa, // Player 1 — Blue
  0xaa2233, // Player 2 — Red
  0x22aa44, // Player 3 — Green
  0xccaa00, // Player 4 — Yellow
  0x8833aa, // Player 5 — Purple
  0xdd6622, // Player 6 — Orange
  0x22aaaa, // Player 7 — Cyan
  0xdd4488, // Player 8 — Pink
  0x88cc22, // Player 9 — Lime
  0x885522, // Player 10 — Brown
  0x4488dd, // Player 11 — Light blue
  0x777777, // Player 12 — Grey
];

const FALLBACK_TEAM_COLOR = 0x2255aa;

export function getTeamColorByPlayerId(playerId: string): number {
  const match = playerId.match(/player-(\d+)/);
  if (!match) {
    return FALLBACK_TEAM_COLOR;
  }
  const index = Number.parseInt(match[1] ?? "1", 10) - 1;
  return TEAM_COLORS[index] ?? FALLBACK_TEAM_COLOR;
}

export const INFO_PANEL_X = 16;
export const INFO_PANEL_Y = 606;
export const INFO_PANEL_WIDTH = 220;
export const INFO_PANEL_HEIGHT = 94;
export const INFO_PANEL_ALPHA = 0.85;
export const INFO_PANEL_CORNER_RADIUS = 6;

export const ACTION_MENU_X = 1054;
export const ACTION_MENU_BOTTOM_Y = 700;
export const ACTION_MENU_WIDTH = 210;
export const ACTION_MENU_ITEM_HEIGHT = 32;
export const ACTION_MENU_BG_COLOR = 0x111122;
export const ACTION_MENU_BG_ALPHA = 0.9;
export const ACTION_MENU_HOVER_COLOR = 0x334466;
export const ACTION_MENU_HOVER_ALPHA = 0.6;
export const ACTION_MENU_DISABLED_ALPHA = 0.4;
export const ACTION_MENU_CORNER_RADIUS = 4;

export const TIMELINE_X = 16;
export const TIMELINE_Y = 20;
export const TIMELINE_ENTRY_SIZE = 36;
export const TIMELINE_ENTRY_SPACING = 6;
export const TIMELINE_ACTIVE_SIZE = 42;
export const TIMELINE_ACTIVE_BORDER_COLOR = 0xffdd44;
export const TIMELINE_BORDER_WIDTH = 2;
export const TIMELINE_ACTIVE_BORDER_WIDTH = 3;
export const TIMELINE_SEPARATOR_LINE_HEIGHT = 2;
export const TIMELINE_SEPARATOR_COLOR = 0x888888;
export const TIMELINE_SEPARATOR_ALPHA = 0.6;
export const TIMELINE_SEPARATOR_THICKNESS = 5;
export const TIMELINE_PAST_ENTRY_ALPHA = 0.55;
export const TIMELINE_CT_BAR_THICKNESS = 5;
export const TIMELINE_CT_BAR_GAP = 3;
export const TIMELINE_CT_BAR_COLOR = 0x44aaff;
export const TIMELINE_CT_BAR_BG_COLOR = 0x223344;
export const TIMELINE_BG_COLOR = 0x111122;
export const TIMELINE_BG_ALPHA = 0.8;
export const TIMELINE_HIGHLIGHT_BORDER_COLOR = 0x44ffaa;
export const TIMELINE_HIGHLIGHT_COLOR_CSS = "#44ffaa";
export const TIMELINE_TAIL_ENTRY_ALPHA = 0.45;
export const TIMELINE_PREDICTION_SLOTS = 24;
export const TIMELINE_VISIBLE_SLOTS = 11;

export const PULSE_MIN_SCALE = 1.0;
export const PULSE_MAX_SCALE = 1.1;
export const PULSE_DURATION_MS = 800;

export const UI_BORDER_COLOR = 0xffffff;
export const UI_BORDER_ALPHA = 0.3;
export const UI_BORDER_WIDTH = 1;
export const UI_BUTTON_CORNER_RADIUS = 4;

export const TILE_PREVIEW_ATTACK_COLOR = 0xcc4444;
export const TILE_PREVIEW_BUFF_COLOR = 0x4488cc;
export const TILE_PREVIEW_BLAST_INTERCEPT_COLOR = 0xffaa33;
export const TILE_PREVIEW_ALPHA = 0.5;
export const TILE_RANGE_OUTLINE_COLOR = 0xcc4444;
export const TILE_RANGE_OUTLINE_ALPHA = 0.6;
export const TILE_RANGE_OUTLINE_WIDTH = 1.5;

export const PREVIEW_FLASH_ALPHA = 0.3;
export const PREVIEW_FLASH_DURATION_MS = 300;

export const TILE_SPAWN_ZONE_ACTIVE_COLOR = 0x55aaff;
export const TILE_SPAWN_ZONE_INACTIVE_COLOR = 0x8888aa;
export const TILE_SPAWN_ZONE_OCCUPIED_COLOR = 0x335577;
export const TILE_SPAWN_ZONE_ALPHA = 0.5;

export const PLACEMENT_PANEL_HEIGHT = 110;
export const PLACEMENT_PANEL_Y = 610;
export const PLACEMENT_PANEL_ALPHA = 0.85;
export const PLACEMENT_PORTRAIT_SIZE = 48;
export const PLACEMENT_PORTRAIT_SPACING = 12;

export const DEPTH_GRID_TILES = 1;
export const DEPTH_TILE_MAX_ELEVATION = 5;
// Layering order (bottom → top):
//   tiles (1–125)  →  highlights (500–510)  →  Pokemon (520+)  →  cursor (900)  →  UI (1000+)
export const DEPTH_GRID_HIGHLIGHT = 500;
export const DEPTH_GRID_ENEMY_RANGE = 505;
export const DEPTH_GRID_PREVIEW = 510;
export const DEPTH_POKEMON_BASE = 520;
export const ATTACK_DEPTH_ENVELOPE_RADIUS = 3;
export const DEPTH_GRID_CURSOR = 900;
export const DEPTH_UI_BASE = 1000;
export const DEPTH_TIMELINE = 1050;
export const DEPTH_INFO_PANEL = 1100;
export const DEPTH_ACTION_MENU = 1200;
export const DEPTH_VICTORY_OVERLAY = 2000;
export const DEPTH_VICTORY_CONTENT = 2001;

const ZOOM_CLOSE = 4.0;
const ZOOM_MEDIUM = 2.6;
const ZOOM_OVERVIEW = 1.7;
export const ZOOM_LEVELS = [ZOOM_OVERVIEW, ZOOM_MEDIUM, ZOOM_CLOSE] as const;
export const ZOOM_DEFAULT_INDEX = 1;
export const ZOOM_TWEEN_DURATION_MS = 300;

export const ARROW_PAN_SPEED = 6;
export const CAMERA_BOUNDS_MARGIN = 100;

export const STATUS_ASSET_KEY: Partial<Record<string, string>> = {
  burned: "burned",
  frozen: "frozen",
  paralyzed: "paralyzed",
  poisoned: "poisoned",
  badly_poisoned: "badly-poisoned",
  asleep: "asleep",
};

export const STATUS_ICON_KEYS = [
  "burned",
  "frozen",
  "paralyzed",
  "poisoned",
  "badly-poisoned",
  "asleep",
] as const;

export const STATUS_SPRITE_ICON_OFFSET_X = 8;
export const STATUS_SPRITE_ICON_SCALE = 0.175;

export const DAMAGE_ESTIMATE_COLOR = 0x000000;
// Alpha values tuned so the overlay is clearly visible on a colored HP bar.
// 0.5 / 0.3 (the previous values) were lost in the fill color. 0.85 for
// guaranteed damage gives a near-opaque dark band; 0.55 for the variance
// makes it clearly distinguishable. Tune together with team colors.
export const DAMAGE_ESTIMATE_ALPHA_GUARANTEED = 0.85;
export const DAMAGE_ESTIMATE_ALPHA_POSSIBLE = 0.55;
export const DAMAGE_ESTIMATE_TEXT_SIZE = 7;
export const DAMAGE_ESTIMATE_TEXT_COLOR = "#ffffff";
export const DAMAGE_ESTIMATE_TEXT_STROKE_COLOR = "#000000";
export const DAMAGE_ESTIMATE_TEXT_STROKE_WIDTH = 2;
export const DAMAGE_ESTIMATE_IMMUNE_COLOR = "#888888";

export const BATTLE_TEXT_FONT_SIZE = 10;
export const BATTLE_TEXT_DURATION_MS = 3500;
export const BATTLE_TEXT_DRIFT_Y = -20;
export const BATTLE_TEXT_STROKE_COLOR = "#000000";
export const BATTLE_TEXT_STROKE_WIDTH = 2;
// Vertical offset applied to a "secondary" text that belongs to the same
// beat as a "primary" text (e.g. the effectiveness label above the damage
// number). Both texts are spawned with the same computed delay so they drift
// upward together as a single scroll.
export const BATTLE_TEXT_STAGGER_Y = -10;
// Delay between two independent battle-text beats on the same target. The
// first beat spawns immediately; subsequent beats are queued with this gap so
// the viewer can read each one. Tune together with BATTLE_TEXT_DURATION_MS.
export const BATTLE_TEXT_QUEUE_DELAY_MS = 700;
export const DEPTH_BATTLE_TEXT = 1500;

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
export const BATTLE_TEXT_COLOR_INFO = "#dddddd";

export const CONFUSION_WOBBLE_ANGLE = 5;
export const CONFUSION_WOBBLE_DURATION_MS = 300;

export const KNOCKBACK_SHAKE_OFFSET_X = 2;
export const KNOCKBACK_SHAKE_DURATION_MS = 50;
export const KNOCKBACK_SHAKE_REPEAT = 2;

export const BATTLE_LOG_WIDTH = 300;
export const BATTLE_LOG_VISIBLE_LINES = 6;
export const BATTLE_LOG_LINE_HEIGHT = 18;
export const BATTLE_LOG_PADDING = 8;
export const BATTLE_LOG_HEADER_HEIGHT = 28;
export const BATTLE_LOG_ACTIONS_HEIGHT = 28;
export const BATTLE_LOG_BG_ALPHA = 0.7;
export const BATTLE_LOG_BG_COLOR = 0x111122;
export const BATTLE_LOG_MAX_ENTRIES = 50;
export const BATTLE_LOG_FONT_SIZE = 20;
export const DEPTH_BATTLE_LOG = 1300;

export const STAT_BADGE_BUFF_BG = 0x1a4a8a;
export const STAT_BADGE_DEBUFF_BG = 0x8a1a1a;
export const STAT_BADGE_VOLATILE_BG = 0x6a3a8a;
export const STAT_BADGE_HEIGHT = 14;
export const STAT_BADGE_CORNER_RADIUS = 3;
export const STAT_BADGE_PADDING_X = 5;
export const STAT_BADGE_SPACING = 3;

export const DIRECTION_INACTIVE_TINT = 0x888888;

export const TOOLTIP_CELL_COLOR_TARGET = 0xff6644;
export const TOOLTIP_CELL_COLOR_DASH = 0xffdd44;
export const TOOLTIP_CELL_COLOR_CASTER = 0xffdd44;
export const TOOLTIP_CELL_COLOR_EMPTY = 0x333333;

export const BATTLE_LOG_COLOR_TURN = "#aaaaaa";
export const BATTLE_LOG_COLOR_MOVE = "#ffffff";
export const BATTLE_LOG_COLOR_DAMAGE = "#ff6666";
export const BATTLE_LOG_COLOR_EFFECTIVENESS = "#ffdd00";
export const BATTLE_LOG_COLOR_MISS = "#ffffff";
export const BATTLE_LOG_COLOR_STATUS = "#ffaa44";
export const BATTLE_LOG_COLOR_STAT_UP = "#4488ff";
export const BATTLE_LOG_COLOR_STAT_DOWN = "#ff4444";
export const BATTLE_LOG_COLOR_KO = "#ff2222";
export const BATTLE_LOG_COLOR_DEFENSE = "#44cc66";
export const BATTLE_LOG_COLOR_KNOCKBACK = "#ffffff";
export const BATTLE_LOG_COLOR_MULTI_HIT = "#ffffff";
export const BATTLE_LOG_COLOR_RECHARGE = "#aaaaaa";
export const BATTLE_LOG_COLOR_BATTLE_ENDED = "#ffee00";

export const BUTTON_COLOR = 0x335577;
export const BUTTON_BORDER_COLOR = 0x5577aa;
export const BUTTON_HOVER_COLOR = 0x446688;
export const BUTTON_DISABLED_COLOR = 0x333344;
export const BUTTON_DISABLED_BORDER_COLOR = 0x444455;

export const FONT_FAMILY = '"PokemonEmeraldPro", monospace';

export const TEXT_COLOR_PRIMARY = "#ffffff";
export const TEXT_COLOR_SECONDARY = "#cccccc";
export const TEXT_COLOR_MUTED = "#aaaaaa";
export const TEXT_COLOR_DISABLED = "#666666";
export const TEXT_COLOR_TITLE = "#ffcc00";
export const TEXT_COLOR_ACCENT = "#ffdd44";

export const REPLAY_BUTTON_DISABLED_COLOR = "#555555";

export const TILE_SPRITE_SCALE = 1;
export const TILE_ORIGIN_Y = 1.0;

export const TILESET_KEY = "terrain";

export const TERRAIN_TINT_ALPHA = 0.25;
export const TERRAIN_TINT: Record<string, number> = {
  water: 0x2244cc,
  deep_water: 0x1122aa,
  magma: 0xcc4422,
  lava: 0xdd3311,
  ice: 0x88ccff,
  sand: 0xccaa44,
  snow: 0xddddff,
  swamp: 0x556622,
  tall_grass: 0x44aa44,
};
