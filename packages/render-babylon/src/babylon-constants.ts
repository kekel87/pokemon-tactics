/**
 * Babylon renderer constants (Phase 5 / plan 126). The world-space sizes, camera/
 * iso math, sprite timings and HUD layout that are engine-agnostic now live once in
 * `@pokemon-tactic/view-core` (plan 126 lot E) and are re-exported here under
 * their `BABYLON_`-prefixed names so existing import sites stay unchanged. Only the
 * genuinely Babylon-specific values — transparent `alphaIndex` ordering, rendering
 * groups, the `{r,g,b}` clear colour, foot-depth biases, silhouette + debug colours
 * — are declared locally below.
 */
export {
  ATTACK_ANIMATION_MAX_MS as BABYLON_ATTACK_ANIMATION_MAX_MS,
  AURA_HOVER_ICON_HEIGHT as BABYLON_AURA_HOVER_ICON_HEIGHT,
  AURA_HOVER_ICON_LIFT as BABYLON_AURA_HOVER_ICON_LIFT,
  AURA_HOVER_ICON_OFFSET as BABYLON_AURA_HOVER_ICON_OFFSET,
  AZIMUTH_LERP_EPSILON as BABYLON_AZIMUTH_LERP_EPSILON,
  AZIMUTH_STEP as BABYLON_AZIMUTH_STEP,
  CAMERA_AZIMUTH as BABYLON_CAMERA_AZIMUTH,
  CAMERA_DISTANCE as BABYLON_CAMERA_DISTANCE,
  CAMERA_PAN_EPSILON as BABYLON_CAMERA_PAN_EPSILON,
  CAMERA_PAN_LERP as BABYLON_CAMERA_PAN_LERP,
  CHAMP_PILL_HEIGHT as BABYLON_CHAMP_PILL_HEIGHT,
  CHAMP_PILL_LIFT as BABYLON_CHAMP_PILL_LIFT,
  CONFUSION_WOBBLE_ANGLE as BABYLON_CONFUSION_WOBBLE_ANGLE,
  CONFUSION_WOBBLE_PERIOD_MS as BABYLON_CONFUSION_WOBBLE_PERIOD_MS,
  DAMAGE_FLASH_DIM as BABYLON_DAMAGE_FLASH_DIM_EMISSIVE,
  DEFAULT_FRAME_DURATION_MS as BABYLON_DEFAULT_FRAME_DURATION_MS,
  DIMETRIC_ELEVATION as BABYLON_DIMETRIC_ELEVATION,
  DIRECTION_ARROW_ACTIVE_EMISSIVE as BABYLON_DIRECTION_ARROW_ACTIVE_EMISSIVE,
  DIRECTION_ARROW_TILE_FRACTION as BABYLON_DIRECTION_ARROW_TILE_FRACTION,
  DIRECTION_ARROW_Y_OFFSET as BABYLON_DIRECTION_ARROW_Y_OFFSET,
  DIRECTIONAL_LIGHT_INTENSITY as BABYLON_DIRECTIONAL_LIGHT_INTENSITY,
  FIELD_TERRAIN_FILL_ALPHA as BABYLON_FIELD_TERRAIN_FILL_ALPHA,
  FIELD_TERRAIN_OUTLINE_WIDTH as BABYLON_FIELD_TERRAIN_OUTLINE_WIDTH,
  FLOATING_TEXT_HEIGHT as BABYLON_FLOATING_TEXT_HEIGHT,
  FLOATING_TEXT_LIFT as BABYLON_FLOATING_TEXT_LIFT,
  FLOATING_TEXT_RISE as BABYLON_FLOATING_TEXT_RISE,
  FLOATING_TEXT_SECONDARY_LIFT as BABYLON_FLOATING_TEXT_SECONDARY_LIFT,
  FLOATING_TEXT_SECONDARY_SCALE as BABYLON_FLOATING_TEXT_SECONDARY_SCALE,
  HEMI_LIGHT_INTENSITY as BABYLON_HEMI_LIGHT_INTENSITY,
  HOVER_CURSOR_GAP as BABYLON_HOVER_CURSOR_GAP,
  HP_BAR_HEIGHT as BABYLON_HP_BAR_HEIGHT,
  HP_BAR_WIDTH as BABYLON_HP_BAR_WIDTH,
  HUD_ANCHOR_MARGIN_PX as BABYLON_HUD_ANCHOR_MARGIN_PX,
  HUD_AURA_FIRST_GAP as BABYLON_HUD_AURA_FIRST_GAP,
  HUD_AURA_ICON_SIZE as BABYLON_HUD_AURA_ICON_SIZE,
  HUD_AURA_SLOT_OFFSET as BABYLON_HUD_AURA_SLOT_OFFSET,
  HUD_DAMAGE_TEXT_GAP as BABYLON_HUD_DAMAGE_TEXT_GAP,
  HUD_DAMAGE_TEXT_HEIGHT as BABYLON_HUD_DAMAGE_TEXT_HEIGHT,
  HUD_STATUS_GAP as BABYLON_HUD_STATUS_GAP,
  HUD_STATUS_ICON_SIZE as BABYLON_HUD_STATUS_ICON_SIZE,
  HUD_TEXT_FONT_PX as BABYLON_HUD_TEXT_FONT_PX,
  HUD_TEXT_PADDING_PX as BABYLON_HUD_TEXT_PADDING_PX,
  JUMP_VERTICAL_LEAD as BABYLON_JUMP_VERTICAL_LEAD,
  KNOCKBACK_SHAKE_AMPLITUDE as BABYLON_KNOCKBACK_SHAKE_AMPLITUDE,
  KNOCKBACK_SHAKE_CYCLES as BABYLON_KNOCKBACK_SHAKE_CYCLES,
  KNOCKBACK_SHAKE_DURATION_MS as BABYLON_KNOCKBACK_SHAKE_DURATION_MS,
  PICK_DRAG_THRESHOLD_PX as BABYLON_PICK_DRAG_THRESHOLD_PX,
  PMD_DEFAULT_FRAME_TICKS as BABYLON_PMD_DEFAULT_FRAME_TICKS,
  PMD_TICK_DURATION_MS as BABYLON_PMD_TICK_DURATION_MS,
  PREVIEW_FLASH_DIM as BABYLON_PREVIEW_FLASH_DIM_EMISSIVE,
  PREVIEW_FLASH_PERIOD_MS as BABYLON_PREVIEW_FLASH_PERIOD_MS,
  PULSE_PERIOD_MS as BABYLON_PULSE_PERIOD_MS,
  ROTATION_LERP as BABYLON_ROTATION_LERP,
  SEMI_INVULNERABLE_LIFT as BABYLON_SEMI_INVULNERABLE_LIFT,
  SHADOW_ALPHA as BABYLON_SHADOW_ALPHA,
  SHADOW_GROUND_OFFSET as BABYLON_SHADOW_GROUND_OFFSET,
  SHADOW_RADIUS_BY_SIZE as BABYLON_SHADOW_RADIUS_BY_SIZE,
  SHADOW_RADIUS_DEFAULT as BABYLON_SHADOW_RADIUS_DEFAULT,
  SIDE_DARKEN as BABYLON_SIDE_DARKEN,
  SPRITE_GROUND_OFFSET_PX as BABYLON_SPRITE_GROUND_OFFSET_PX,
  SPRITE_HEAD_LIFT_FALLBACK as BABYLON_SPRITE_HEAD_LIFT_FALLBACK,
  SPRITE_PIXELS_PER_UNIT as BABYLON_SPRITE_PIXELS_PER_UNIT,
  TILE_CURSOR_WIDTH as BABYLON_TILE_CURSOR_WIDTH,
  TILE_HEIGHT_SCALE as BABYLON_TILE_HEIGHT_SCALE,
  TILE_HIGHLIGHT_ALPHA as BABYLON_TILE_HIGHLIGHT_ALPHA,
  TILE_MIN_HEIGHT as BABYLON_TILE_MIN_HEIGHT,
  TILE_OUTLINE_Y_OFFSET as BABYLON_TILE_OUTLINE_Y_OFFSET,
  TILE_RANGE_OUTLINE_WIDTH as BABYLON_TILE_RANGE_OUTLINE_WIDTH,
  VIEW_SIZE as BABYLON_VIEW_SIZE,
  ZOOM_MAX as BABYLON_ZOOM_MAX,
  ZOOM_MIN as BABYLON_ZOOM_MIN,
  ZOOM_STEP as BABYLON_ZOOM_STEP,
} from "@pokemon-tactic/view-core";

