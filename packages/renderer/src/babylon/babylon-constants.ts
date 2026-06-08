/**
 * Visual constants for the Babylon 2D-HD renderer (Phase 5).
 *
 * Centralised here (not scattered inline) per the renderer rule. These are
 * 3D-renderer-specific and will be folded into `docs/design-system.md` during
 * Jalon 2 (overlay UI contract + design-system harmonisation).
 */

/** Brightness multiplier applied to a reused top texture when used as a side flank. */
export const BABYLON_SIDE_DARKEN = 0.65;

/**
 * Orthographic frustum half-extent (world units) at zoom 1, along the shorter
 * (vertical) axis. The horizontal half-extent is derived from the aspect ratio
 * so the scene fills any canvas ratio (no letterbox — décision #472).
 */
export const BABYLON_VIEW_SIZE = 13;

/** Distance of the camera from its target along the view direction (ortho: only fixes near/far framing). */
export const BABYLON_CAMERA_DISTANCE = 20;

/** Mouse-wheel zoom clamp (multiplier on the ortho frustum). */
export const BABYLON_ZOOM_MIN = 0.4;
export const BABYLON_ZOOM_MAX = 3;

/** Per-notch zoom multiplier applied on mouse wheel. */
export const BABYLON_ZOOM_STEP = 1.1;

/** Scene light intensities (unlit-ish flat look; terrain/sprite materials disable lighting anyway). */
export const BABYLON_HEMI_LIGHT_INTENSITY = 0.8;
export const BABYLON_DIRECTIONAL_LIGHT_INTENSITY = 0.6;

/** Below this azimuth delta (radians) the camera turn snaps to its target. */
export const BABYLON_AZIMUTH_LERP_EPSILON = 0.001;

/** Fallback sprite frame duration (ms) when the atlas carries no per-frame PMD durations. */
export const BABYLON_DEFAULT_FRAME_DURATION_MS = 100;

/**
 * Real time (ms) of one PMD AnimData duration tick. PMDCollab `<Durations>` give a
 * per-frame tick count; the 2D renderer played them at 33 ms/tick (≈30 fps). Tuned
 * down to 24 ms/tick (≈1.4× faster) — sprites read snappier than the Phaser baseline.
 */
export const BABYLON_PMD_TICK_DURATION_MS = 24;

/** Frame tick count assumed for a frame the atlas left without a duration (matches the 2D renderer's fallback). */
export const BABYLON_PMD_DEFAULT_FRAME_TICKS = 4;

/** Dimetric (2:1 isometric) elevation angle: atan(1/√2) ≈ 35.26°. */
export const BABYLON_DIMETRIC_ELEVATION = Math.atan(1 / Math.sqrt(2));

/** Default combat camera azimuth — the canonical 45° iso view. */
export const BABYLON_CAMERA_AZIMUTH = Math.PI / 4;

/** Camera rotates in 90° snaps so it only ever rests on one of the 4 iso views. */
export const BABYLON_AZIMUTH_STEP = Math.PI / 2;

/** Smooth-turn lerp factor per second for the 90° camera rotation. */
export const BABYLON_ROTATION_LERP = 5;

/** Smooth-pan lerp factor per second for recentering the camera on the active Pokémon. */
export const BABYLON_CAMERA_PAN_LERP = 6;
/** World distance below which the camera pan snaps to its goal (stops easing). */
export const BABYLON_CAMERA_PAN_EPSILON = 0.01;

/**
 * Sprite source pixels per world unit (validated 2026-06-08): 24 matches the
 * 24px/unit terrain texture density (≈1:1 pixel parity). See
 * `babylon-2d-overlay-scaling.md`.
 */
export const BABYLON_SPRITE_PIXELS_PER_UNIT = 24;

/** Scene clear colour (rgb 0..1) — matches the existing dark UI background. */
export const BABYLON_CLEAR_COLOR = { r: 0x1a / 255, g: 0x1a / 255, b: 0x2e / 255 } as const;

