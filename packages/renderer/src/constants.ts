export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

export const GRID_SIZE = 12;

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

export const BACKGROUND_COLOR = 0x1a1a2e;

export const TILE_FILL_COLOR = 0x4a7c59;
export const TILE_STROKE_COLOR = 0x2d5a3f;
export const TILE_HIGHLIGHT_MOVE_COLOR = 0x4488cc;
export const TILE_HIGHLIGHT_ATTACK_COLOR = 0xcc4444;
export const TILE_STROKE_WIDTH = 1;

export const CURSOR_COLOR = 0xffdd44;
export const CURSOR_STROKE_WIDTH = 2;
export const CURSOR_PULSE_MIN_ALPHA = 0.7;
export const CURSOR_PULSE_MAX_ALPHA = 1.0;
export const CURSOR_PULSE_DURATION_MS = 600;

export const HP_BAR_WIDTH = 36;
export const HP_BAR_HEIGHT = 5;
export const HP_COLOR_HIGH = 0x44cc44;
export const HP_COLOR_MEDIUM = 0xddcc22;
export const HP_COLOR_LOW = 0xcc4444;
export const HP_BAR_BG_COLOR = 0x222222;
export const HP_BAR_BG_ALPHA = 0.9;
export const HP_BAR_BORDER_COLOR = 0x000000;
export const HP_THRESHOLD_HIGH = 0.6;
export const HP_THRESHOLD_LOW = 0.3;

export const POKEMON_SPRITE_RADIUS = 12;
export const POKEMON_SPRITE_BORDER_WIDTH = 2;
export const POKEMON_SPRITE_BORDER_ALPHA = 0.6;
export const POKEMON_SPRITE_SCALE = 2;
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

export const MOVE_TWEEN_DURATION_MS = 200;
export const DAMAGE_FLASH_DURATION_MS = 100;
export const DAMAGE_FLASH_REPEAT = 2;
export const FADEOUT_DURATION_MS = 400;
export const KO_TINT_COLOR = 0x444444;

export const VICTORY_TEXT_X = 640;
export const VICTORY_TEXT_Y = 320;
export const VICTORY_BUTTON_Y = 420;

export const TEAM_COLOR_PLAYER_1 = 0x2255aa;
export const TEAM_COLOR_PLAYER_2 = 0xaa2233;

export const INFO_PANEL_X = 16;
export const INFO_PANEL_Y = 606;
export const INFO_PANEL_WIDTH = 220;
export const INFO_PANEL_HEIGHT = 94;
export const INFO_PANEL_ALPHA = 0.85;
export const INFO_PANEL_CORNER_RADIUS = 6;

export const ACTION_MENU_X = 1050;
export const ACTION_MENU_Y = 300;
export const ACTION_MENU_WIDTH = 210;
export const ACTION_MENU_ITEM_HEIGHT = 32;
export const ACTION_MENU_BG_COLOR = 0x111122;
export const ACTION_MENU_BG_ALPHA = 0.9;
export const ACTION_MENU_HOVER_COLOR = 0x334466;
export const ACTION_MENU_HOVER_ALPHA = 0.6;
export const ACTION_MENU_DISABLED_ALPHA = 0.4;
export const ACTION_MENU_CORNER_RADIUS = 4;

export const TIMELINE_X = 30;
export const TIMELINE_Y = 80;
export const TIMELINE_ENTRY_SIZE = 32;
export const TIMELINE_ENTRY_SPACING = 6;
export const TIMELINE_ACTIVE_SIZE = 40;
export const TIMELINE_ACTIVE_BORDER_COLOR = 0xffdd44;
export const TIMELINE_BORDER_WIDTH = 2;
export const TIMELINE_ACTIVE_BORDER_WIDTH = 3;

export const PULSE_MIN_SCALE = 1.0;
export const PULSE_MAX_SCALE = 1.1;
export const PULSE_DURATION_MS = 800;

export const UI_BORDER_COLOR = 0xffffff;
export const UI_BORDER_ALPHA = 0.3;
export const UI_BORDER_WIDTH = 1;
export const UI_BUTTON_CORNER_RADIUS = 4;

export const TILE_PREVIEW_ATTACK_COLOR = 0xcc4444;
export const TILE_PREVIEW_BUFF_COLOR = 0x4488cc;
export const TILE_PREVIEW_ALPHA = 0.5;
export const TILE_RANGE_OUTLINE_COLOR = 0xcc4444;
export const TILE_RANGE_OUTLINE_ALPHA = 0.6;
export const TILE_RANGE_OUTLINE_WIDTH = 2.5;

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

export const DEPTH_GRID_HIGHLIGHT = 100;
export const DEPTH_GRID_PREVIEW = 120;
export const DEPTH_GRID_CURSOR = 150;
export const DEPTH_POKEMON_BASE = 200;
export const DEPTH_UI_BASE = 1000;
export const DEPTH_TIMELINE = 1050;
export const DEPTH_INFO_PANEL = 1100;
export const DEPTH_ACTION_MENU = 1200;
export const DEPTH_VICTORY_OVERLAY = 2000;
export const DEPTH_VICTORY_CONTENT = 2001;

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

export const STATUS_SPRITE_ICON_OFFSET_X = 16;
export const STATUS_SPRITE_ICON_SCALE = 0.35;

export const STAT_BADGE_BUFF_BG = 0x1a4a8a;
export const STAT_BADGE_DEBUFF_BG = 0x8a1a1a;
export const STAT_BADGE_HEIGHT = 14;
export const STAT_BADGE_CORNER_RADIUS = 3;
export const STAT_BADGE_PADDING_X = 5;
export const STAT_BADGE_SPACING = 3;