/** Scene clear colour (rgb 0..1) — Babylon `Color4`-shaped (Three uses a hex). */
export const BABYLON_CLEAR_COLOR = { r: 0x1a / 255, g: 0x1a / 255, b: 0x2e / 255 } as const;

/**
 * Transparent draw-order indices (lower drawn first). Babylon sorts transparent
 * meshes by `alphaIndex` (Three sorts by `renderOrder` instead). The ground shadow
 * draws before tall-grass so grass on the same tile covers it.
 *
 * ⚠️ Convention: ANY new ALPHABLEND mesh in the combat scene MUST set an explicit
 * `alphaIndex` — the default `Number.MAX_VALUE` draws it last and the ortho-camera
 * distance sort can flip the order on a camera rotation.
 */
export const BABYLON_SHADOW_ALPHA_INDEX = 0;
export const BABYLON_FIELD_TERRAIN_ALPHA_INDEX = 2;
export const BABYLON_TILE_PREVIEW_ALPHA_INDEX = 3;

/**
 * Window-depth bias pulling a sprite's flattened foot depth toward the camera so it
 * wins the depth tie against its own tile/shadow while taller terrain still occludes.
 * Babylon-only (the X-ray silhouette + `SpriteDepthPlugin` are not ported to Three).
 */
export const BABYLON_SPRITE_DEPTH_BIAS = 0.0025;
/** Extra foot-depth bias during an attack lunge (Babylon-only). */
export const BABYLON_ATTACK_DEPTH_BIAS = 0.012;
/** Opacity of the team-coloured X-ray silhouette over occluding terrain (Babylon-only). */
export const BABYLON_SILHOUETTE_ALPHA = 1;