/**
 * Minimum tile body height (world units). Real tiles are `1` (full) or `0.5`
 * (half) — matching the 2D pipeline where 1 elevation = 1 unit cube
 * (TILE_ELEVATION_STEP = TILE_HEIGHT = 16px). Floor guards empty/0 values.
 */
export const BABYLON_TILE_MIN_HEIGHT = 0.5;

/**
 * Vertical squash of every tile body (side-wall height only — the top diamond /
 * footprint is unchanged). A raw unit cube reads too tall in the iso view; the 2D
 * pipeline drew the side wall at half the tile width (TILE_ELEVATION_STEP 16 :
 * TILE_WIDTH 32). Scaling the world height by ~0.866 makes the projected wall match
 * that 0.5 : 1 wall-to-width ratio at the 35.26° camera. Tunable.
 */
export const BABYLON_TILE_HEIGHT_SCALE = 0.866;

/**
 * Ground shadow disc radius (world units) per PMDCollab `shadowSize` (0 small,
 * 1 medium, 2 large), read from each Pokemon's `offsets.json`. Medium (1) is
 * pinned to the 2D renderer's fixed value (`TILE_WIDTH * 0.4` diameter → 0.2);
 * small/large fan out around it. The iso ground tilt flattens the disc into a
 * ~2:1 ellipse on its own.
 */
export const BABYLON_SHADOW_RADIUS_BY_SIZE: Readonly<Record<number, number>> = {
  0: 0.14,
  1: 0.2,
  2: 0.3,
};

/** Fallback shadow radius when shadowSize is missing/unknown. */
export const BABYLON_SHADOW_RADIUS_DEFAULT = 0.2;

/** Ground shadow opacity (0..1). */
export const BABYLON_SHADOW_ALPHA = 0.3;

/**
 * Transparent draw-order indices (lower drawn first). Among transparent meshes
 * Babylon sorts by alphaIndex, NOT by the foot-depth plugin (which only affects
 * the depth TEST). The Pokémon ground shadow draws before tall-grass so grass on
 * the same tile covers the shadow (unit + shadow both behind the grass blades).
 *
 * ⚠️ Convention: ANY new ALPHABLEND (transparent) mesh in the combat scene MUST
 * set an explicit `alphaIndex`. The default `Number.MAX_VALUE` draws it last
 * (over everything), and ortho-camera distance sort can flip the order on a
 * camera rotation — both invisible until they bite.
 */
export const BABYLON_SHADOW_ALPHA_INDEX = 0;
/** Field-terrain ("Champs") fill draws above the ground shadow (a zone tint over the terrain). */
export const BABYLON_FIELD_TERRAIN_ALPHA_INDEX = 2;
/** Attack-target preview fills draw above everything else (the player's current focus). */
export const BABYLON_TILE_PREVIEW_ALPHA_INDEX = 3;
/** World-Y lift (tiles) so a floating combat label rises off the sprite's head, not the floor. */
export const BABYLON_FLOATING_TEXT_LIFT = 1.0;
/**
 * Fraction of a jump step over which the vertical move happens, confined to the
 * step's safe half so the sprite tops a cliff before crossing its edge (the
 * X-ray silhouette pass would otherwise reveal it clipping the wall). ≤ 0.5
 * guarantees the apex is reached by the horizontal midpoint (the cliff edge).
 */