/** Polygon depth-offset of the highlight/cursor fill quads (Three uses polygonOffsetUnits). */
export const BABYLON_TILE_HIGHLIGHT_Z_OFFSET = -2;

/**
 * Rendering-group layering of the combat scene (each tested against the depth of the
 * groups before it; Three has no equivalent and uses `renderOrder`):
 *  0 = terrain + decorations + ground shadows · 1 = X-ray silhouettes · 2 = sprite
 *  billboards · 3 = hover cursor + world-anchored HUD.
 */
/** Entry-hazard voxel props sit on the ground (group 0) so terrain occludes them and sprites draw over. */
export const BABYLON_ENTRY_HAZARD_RENDERING_GROUP = 0;
export const BABYLON_SILHOUETTE_RENDERING_GROUP = 1;
export const BABYLON_SPRITE_RENDERING_GROUP = 2;
export const BABYLON_HOVER_CURSOR_RENDERING_GROUP = 3;
export const BABYLON_HUD_RENDERING_GROUP = 3;

/** Tile-centre debug marker colour (rgb 0..1). */
export const BABYLON_TILE_CENTER_MARKER_COLOR = { r: 1, g: 1, b: 0 } as const;
/** Tile-edge debug grid colour (rgb 0..1). */
export const BABYLON_TILE_GRID_COLOR = { r: 0, g: 1, b: 1 } as const;
/** World-Y lift of the debug tile-grid lines above the tile top (z-fight guard). */
export const BABYLON_TILE_GRID_Z_OFFSET = 0.01;