export const BABYLON_JUMP_VERTICAL_LEAD = 0.45;
/** Safety cap (ms) so an attack animation never hangs the queue (missing anim / scene torn down). */
export const BABYLON_ATTACK_ANIMATION_MAX_MS = 1000;
/** Peak world-X amplitude (tiles) of the knockback-blocked shake (plan 123 4d-2). */
export const BABYLON_KNOCKBACK_SHAKE_AMPLITUDE = 0.12;
/** Total duration (ms) of the knockback-blocked shake (mirrors Phaser duration × yoyo × repeat). */
export const BABYLON_KNOCKBACK_SHAKE_DURATION_MS = 250;
/** Number of left-right oscillations within the knockback-blocked shake. */
export const BABYLON_KNOCKBACK_SHAKE_CYCLES = 3;
/** Peak roll angle (radians) of the confusion wobble (mirror Phaser CONFUSION_WOBBLE_ANGLE = 5°). Plan 123 4d-6. */
export const BABYLON_CONFUSION_WOBBLE_ANGLE = (5 * Math.PI) / 180;
/** Full back-and-forth period (ms) of the confusion wobble sine (= Phaser 300ms half × 2 yoyo × 2 dirs). Plan 123 4d-6. */
export const BABYLON_CONFUSION_WOBBLE_PERIOD_MS = 1200;
/** Dimmest emissive grey of the confirm-attack preview flash pulse (parity: Phaser fades alpha). Plan 123 4d-3. */
export const BABYLON_PREVIEW_FLASH_DIM_EMISSIVE = 0.35;
/** Full period (ms) of the preview-flash emissive sine pulse (= Phaser PREVIEW_FLASH_DURATION_MS × 2 yoyo). Plan 123 4d-3. */
export const BABYLON_PREVIEW_FLASH_PERIOD_MS = 600;

/** World-Y offset lifting the shadow disc just above the tile top (z-fight guard). */
export const BABYLON_SHADOW_GROUND_OFFSET = 0.02;

/**
 * Vertical lift (source px) of a sprite above the tile-top center. The Phaser
 * renderer used `POKEMON_SPRITE_GROUND_OFFSET_Y = -2` (screen +y down → up);
 * tuned higher here for the 3D look. Converted to world units via pixels-per-world-unit.
 */
export const BABYLON_SPRITE_GROUND_OFFSET_PX = 5;

/** Extra source px above the PMD head where world-anchored HUD (HP bar) sits. (Phaser used 16.) */
export const BABYLON_HUD_ANCHOR_MARGIN_PX = 20;

/**
 * Window-depth bias (0..1) pulling a sprite's flattened foot depth slightly
 * toward the camera, so it wins the depth tie against its own tile top / shadow
 * (coplanar) while still being occluded by genuinely taller terrain in front.
 */
export const BABYLON_SPRITE_DEPTH_BIAS = 0.0025;

/**
 * Extra foot-depth bias applied only while a sprite plays its attack lunge, so a
 * coplanar (same-height) tile in front no longer clips the enlarged attack frame —
 * yet kept well under one terrain height step so a genuinely taller tile / pillar
 * still occludes the attacker normally (decision: attack draws over same-level only).
 */
export const BABYLON_ATTACK_DEPTH_BIAS = 0.012;

/**
 * Opacity of the team-coloured X-ray silhouette drawn over terrain where a sprite
 * is occluded (so units behind cliffs/walls stay readable). 1 = solid fill.
 */
export const BABYLON_SILHOUETTE_ALPHA = 1;

/**
 * Polygon depth-offset of the highlight / cursor fill quads (negative = pulled
 * toward the camera). Lets them win the depth tie against the coplanar tile top
 * WITHOUT a world-Y lift — a lift would shift the quad in the ortho projection
 * and bleed its colour over the upper rim of the side walls.
 */
export const BABYLON_TILE_HIGHLIGHT_Z_OFFSET = -2;

/** Tiny world-Y lift of the range OUTLINE lines above the tile top (z-fight guard for lines). */
export const BABYLON_TILE_OUTLINE_Y_OFFSET = 0.02;

/** Thickness (world units) of the hover tile cursor's stroked outline (GreasedLine, zoom-attenuated). */
export const BABYLON_TILE_CURSOR_WIDTH = 0.05;

/** Thickness (world units) of the attack/move range perimeter outline (GreasedLine). */
export const BABYLON_TILE_RANGE_OUTLINE_WIDTH = 0.06;

/**
 * Thickness (world units) of a field-terrain ("Champs") zone perimeter (GreasedLine,
 * see decisions.md). Slightly thinner than the hover cursor so a zone the cursor
 * sits on stays readable.
 */
export const BABYLON_FIELD_TERRAIN_OUTLINE_WIDTH = 0.04;

/** Fill opacity of a field-terrain zone (standard alpha blend — see decisions.md). */
export const BABYLON_FIELD_TERRAIN_FILL_ALPHA = 0.3;

/**
 * Fill opacity of the range highlights (move/attack/retreat). The 2D renderer
 * used 0.4 (IsometricGrid); enemy-range + outline alphas are shared from the
 * 2D `constants.ts`. The hover tile cursor is a stroked outline (no fill alpha).
 */
export const BABYLON_TILE_HIGHLIGHT_ALPHA = 0.4;

/** Tiny world-Y lift of a direction arrow above the tile top (sits over the spawn-zone fill). */
export const BABYLON_DIRECTION_ARROW_Y_OFFSET = 0.03;

/** Head-level lift (world units) used before a sprite's atlas resolves its real head offset (picker arrows + hover cursor). */
export const BABYLON_SPRITE_HEAD_LIFT_FALLBACK = 1;

/** Fraction of the way from the placed tile to its neighbour where the arrow sits (<1 pulls it closer to the Pokémon). */
export const BABYLON_DIRECTION_ARROW_TILE_FRACTION = 0.6;

/** Emissive glow (rgb 0..1) added to the selected direction arrow; the others stay un-emissive. */
export const BABYLON_DIRECTION_ARROW_ACTIVE_EMISSIVE = { r: 0.55, g: 0.5, b: 0.15 } as const;

/** Pointer travel (px) above which a left press counts as a camera pan, not a tile click. */
export const BABYLON_PICK_DRAG_THRESHOLD_PX = 5;

/**
 * World-Y drop of a decoration's base from the tile-top centre toward the tile's
 * near (front) vertex, so a rock/tree reads as planted ON its tile rather than
 * floating at the diamond centre (2D renderer anchored at the front vertex,
 * `center.y + TILE_HEIGHT/2`). Tuned visually.
 */
export const BABYLON_DECORATION_FOOT_DROP = 0.4;

/**
 * Foot-depth bias of decorations — slightly stronger than `BABYLON_SPRITE_DEPTH_BIAS`
 * so a rock/tree on a tile always draws IN FRONT of a Pokémon sharing that tile
 * (unit stands behind the tree / inside the bush). A unit one tile nearer still
 * wins (tile-to-tile depth gap ≫ this bias).
 */
export const BABYLON_DECORATION_DEPTH_BIAS = 0.005;

/** World-Y lift of a Pokémon while in the Flying (Vol) semi-invulnerable state (≈2 tiles up). */
export const BABYLON_SEMI_INVULNERABLE_LIFT = 1.5;

/** Period (ms) of the active-Pokémon scale pulse (one full min→max→min breath). */
export const BABYLON_PULSE_PERIOD_MS = 900;

/** Emissive grey level (0..1) a sprite dims to on the dark half-cycle of a damage flash. */
export const BABYLON_DAMAGE_FLASH_DIM_EMISSIVE = 0.25;

/** World-Y gap between a Pokémon's HUD anchor (above its head) and the floating FFTA hover cursor tip. */
export const BABYLON_HOVER_CURSOR_GAP = 0.35;

/**
 * Rendering-group layering of the combat scene (each tested against the depth of
 * the groups before it, autoClearDepthStencil disabled — see combat-scene):
 *  0 = terrain + decorations + ground shadows (write depth)
 *  1 = X-ray silhouettes — tested vs group 0 only, so a Pokémon shows its silhouette
 *      ONLY behind terrain/decor, never behind another Pokémon (sprites come later)
 *  2 = sprite billboards — write depth, occlude each other normally
 *  3 = FFTA hover cursor — always on top of the hovered Pokémon
 */
export const BABYLON_SILHOUETTE_RENDERING_GROUP = 1;
export const BABYLON_SPRITE_RENDERING_GROUP = 2;
export const BABYLON_HOVER_CURSOR_RENDERING_GROUP = 3;
/**
 * World-anchored HUD (HP bars, status icons, damage numbers, floating combat text,
 * Champ counter pills) — rendered IN ENGINE (decision #487), not DOM-projected.
 * Shares the top group (3): depth is cleared before it, so the HUD always draws over
 * the sprites + terrain (parity with the Phaser high-depth HP bar).
 */
export const BABYLON_HUD_RENDERING_GROUP = 3;

/** HP bar geometry (world units = tiles). Tuned to match the validated 2D sizing. */
export const BABYLON_HP_BAR_WIDTH = 0.78;
export const BABYLON_HP_BAR_HEIGHT = 0.12;
/** Status icon edge length (world units), sitting just right of the HP bar. */
export const BABYLON_HUD_STATUS_ICON_SIZE = 0.26;
/** Gap between the HP bar's right edge and the status icon (world units). */
export const BABYLON_HUD_STATUS_GAP = 0.06;
// Aura left-indicators: proportional to the Phaser stack (HP_BAR_WIDTH 18px,
// LEFT_INDICATOR_FIRST_GAP 3, SLOT_OFFSET 5, icon font 5 → ×(0.78/18) world).
/** Team-aura icon edge length (world units), stacked left of the HP bar. */
export const BABYLON_HUD_AURA_ICON_SIZE = 0.22;
/** Gap from the HP bar's left edge to the first aura icon's centre (world units). */
export const BABYLON_HUD_AURA_FIRST_GAP = 0.13;
/** Centre-to-centre spacing between stacked aura icons (world units; ≈ icon size = tight). */
export const BABYLON_HUD_AURA_SLOT_OFFSET = 0.22;
/** Aura ground hover-icon plane height (world units), shown over each aura-radius tile. */
export const BABYLON_AURA_HOVER_ICON_HEIGHT = 0.28;
/** Cross-layout offset (world units) between the symbols laid over one aura tile (Phaser 5px). */
export const BABYLON_AURA_HOVER_ICON_OFFSET = 0.2;
/** World-Y lift of the aura ground hover icons above each tile top (sits on the tile). */
export const BABYLON_AURA_HOVER_ICON_LIFT = 0.12;
/** Damage-preview number plane height (world units), sitting just above the bar. */
export const BABYLON_HUD_DAMAGE_TEXT_HEIGHT = 0.52;
/** Gap from the bar top to the damage-preview number (world units; ~0 = bottom touches bar). */
export const BABYLON_HUD_DAMAGE_TEXT_GAP = 0.0;
/** Floating combat text plane height (world units) for the primary tier. */
export const BABYLON_FLOATING_TEXT_HEIGHT = 0.62;
/** Secondary-tier floating text scale (e.g. "Super efficace!"). */
export const BABYLON_FLOATING_TEXT_SECONDARY_SCALE = 0.8;
/** World-Y rise of a floating combat label over its lifetime (parity BATTLE_TEXT_DRIFT_Y). */
export const BABYLON_FLOATING_TEXT_RISE = 0.7;
/** Champ counter pill plane height (world units). */
export const BABYLON_CHAMP_PILL_HEIGHT = 0.5;
/** World-Y lift of the Champ counter badge above its anchor tile top (≈ on the tile, like Phaser). */
export const BABYLON_CHAMP_PILL_LIFT = 0.25;
/** Font size (px) used when rasterising HUD text onto a DynamicTexture canvas. */
export const BABYLON_HUD_TEXT_FONT_PX = 32;
/** Padding (px) around rasterised HUD text on its DynamicTexture canvas. */
export const BABYLON_HUD_TEXT_PADDING_PX = 8;

/** Tile-centre debug marker colour (rgb 0..1). */
export const BABYLON_TILE_CENTER_MARKER_COLOR = { r: 1, g: 1, b: 0 } as const;

/** Tile-edge debug grid colour (rgb 0..1). */
export const BABYLON_TILE_GRID_COLOR = { r: 0, g: 1, b: 1 } as const;

/** World-Y lift of the debug tile-grid lines above the tile top (z-fight guard). */
export const BABYLON_TILE_GRID_Z_OFFSET = 0.01;
