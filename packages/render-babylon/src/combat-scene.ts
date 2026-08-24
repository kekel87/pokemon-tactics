import { Engine } from "@babylonjs/core/Engines/engine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { type Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { Direction, directionFromTo, TerrainType } from "@pokemon-tactic/core";
import type {
  CombatPokemonHandle,
  CombatScene,
  CombatSceneSpawn,
  DirectionPickerCallbacks,
  DirectionPickerHandle,
  ScreenDirection,
  TilePointerSource,
} from "@pokemon-tactic/render-ports";
import {
  FLYING_GLIDE_CANDIDATES,
  getFlyingAnimationMode,
  getResolvedAtlas,
  isFlyoverTerrain,
  isLiquidGroup,
  loadTiledMap,
  type MovementStep,
  type MovementVerticalMode,
  movementVerticalMode,
  selectMovementAnimation,
  selectMovementDuration,
  worldFacingFromDirection,
} from "@pokemon-tactic/view-core";
import { type AuraRingSpec, type AuraRings, createAuraRings } from "./babylon-aura-rings.js";
import { hexToColor3 } from "./babylon-color.js";
import { BabylonCompass, type TimelineFirstCell } from "./babylon-compass.js";
import {
  BABYLON_ATTACK_ANIMATION_MAX_MS,
  BABYLON_CLEAR_COLOR,
  BABYLON_DIRECTION_ARROW_TILE_FRACTION,
  BABYLON_DIRECTIONAL_LIGHT_INTENSITY,
  BABYLON_FLOATING_TEXT_HEIGHT,
  BABYLON_FLOATING_TEXT_LIFT,
  BABYLON_FLOATING_TEXT_RISE,
  BABYLON_FLOATING_TEXT_SECONDARY_LIFT,
  BABYLON_FLOATING_TEXT_SECONDARY_SCALE,
  BABYLON_HEMI_LIGHT_INTENSITY,
  BABYLON_HOVER_CURSOR_GAP,
  BABYLON_HUD_RENDERING_GROUP,
  BABYLON_JUMP_VERTICAL_LEAD,
  BABYLON_KNOCKBACK_SHAKE_AMPLITUDE,
  BABYLON_KNOCKBACK_SHAKE_CYCLES,
  BABYLON_KNOCKBACK_SHAKE_DURATION_MS,
  BABYLON_LIQUID_DEPTH_RATIO,
  BABYLON_LIQUID_FOAM_COLOR_BY_GROUP,
  BABYLON_LIQUID_FOAM_COLOR_DEFAULT,
  BABYLON_LIQUID_SURFACE_RATIO,
  BABYLON_SPRITE_HEAD_LIFT_FALLBACK,
  BABYLON_SPRITE_PIXELS_PER_UNIT,
} from "./babylon-constants.js";
import { createDecorations, type Decorations } from "./babylon-decorations.js";
import { createDirectionArrows } from "./babylon-direction-picker.js";
import {
  createEntryHazardProps,
  type EntryHazardSpec,
  type EntryHazards,
} from "./babylon-entry-hazards.js";
import {
  createFieldTerrains,
  type FieldTerrainSpec,
  type FieldTerrains,
} from "./babylon-field-terrains.js";
import { BabylonHoverCursor } from "./babylon-hover-cursor.js";
import { pickTile, type TilePick } from "./babylon-picking.js";
import { createSpriteHud, type SpriteHudHandle } from "./babylon-sprite-hud.js";
import { createTextPlane } from "./babylon-text-plane.js";
import { createTileHighlights, type TileHighlights } from "./babylon-tile-highlights.js";
import {
  BATTLE_TEXT_DURATION_MS,
  BATTLE_TEXT_STROKE_COLOR,
  MOVE_TWEEN_DURATION_MS,
  SUBSTITUTE_SPRITE_ID,
  TILE_PREVIEW_BUFF_COLOR,
  teamColorByIndex,
} from "./constants.js";
import { DirectionalBillboard } from "./directional-billboard.js";
import { installE2eSceneHook } from "./e2e-debug-hook.js";
import { IsometricCamera } from "./isometric-camera.js";
import { type ExtrudedTerrain, extrudeTerrain, tileTopCenter } from "./terrain-extruder.js";

// The engine-agnostic combat-scene contract (CombatScene, CombatPokemonHandle,
// CombatSceneSpawn, DirectionPicker*) lives in render-ports (plan 126 F1);
// re-exported here so the Babylon index + its importers keep resolving.
export type {
  CombatPokemonHandle,
  CombatScene,
  CombatSceneSpawn,
  DirectionPickerCallbacks,
  DirectionPickerHandle,
};

/** Babylon-specific scene options — carries the DOM canvas, so it stays out of the contract. */
export interface CombatSceneOptions {
  canvas: HTMLCanvasElement;
  mapUrl: string;
  pokemon: readonly CombatSceneSpawn[];
  /** Floating FFTA tile cursor on hover (default true; off for the map-select preview). */
  showHoverCursor?: boolean;
  /**
   * Geometry of the turn timeline's first portrait in CSS px (plan 183). The compass matches its
   * size and lines its top-left corner up with the portrait's top-right — every constant of my own
   * drifted (behind the timeline, floating, sliding on resize). Injected rather than measured here:
   * the renderer must not read the chrome.
   */
  timelineFirstCell?: () => TimelineFirstCell | null;
}

const ALL_DIRECTIONS = [Direction.North, Direction.South, Direction.East, Direction.West] as const;

/** Quadratic ease-out — fast start, slow finish (jump ascent: top the cliff early). */
function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/** Quadratic ease-in — slow start, fast finish (jump descent: stay high, drop late). */
function easeInQuad(t: number): number {
  return t * t;
}

/**
 * Vertical progress of a jump step, decoupled from the linear horizontal one so
 * the sprite tops the cliff *before* it slides over the edge — the Babylon X-ray
 * silhouette pass (renderingGroup 1) exposes any mid-step penetration that a
 * flat 2D draw order would hide. The whole vertical move is confined to the safe half
 * of the step (`BABYLON_JUMP_VERTICAL_LEAD`): ascent rises within the first
 * fraction, descent holds high then drops within the last fraction. So at the
 * horizontal midpoint (the cliff edge) the sprite already sits at the higher of
 * the two tiles and never clips the wall.
 */
function jumpVerticalProgress(progress: number, ascent: boolean): number {
  if (ascent) {
    return easeOutQuad(Math.min(1, progress / BABYLON_JUMP_VERTICAL_LEAD));
  }
  const dropStart = 1 - BABYLON_JUMP_VERTICAL_LEAD;
  return easeInQuad(Math.max(0, (progress - dropStart) / BABYLON_JUMP_VERTICAL_LEAD));
}

/** Min world-Y delta that turns a logically-flat move into a stair step (a liquid dip). */
const LIQUID_STEP_EPSILON = 0.01;

/**
 * Vertical curve for a small stair step (plan 166 — half-block terrain change or the
 * dip into a liquid). LINEAR (no hop ease): on an ascent the sprite steps up over the
 * first `BABYLON_JUMP_VERTICAL_LEAD` of the move then walks flat onto the ledge; on a
 * descent it walks flat to the edge then steps down over the last lead. Reads as an
 * L-shaped stair — never the straight diagonal a linear Y would draw.
 */
function stepVerticalProgress(progress: number, ascent: boolean): number {
  if (ascent) {
    return Math.min(1, progress / BABYLON_JUMP_VERTICAL_LEAD);
  }
  const dropStart = 1 - BABYLON_JUMP_VERTICAL_LEAD;
  return Math.max(0, (progress - dropStart) / BABYLON_JUMP_VERTICAL_LEAD);
}

/** Grid neighbour delta per facing (gridX→worldZ, gridY→worldX; matches placement-flow). */
const DIRECTION_NEIGHBOR: Readonly<Record<Direction, { dx: number; dy: number }>> = {
  [Direction.North]: { dx: 0, dy: -1 },
  [Direction.South]: { dx: 0, dy: 1 },
  [Direction.East]: { dx: 1, dy: 0 },
  [Direction.West]: { dx: -1, dy: 0 },
};

/**
 * Production combat-scene renderer (Jalon 3a): a Tiled map extruded to 3D with
 * stacked elevation layers, PMD directional billboards placed on it, and a
 * dimetric orthographic camera that snaps between the 4 iso views (rotation driven
 * by the app-side input layer, plan 184).
 * Sprites render in group 2 (after terrain group 0 and X-ray silhouettes group 1,
 * depth buffer kept) with `SpriteDepthPlugin` flattening each to its foot depth, so
 * taller terrain in front occludes it without the upright plane self-clipping into
 * its tile — and a Pokémon behind another is occluded normally, never X-rayed.
 *
 * This is the parity scene. The DOM HUD (HP bars, InfoPanel) and scene FSM are
 * wired at Jalon 4.
 */
export function createCombatScene(options: CombatSceneOptions): CombatScene {
  const {
    canvas,
    mapUrl,
    pokemon: pokemonSpawns,
    showHoverCursor = true,
    timelineFirstCell = () => null,
  } = options;

  const engine = new Engine(canvas, false, {
    preserveDrawingBuffer: false,
    stencil: false,
    antialias: false,
  });

  // Diagnostic de perte de contexte WebGL (plan 180-a §D). Backgrounder un onglet sur téléphone fait
  // récupérer la VRAM au système, ce qui perd le contexte — symptôme facile à confondre avec un
  // rechargement de page. Aucune récupération à écrire ici : l'`Engine` n'est PAS construit avec
  // `doNotHandleContextLost`, donc Babylon reconstruit déjà ses ressources tout seul. Ces deux
  // traces servent uniquement à trancher, dans un rapport de bug, entre « contexte perdu puis
  // restauré » et « onglet déchargé » (ce dernier cas = plan 180-c).
  engine.onContextLostObservable.add(() => {
    // biome-ignore lint/suspicious/noConsole: trace de diagnostic — Babylon gère la restauration seul
    console.warn("[render] WebGL context lost — Babylon will rebuild its resources");
  });
  engine.onContextRestoredObservable.add(() => {
    // biome-ignore lint/suspicious/noConsole: trace de diagnostic, pendant de la perte ci-dessus
    console.warn("[render] WebGL context restored");
  });

  const scene = new Scene(engine);

  /*
   * Babylon stamps `tabindex="1"` on the canvas so ITS keyboard observable can fire. We do not use
   * that observable — the app has a single `window` keydown listener (plan 184) — and the positive
   * tabindex cost us twice: the canvas became the FIRST tab stop of the page (a positive tabindex
   * jumps the queue, which `.claude/rules/html.md` forbids outright), and once focused the app-wide
   * `:focus-visible` ring drew a yellow outline around the whole battle scene (bug relevé par
   * l'humain, 2026-08-24). `-1` keeps it focusable by script — Babylon's pointer handling needs
   * nothing else — without ever putting it in the player's tab order.
   *
   * ⚠️ AFTER `new Scene(...)`, not after `new Engine(...)`: the Scene constructor attaches input
   * control, and that is what stamps the attribute. Setting it earlier is silently overwritten
   * (measured: the canvas was back to `tabindex="1"`).
   */
  canvas.tabIndex = -1;
  scene.clearColor = new Color4(
    BABYLON_CLEAR_COLOR.r,
    BABYLON_CLEAR_COLOR.g,
    BABYLON_CLEAR_COLOR.b,
    1,
  );
  let sceneIsReady = false;

  const isoCamera = new IsometricCamera(scene, engine);
  // Raw Babylon camera handle for projection/picking consumers (compass, arrows).
  const camera = isoCamera.camera;

  const hemisphericLight = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemisphericLight.intensity = BABYLON_HEMI_LIGHT_INTENSITY;
  const directional = new DirectionalLight("dir", new Vector3(-1, -2, -1), scene);
  directional.intensity = BABYLON_DIRECTIONAL_LIGHT_INTENSITY;

  // Keep the depth buffer across the rendering-group layers (see babylon-constants
  // BABYLON_*_RENDERING_GROUP). Group 1 silhouettes depth-test against terrain only
  // (group 0); group 2 sprites depth-test against that same terrain depth AND write
  // their own, so they occlude each other without ever feeding the silhouette test.
  scene.setRenderingAutoClearDepthStencil(1, false);
  scene.setRenderingAutoClearDepthStencil(2, false);

  // World-anchored per-sprite HP bars + status icons (Jalon 4d), rendered in
  // engine (decision #487) — billboarded quads parented to each sprite root.
  const spriteHud = createSpriteHud(scene);
  // Ground aura hover icons (symbols floated over a caster's aura radius).

  interface BillboardEntry {
    billboard: DirectionalBillboard;
    pokemonId: string;
    spawn: { x: number; y: number };
    /** Resolves once the atlas (and thus the real head offset) is loaded. */
    ready: Promise<void>;
    /** World HP bar + status icon anchored to this sprite's head. */
    overlay: SpriteHudHandle;
    /**
     * Whether this mon rests on the ground (plan 166). True by default; the orchestrator
     * flips it to false for a hovering flyer/levitator via `setGroundedByGravity`. A
     * grounded mon sinks its feet into a liquid tile; a hovering one stays above it.
     */
    grounded: boolean;
  }

  function createBillboard(entry: CombatSceneSpawn): BillboardEntry {
    const teamColor = teamColorByIndex(entry.team ?? 1);
    const billboard = new DirectionalBillboard({
      scene,
      atlas: getResolvedAtlas(entry.pokemonId),
      substituteAtlas: getResolvedAtlas(SUBSTITUTE_SPRITE_ID),
      animation: "Idle",
      worldFacing: entry.facing ?? 0,
      pixelsPerWorldUnit: BABYLON_SPRITE_PIXELS_PER_UNIT,
      teamColor,
    });
    const ready = billboard.load();
    // HUD parented to the sprite root (follows the glide); the head lift is re-read
    // each frame (0 until the atlas loads, then the real head offset).
    const overlay = spriteHud.add(
      billboard.root,
      () => billboard.spriteTopOffsetY || BABYLON_SPRITE_HEAD_LIFT_FALLBACK,
      teamColor,
    );
    return {
      billboard,
      pokemonId: entry.pokemonId,
      spawn: entry.spawn,
      ready,
      overlay,
      grounded: true,
    };
  }

  const billboards = pokemonSpawns.map(createBillboard);
  // Tile → billboard lookup, to lift the cursor to a Pokémon's head on hover.
  const billboardByTile = new Map<string, BillboardEntry>();
  for (const entry of billboards) {
    billboardByTile.set(`${entry.spawn.x},${entry.spawn.y}`, entry);
  }
  // Dynamically added Pokemon (placement phase) — handle → entry for removal.
  const entryByHandle = new Map<CombatPokemonHandle, BillboardEntry>();

  const directionArrows = createDirectionArrows(scene);
  // Open placement direction picker (null when none). Holds the live callbacks,
  // the currently-previewed facing (so hover only fires onPreview on change) and
  // the tile being placed on (the pivot the pointer direction is measured from).
  let directionPicker: {
    callbacks: DirectionPickerCallbacks;
    current: Direction;
    center: { x: number; y: number };
    /**
     * Facing a finger has previewed on this picker, if any (plan 183). Touch has no hover, so a tap
     * previews and only a tap of the SAME facing confirms. Storing the direction rather than a
     * "has previewed" flag is the point: with a flag, changing your mind confirmed the new facing
     * immediately instead of showing it first (human 2026-08-20). Unused on the mouse path.
     */
    touchAimedDirection?: Direction;
  } | null = null;
  function closeDirectionPicker(): void {
    directionArrows.hide();
    directionPicker = null;
  }

  /**
   * Fire a real `pointerdown`/`pointerup` pair over a tile, as a finger would (plan 183, e2e hook).
   * Goes through the DOM listeners rather than calling the handlers, so a test drives the SAME code
   * path a player does — two-step tap included. Returns false while the map has no geometry yet.
   */
  function dispatchSyntheticTap(tileX: number, tileY: number): boolean {
    if (!tileWorldTop) {
      return false;
    }
    const top = tileWorldTop(tileX, tileY);
    const projected = projectWorld(new Vector3(top.x, top.y, top.z));
    const rect = canvas.getBoundingClientRect();
    const init: PointerEventInit = {
      pointerId: 1,
      // Literal rather than a shared constant: since plan 184 the gesture rules (and the
      // `pointerType` families they read) live in the app's input layer, and the renderer must not
      // depend on it. What matters is that this string is what a real finger reports.
      pointerType: "touch",
      button: 0,
      buttons: 1,
      clientX: rect.left + projected.x,
      clientY: rect.top + projected.y,
      bubbles: true,
      cancelable: true,
    };
    canvas.dispatchEvent(new PointerEvent("pointerdown", init));
    window.dispatchEvent(new PointerEvent("pointerup", { ...init, buttons: 0 }));
    return true;
  }

  // Scratch matrix for projecting a tile centre to canvas px (direction picking).
  const directionProjection = new Matrix();
  function projectWorld(point: Vector3): { x: number; y: number } {
    camera.getViewMatrix().multiplyToRef(camera.getProjectionMatrix(), directionProjection);
    const projected = Vector3.TransformCoordinates(point, directionProjection);
    return {
      x: ((projected.x + 1) / 2) * canvas.clientWidth,
      y: ((1 - projected.y) / 2) * canvas.clientHeight,
    };
  }

  /**
   * Grid neighbour of `centerTile` whose SCREEN offset best matches a screen-space vector.
   *
   * One helper for the three things that need it: the pointer aiming a facing (vector = pointer
   * minus centre), an arrow key stepping the cursor, and an arrow key aiming a facing (vector = the
   * pressed screen diagonal). Re-projected on every call, so it tracks the camera's rotation and
   * zoom instead of assuming an azimuth.
   */
  function bestNeighborForScreenVector(
    centerTile: { x: number; y: number },
    vectorX: number,
    vectorY: number,
  ): { direction: Direction; x: number; y: number } | null {
    if (!tileWorldTop) {
      return null;
    }
    const center = tileWorldTop(centerTile.x, centerTile.y);
    const centerScreen = projectWorld(new Vector3(center.x, center.y, center.z));
    const aimLength = Math.hypot(vectorX, vectorY) || 1;
    let best: { direction: Direction; x: number; y: number } | null = null;
    let bestDot = Number.NEGATIVE_INFINITY;
    for (const direction of ALL_DIRECTIONS) {
      const { dx, dy } = DIRECTION_NEIGHBOR[direction];
      const neighbor = tileWorldTop(centerTile.x + dx, centerTile.y + dy);
      const neighborScreen = projectWorld(new Vector3(neighbor.x, neighbor.y, neighbor.z));
      const neighborX = neighborScreen.x - centerScreen.x;
      const neighborY = neighborScreen.y - centerScreen.y;
      const length = Math.hypot(neighborX, neighborY) || 1;
      const dot = (vectorX * neighborX + vectorY * neighborY) / (aimLength * length);
      if (dot > bestDot) {
        bestDot = dot;
        best = { direction, x: centerTile.x + dx, y: centerTile.y + dy };
      }
    }
    return best;
  }

  /**
   * Direction whose neighbour tile lies closest (by screen angle) to the pointer,
   * measured from the placed Pokémon's tile. Mouse-driven (not arrow-picking) so
   * the whole screen is a generous hit area. Returns null before the map loads.
   */
  function directionFromPointer(
    centerTile: { x: number; y: number },
    pointerX: number,
    pointerY: number,
  ): Direction | null {
    if (!tileWorldTop) {
      return null;
    }
    const center = tileWorldTop(centerTile.x, centerTile.y);
    const centerScreen = projectWorld(new Vector3(center.x, center.y, center.z));
    return (
      bestNeighborForScreenVector(centerTile, pointerX - centerScreen.x, pointerY - centerScreen.y)
        ?.direction ?? null
    );
  }

  const hoverCursor = showHoverCursor ? new BabylonHoverCursor(scene) : null;
  // Always-on map compass (screen-pinned; turns with the camera to keep pointing world-North).
  const compass = showHoverCursor
    ? new BabylonCompass(scene, camera, timelineFirstCell, () => canvas.clientWidth)
    : null;
  const hoverHead = new Vector3();
  /**
   * Tile the cursor rests on, whatever put it there — a mouse hover, a finger tap or an arrow key
   * (plan 184). Confirm validates it, and an arrow steps from it.
   *
   * It is deliberately NOT cleared when the action menu opens: coming back to the board must
   * resume where the player left the cursor, not walk across the map again.
   */
  let cursorPick: TilePick | null = null;
  /** Last tile the camera was centred on — where a keyboard cursor starts if nothing hovered yet. */
  let cameraFocusTile: TilePick | null = null;

  let terrain: ExtrudedTerrain | null = null;
  let decorations: Decorations | null = null;
  let highlights: TileHighlights | null = null;
  let fieldTerrains: FieldTerrains | null = null;
  // Field-terrain zones requested before the map finished loading (replayed on load).
  let pendingFieldTerrains: readonly FieldTerrainSpec[] = [];
  // Distorsion (Trick Room) zones — same zone renderer, distinct colour.
  let distortionZones: FieldTerrains | null = null;
  let pendingDistortionZones: readonly FieldTerrainSpec[] = [];
  // Permanent aura rings (plan 182) — stair-stepped ground outline per aura zone.
  let auraRings: AuraRings | null = null;
  let pendingAuraRings: readonly AuraRingSpec[] = [];
  // Entry-hazard traps (plan 131) — stacked voxel GLB props per kind + layer count.
  let entryHazards: EntryHazards | null = null;
  let pendingEntryHazards: readonly EntryHazardSpec[] = [];
  // World top-face centre of a tile, lifted onto any rock/tree top, set once the
  // map loads. Used for the cursor, sprite standing and flyer movement so they
  // rest on a decoration instead of clipping into it (decoration-patched
  // height). Decoration foot placement keeps the raw `heightAt`.
  let tileWorldTop: ((x: number, y: number) => { x: number; y: number; z: number }) | null = null;
  // Whether a cell is a liquid tile (plan 166) — grounded sprites sink into it. Set on load.
  let isLiquidAt: (x: number, y: number) => boolean = () => false;
  // Foam-band tint for a liquid cell (plan 166), null on non-liquid. Set on load.
  let liquidFoamColorAt: (x: number, y: number) => Color3 | null = () => null;
  // Per-tile terrain/height/slope lookups for per-step movement animation (plan 123 4d-5).
  let movementMap: {
    width: number;
    height: number;
    heightAt: (x: number, y: number) => number;
    terrainAt: (x: number, y: number) => TerrainType | undefined;
    isSlopeAt: (x: number, y: number) => boolean;
  } | null = null;
  let loadCancelled = false;
  const ready = loadTiledMap(mapUrl)
    .then((loaded) => {
      if (loadCancelled) {
        return;
      }
      terrain = extrudeTerrain(scene, loaded);
      const { width, height } = loaded.map;
      const heightAt = (x: number, y: number): number => loaded.visualTiles[y]?.[x]?.height ?? 0;
      // Raw terrain top + any rock/tree rendered height on that cell. Pokémon
      // never stand on obstacle cells except flyers/ghosts crossing them, so this
      // only lifts the cursor and flyers onto decorations; flat terrain is raw.
      const surfaceHeightAt = (x: number, y: number): number =>
        heightAt(x, y) + (decorations?.decorationHeightAt(x, y) ?? 0);
      tileWorldTop = (x, y) => tileTopCenter(x, y, surfaceHeightAt(x, y), width, height);
      isLiquidAt = (x, y) => {
        const group = loaded.visualTiles[y]?.[x]?.group;
        return group !== undefined && isLiquidGroup(group);
      };
      liquidFoamColorAt = (x, y) => {
        const group = loaded.visualTiles[y]?.[x]?.group;
        if (group === undefined || !isLiquidGroup(group)) {
          return null;
        }
        return hexToColor3(
          BABYLON_LIQUID_FOAM_COLOR_BY_GROUP[group] ?? BABYLON_LIQUID_FOAM_COLOR_DEFAULT,
        );
      };
      movementMap = {
        width,
        height,
        heightAt: surfaceHeightAt,
        terrainAt: (x, y) => loaded.map.tiles[y]?.[x]?.terrain,
        isSlopeAt: (x, y) => loaded.slopeData[y * width + x] != null,
      };
      decorations = createDecorations(scene, loaded.map, loaded.decorationObjects, heightAt);
      highlights = createTileHighlights(scene, surfaceHeightAt, width, height);
      fieldTerrains = createFieldTerrains(scene, heightAt, width, height);
      fieldTerrains.set(pendingFieldTerrains);
      distortionZones = createFieldTerrains(scene, heightAt, width, height);
      distortionZones.set(pendingDistortionZones);
      entryHazards = createEntryHazardProps(scene, heightAt, width, height);
      entryHazards.set(pendingEntryHazards);
      auraRings = createAuraRings(scene, heightAt, width, height);
      auraRings.set(pendingAuraRings);
      for (const entry of billboards) {
        positionOnTile(entry);
      }
      // Centre the camera on the map middle (sandbox + initial combat framing); the
      // turn loop later eases onto the active Pokémon. Without this the target stayed
      // at the world origin, so both the map and the rotation pivot were off-centre.
      const midX = (width - 1) / 2;
      const midY = (height - 1) / 2;
      const mapCenter = tileTopCenter(
        midX,
        midY,
        heightAt(Math.round(midX), Math.round(midY)),
        width,
        height,
      );
      isoCamera.frameOn(mapCenter.x, mapCenter.y, mapCenter.z);
    })
    .catch((error) => {
      // biome-ignore lint/suspicious/noConsole: surfacing a fatal asset load failure
      console.error("Failed to load map", mapUrl, error);
    });

  // ←/→ snap the camera by 90° between the 4 iso views (edge-triggered).
  /**
   * Cancel an open facing choice (plan 184). Previously an `Escape` keydown bound right here, which
   * had to call `stopImmediatePropagation()` so one press wouldn't also undo a placement; the input
   * layer now offers Cancel to the picker first and falls back to the phase cancel, so the
   * arbitration is explicit instead of depending on listener order.
   */
  /**
   * Screen vector each arrow / d-pad press aims at, as a canvas-pixel direction (plan 184).
   *
   * They are DIAGONALS, and that is the whole point: in a dimetric view the four grid axes project
   * to the four screen diagonals, so an "up" of (0,-1) would sit exactly between two grid axes and
   * tie. Aiming up-and-right instead lands on exactly one axis — the FFT / FFTA convention, where
   * pressing up walks the cursor diagonally up the board.
   */
  const SCREEN_DIRECTION_VECTOR: Readonly<Record<ScreenDirection, { x: number; y: number }>> = {
    up: { x: 1, y: -1 },
    right: { x: 1, y: 1 },
    down: { x: -1, y: 1 },
    left: { x: -1, y: -1 },
  };

  /**
   * Step the cursor one tile toward a screen direction.
   *
   * The grid step comes from PROJECTING the four neighbours and keeping the best match — not from a
   * per-azimuth lookup table. It self-corrects: rotate the camera, change the elevation or the
   * handedness, and the arrows keep pointing where the player looks, with no table to maintain.
   */
  function stepCursor(direction: ScreenDirection): void {
    const map = movementMap;
    if (!map) {
      return;
    }
    // No cursor yet (keyboard used before the mouse ever hovered): start from whatever the camera
    // last centred on, which is the active Pokémon at the top of each turn.
    const origin = cursorPick ?? cameraFocusTile;
    if (!origin) {
      return;
    }
    const aim = SCREEN_DIRECTION_VECTOR[direction];
    const best = bestNeighborForScreenVector(origin, aim.x, aim.y);
    // At a board edge the best candidate points off the grid: leave the cursor where it is rather
    // than sliding it sideways along the rim.
    if (best && best.x >= 0 && best.y >= 0 && best.x < map.width && best.y < map.height) {
      applyHover({ x: best.x, y: best.y });
    }
  }

  /**
   * Aim an open facing picker with an arrow / d-pad press (plan 184), previewing the new facing.
   * Returns false when no picker is open, so the caller can fall back to moving the tile cursor.
   *
   * Without this the keyboard could open the end-of-turn facing choice but never answer it — and
   * placement, which uses the same picker, could not place a single Pokémon.
   */
  function aimDirectionPicker(screenDirection: ScreenDirection): boolean {
    if (!directionPicker) {
      return false;
    }
    // Le curseur se pose sur la case du Pokemon : on y choisit une orientation, pas une case, donc
    // la rotation doit se lire comme tournant autour de lui (retour humain 2026-08-21).
    const { center } = directionPicker;
    cursorPick = { x: center.x, y: center.y };
    if (showHoverCursor) {
      highlights?.setCursor(cursorPick);
    }
    paintHoverCursor(cursorPick);
    const aim = SCREEN_DIRECTION_VECTOR[screenDirection];
    const best = bestNeighborForScreenVector(center, aim.x, aim.y);
    if (!best || best.direction === directionPicker.current) {
      return true;
    }
    directionPicker.current = best.direction;
    directionArrows.setActive(best.direction);
    directionPicker.callbacks.onPreview(best.direction);
    return true;
  }

  /** Commit the facing the picker currently shows. False when no picker is open. */
  function confirmDirectionPicker(): boolean {
    if (!directionPicker) {
      return false;
    }
    const { callbacks, current } = directionPicker;
    closeDirectionPicker();
    callbacks.onConfirm(current);
    return true;
  }

  function cancelDirectionPicker(): boolean {
    if (!directionPicker) {
      return false;
    }
    const { callbacks } = directionPicker;
    closeDirectionPicker();
    callbacks.onCancel();
    return true;
  }

  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    isoCamera.zoomByWheel(event.deltaY);
  };
  const onResize = (): void => {
    engine.resize();
    isoCamera.update();
  };

  // Tile picking callbacks (wired by the host — core/FSM lands at Jalon 4).
  const noop = (): void => {
    // Default until the host wires onTileHover / onTileClick.
  };
  let hoverHandler: (pick: TilePick | null) => void = noop;
  let clickHandler: (pick: TilePick, source: TilePointerSource) => void = noop;

  // Read-only e2e scene-graph hook (stripped from prod). clickTile drives the same handler a
  // real canvas pick would, so Playwright can pilot a turn. Installed here so `clickHandler` is
  // in scope; it reads the current handler at call time (reassigned by `onTileClick`).
  installE2eSceneHook(
    scene,
    () => sceneIsReady,
    (x, y) => clickHandler({ x, y }, "pointer"),
    (x, y) => hoverHandler({ x, y }),
    () => void confirmDirectionPicker(),
    () =>
      billboards.map((entry) => ({
        pokemonId: entry.pokemonId,
        animation: entry.billboard.currentAnimation,
        restingAnimation: entry.billboard.currentRestingAnimation,
        tile: { x: entry.spawn.x, y: entry.spawn.y },
        terrain: movementMap?.terrainAt(entry.spawn.x, entry.spawn.y),
      })),
    (x, y) => dispatchSyntheticTap(x, y),
    () => (cursorPick ? { x: cursorPick.x, y: cursorPick.y } : null),
  );

  /**
   * Paint the selection cursor on a tile and push it to the host. The FFTA cursor follows every
   * tile, lifted to the head when a Pokémon stands there; the tile cursor is its ground base.
   * Shared by the mouse hover and the first touch tap, which has to stand in for that hover.
   */
  /** Lift the 3D cursor onto a tile (head height when a Pokémon stands there), or hide it. */
  const paintHoverCursor = (pick: TilePick | null): void => {
    if (pick && tileWorldTop) {
      const top = tileWorldTop(pick.x, pick.y);
      const occupant = billboardByTile.get(`${pick.x},${pick.y}`);
      // Fall back to a fixed head lift while the sprite's atlas is still loading
      // (spriteTopOffsetY is 0 until then) so a freshly-placed Pokémon's cursor
      // still rides at head level instead of snapping to the ground.
      const headLift = occupant
        ? occupant.billboard.spriteTopOffsetY || BABYLON_SPRITE_HEAD_LIFT_FALLBACK
        : 0;
      hoverHead.set(top.x, top.y + headLift + BABYLON_HOVER_CURSOR_GAP, top.z);
      hoverCursor?.showAt(hoverHead);
    } else {
      hoverCursor?.hide();
    }
  };

  const applyHover = (pick: TilePick | null): void => {
    cursorPick = pick;
    if (showHoverCursor) {
      highlights?.setCursor(pick);
    }
    paintHoverCursor(pick);
    hoverHandler(pick);
  };

  // On the canvas (not window): an embedded scene (map-select preview) must not
  // steal the wheel from surrounding scrollable DOM panels.
  canvas.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("resize", onResize);

  let lastTime = performance.now();
  // Reused each frame so the shared view-projection matrix is built once, not per sprite.
  const viewProjection = new Matrix();
  engine.runRenderLoop(() => {
    const now = performance.now();
    const deltaMs = now - lastTime;
    lastTime = now;

    isoCamera.tick(deltaMs);

    camera.getViewMatrix().multiplyToRef(camera.getProjectionMatrix(), viewProjection);
    for (const { billboard } of billboards) {
      billboard.update(deltaMs, isoCamera.azimuth, viewProjection);
    }
    spriteHud.update();
    scene.render();
  });

  /**
   * Sink a standing Y onto a liquid tile's floor (plan 166): a grounded mon plants its
   * feet at 3/6 of the tile body so it reads as wading/submerged; a hovering flyer
   * (`submerge = false`) keeps the full top and floats above the surface. `baseY` is the
   * unrecessed tile-top Y (= body height), so the sink is a pure fraction of it.
   */
  function sinkOntoLiquid(x: number, y: number, baseY: number, submerge: boolean): number {
    return submerge && isLiquidAt(x, y) ? baseY * BABYLON_LIQUID_DEPTH_RATIO : baseY;
  }

  function positionOnTile(entry: BillboardEntry): void {
    if (!tileWorldTop) {
      return;
    }
    const submerged = entry.grounded && isLiquidAt(entry.spawn.x, entry.spawn.y);
    const top = tileWorldTop(entry.spawn.x, entry.spawn.y);
    const y = sinkOntoLiquid(entry.spawn.x, entry.spawn.y, top.y, entry.grounded);
    entry.billboard.root.position.set(top.x, y, top.z);
    // Waterline foam band at the liquid surface (plan 166): local-Y above the submerged
    // root = the 2/6 slab between the sprite's feet (3/6) and the surface (5/6).
    const waterlineLocalY = top.y * (BABYLON_LIQUID_SURFACE_RATIO - BABYLON_LIQUID_DEPTH_RATIO);
    entry.billboard.setSubmerged(
      submerged,
      waterlineLocalY,
      submerged ? liquidFoamColorAt(entry.spawn.x, entry.spawn.y) : null,
    );
  }

  /** Move a billboard to another tile, keeping the tile→billboard cursor lookup in sync. */
  function moveEntryToTile(entry: BillboardEntry, x: number, y: number): void {
    const previousKey = `${entry.spawn.x},${entry.spawn.y}`;
    if (billboardByTile.get(previousKey) === entry) {
      billboardByTile.delete(previousKey);
    }
    entry.spawn = { x, y };
    billboardByTile.set(`${x},${y}`, entry);
    positionOnTile(entry);
  }

  /** Lerp a billboard's world position over `durationMs` (optional jump arc), driven by the render loop.
   *  `onMidpoint` (if given) fires once as the sprite crosses the tile boundary (progress ≥ 0.5) — used
   *  to switch a flyer's flat-crossing pose from the source tile's mode to the destination tile's mode. */
  function tweenRootPosition(
    entry: BillboardEntry,
    from: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number },
    durationMs: number,
    verticalMode: MovementVerticalMode,
    onMidpoint?: () => void,
  ): Promise<void> {
    return new Promise((resolve) => {
      let elapsed = 0;
      let midpointFired = false;
      // Resolve on scene disposal too: `scene.dispose()` clears onBeforeRender
      // observers WITHOUT firing them, so a glide interrupted by Replay/Exit would
      // otherwise hang the awaiting AnimationQueue forever (and leak the billboard).
      let renderObserver: ReturnType<typeof scene.onBeforeRenderObservable.add> = null;
      let disposeObserver: ReturnType<typeof scene.onDisposeObservable.add> = null;
      const finish = (): void => {
        if (renderObserver) {
          scene.onBeforeRenderObservable.remove(renderObserver);
        }
        if (disposeObserver) {
          scene.onDisposeObservable.remove(disposeObserver);
        }
        resolve();
      };
      // The vertical axis eases independently of the horizontal (port of
      // PokemonSprite.animateMoveTo): a jump rises/drops with a lead so it tops a cliff
      // before sliding over the edge; a step does the same linearly (a small stair); a
      // flat move (or ramp) interpolates Y straight. A linear Y on a height change would
      // cut a diagonal through the cliff/water instead of stepping.
      const ascent = to.y >= from.y;
      renderObserver = scene.onBeforeRenderObservable.add(() => {
        elapsed += scene.getEngine().getDeltaTime();
        const progress = Math.min(1, elapsed / durationMs);
        if (!midpointFired && progress >= 0.5) {
          midpointFired = true;
          onMidpoint?.();
        }
        const verticalProgress =
          verticalMode === "jump"
            ? jumpVerticalProgress(progress, ascent)
            : verticalMode === "step"
              ? stepVerticalProgress(progress, ascent)
              : progress;
        entry.billboard.root.position.set(
          from.x + (to.x - from.x) * progress,
          from.y + (to.y - from.y) * verticalProgress,
          from.z + (to.z - from.z) * progress,
        );
        if (progress >= 1) {
          finish();
        }
      });
      disposeObserver = scene.onDisposeObservable.add(finish);
    });
  }

  /**
   * Glide a billboard tile-by-tile along a path with per-step animation parity
   * (plan 123 4d-5, port of GameController.animateAlongPath): each step picks
   * Walk/Hop from its height delta (ramps walk, cliffs hop), flyers glide over
   * special terrain, and the per-step duration + jump arc follow the same rules.
   * Ghosts keep their height crossing an obstacle. Snaps the final tile to re-sync.
   */
  async function moveBillboardAlongPath(
    entry: BillboardEntry,
    path: readonly { x: number; y: number }[],
    options: {
      isFlying: boolean;
      isGhost: boolean;
      onTileReached?: (tile: { x: number; y: number }) => void;
    },
  ): Promise<void> {
    const last = path.at(-1);
    const map = movementMap;
    if (!map || !last) {
      if (last) {
        moveEntryToTile(entry, last.x, last.y);
      }
      return;
    }
    const { isFlying, isGhost } = options;
    // `path` is the list of destination steps only — it does NOT include the
    // current tile (a one-tile move emits a single-element path). Start from the
    // billboard's standing tile and animate every step (else the first leg is
    // skipped → the sprite pops off its start tile).
    let previous: { x: number; y: number } = entry.spawn;
    let previousHeight = map.heightAt(previous.x, previous.y);
    for (const to of path) {
      entry.billboard.setWorldFacing(worldFacingFromDirection(directionFromTo(previous, to)));
      // Drop the foam the instant the mon leaves a liquid (start of the step out), not at the end
      // of the glide (plan 166). Kept if the destination is still a liquid; the end-of-path snap
      // (positionOnTile) turns it back on when arriving into water.
      if (isFlying || !isLiquidAt(to.x, to.y)) {
        entry.billboard.setSubmerged(false, 0, null);
      }
      const terrainType = map.terrainAt(to.x, to.y);
      const rawHeight = map.heightAt(to.x, to.y);
      // A Ghost floats at its prior height when phasing over an obstacle.
      const stepHeight =
        isGhost && terrainType === TerrainType.Obstacle ? previousHeight : rawHeight;
      const movementStep: MovementStep = {
        heightDiff: Math.abs(stepHeight - previousHeight),
        isRamp: map.isSlopeAt(previous.x, previous.y) || map.isSlopeAt(to.x, to.y),
        isFlying,
        terrainType,
      };
      const fromWorld = tileTopCenter(
        previous.x,
        previous.y,
        previousHeight,
        map.width,
        map.height,
      );
      const toWorld = tileTopCenter(to.x, to.y, stepHeight, map.width, map.height);
      // A walker sinks into a liquid endpoint (plan 166); a flyer glides over it at full height.
      fromWorld.y = sinkOntoLiquid(previous.x, previous.y, fromWorld.y, !isFlying);
      toWorld.y = sinkOntoLiquid(to.x, to.y, toWorld.y, !isFlying);
      // Vertical mode from the terrain height, upgraded to a stair step when only the
      // liquid dip changed Y (so entering/leaving water steps instead of sliding diagonally).
      let verticalMode = movementVerticalMode(movementStep);
      if (verticalMode === "flat" && Math.abs(toWorld.y - fromWorld.y) > LIQUID_STEP_EPSILON) {
        verticalMode = "step";
      }
      const isJump = verticalMode === "jump";
      // Flat crossing pose for the terrain the sprite is currently over: a flyer glides above a
      // fly-over tile (no ground), walks on walkable ground. Used at the step start (source tile)
      // then again at the tile boundary (destination) so the mode switches as the sprite arrives,
      // not the instant it leaves — matches where the sprite physically is.
      const playFlatCrossing = (terrain: string | undefined): void => {
        if (isFlying && isFlyoverTerrain(terrain)) {
          entry.billboard.playFirstAvailable(FLYING_GLIDE_CANDIDATES, "Walk");
        } else {
          entry.billboard.setAnimation("Walk");
        }
      };
      if (isJump) {
        // Cliff up/down (or a flyer clearing a gap): the height-based pose holds for the whole arc —
        // Hop on the ground, glide for a flyer. A stair step / flat move keeps the walk (glide) pose.
        if (getFlyingAnimationMode(movementStep) === "glide") {
          entry.billboard.playFirstAvailable(
            FLYING_GLIDE_CANDIDATES,
            selectMovementAnimation(movementStep),
          );
        } else {
          entry.billboard.setAnimation(selectMovementAnimation(movementStep));
        }
      } else {
        playFlatCrossing(map.terrainAt(previous.x, previous.y));
      }
      await tweenRootPosition(
        entry,
        fromWorld,
        toWorld,
        selectMovementDuration(movementStep),
        verticalMode,
        isJump ? undefined : () => playFlatCrossing(terrainType),
      );
      previous = to;
      previousHeight = stepHeight;
      options.onTileReached?.({ x: to.x, y: to.y });
    }
    applyLandingRestingAnimation(entry, isFlying, last);
    moveEntryToTile(entry, last.x, last.y);
  }

  /** Resting pose after a move: a flyer landing on special terrain keeps gliding, else Idle (parity). */
  function applyLandingRestingAnimation(
    entry: BillboardEntry,
    isFlying: boolean,
    position: { x: number; y: number },
  ): void {
    const terrainType = movementMap?.terrainAt(position.x, position.y);
    const landOnSpecialTerrain = isFlying && isFlyoverTerrain(terrainType);
    if (landOnSpecialTerrain) {
      const resting = entry.billboard.playFirstAvailable(FLYING_GLIDE_CANDIDATES, "Idle");
      entry.billboard.setRestingAnimation(resting);
    } else {
      entry.billboard.setRestingAnimation("Idle");
      entry.billboard.setAnimation("Idle");
    }
  }

  /**
   * Glide a billboard to a single destination tile (knockback / ice-slide). Unlike
   * `moveBillboardAlongPath` it never changes facing (the Pokémon is pushed, not
   * walking) and optionally plays the Hurt pose. Mirrors GameController's
   * Knockback/IceSlide tweens.
   */
  async function impactGlide(
    entry: BillboardEntry,
    to: { x: number; y: number },
    hurt: boolean,
  ): Promise<void> {
    if (!tileWorldTop) {
      moveEntryToTile(entry, to.x, to.y);
      return;
    }
    if (hurt && entry.billboard.hasAnimation("Hurt")) {
      entry.billboard.playOnce("Hurt");
    }
    const root = entry.billboard.root.position;
    const from = { x: root.x, y: root.y, z: root.z };
    const toWorld = tileWorldTop(to.x, to.y);
    // A knockback off a cliff steps/jumps rather than sliding flat: without the vertical
    // lead the Pokémon would fall diagonally straight through the cliff face (visible via
    // the X-ray silhouette). Reuse the movement vertical mode so the push slides to the
    // edge then drops (stair for a half-block, jump arc for a bigger cliff). Ramps stay linear.
    const map = movementMap;
    const verticalMode: MovementVerticalMode =
      map === null
        ? "flat"
        : movementVerticalMode({
            heightDiff: Math.abs(
              map.heightAt(to.x, to.y) - map.heightAt(entry.spawn.x, entry.spawn.y),
            ),
            isRamp: map.isSlopeAt(entry.spawn.x, entry.spawn.y) || map.isSlopeAt(to.x, to.y),
            isFlying: false,
          });
    await tweenRootPosition(entry, from, toWorld, MOVE_TWEEN_DURATION_MS, verticalMode);
    entry.billboard.setAnimation("Idle");
    moveEntryToTile(entry, to.x, to.y);
  }

  /** Hurt pose + brief left-right world-X shake, restored to rest (knockback blocked). */
  function impactShake(entry: BillboardEntry): Promise<void> {
    if (entry.billboard.hasAnimation("Hurt")) {
      entry.billboard.playOnce("Hurt");
    }
    return new Promise((resolve) => {
      const root = entry.billboard.root.position;
      const baseX = root.x;
      let elapsed = 0;
      let renderObserver: ReturnType<typeof scene.onBeforeRenderObservable.add> = null;
      let disposeObserver: ReturnType<typeof scene.onDisposeObservable.add> = null;
      const finish = (): void => {
        if (renderObserver) {
          scene.onBeforeRenderObservable.remove(renderObserver);
        }
        if (disposeObserver) {
          scene.onDisposeObservable.remove(disposeObserver);
        }
        root.x = baseX;
        entry.billboard.setAnimation("Idle");
        resolve();
      };
      renderObserver = scene.onBeforeRenderObservable.add(() => {
        elapsed += scene.getEngine().getDeltaTime();
        const progress = Math.min(1, elapsed / BABYLON_KNOCKBACK_SHAKE_DURATION_MS);
        if (progress >= 1) {
          finish();
          return;
        }
        // Decaying oscillation: full swing early, fades to nothing at the end.
        const swing = Math.sin(progress * Math.PI * 2 * BABYLON_KNOCKBACK_SHAKE_CYCLES);
        root.x = baseX + swing * BABYLON_KNOCKBACK_SHAKE_AMPLITUDE * (1 - progress);
      });
      disposeObserver = scene.onDisposeObservable.add(finish);
    });
  }

  // Full readiness = map built AND every initial sprite atlas loaded, so awaiting it means the
  // scene is paintable with no FOUC (the loading overlay fades only here). `ready` alone was
  // map-only, leaving sprites to pop in afterwards.
  const sceneReady = Promise.all([ready, ...billboards.map((entry) => entry.ready)]).then(
    () => undefined,
  );
  void sceneReady.then(() => {
    sceneIsReady = true;
  });

  return {
    ready: sceneReady,
    // Re-computed over the *current* billboards, so it also covers sprites added after the map
    // (sandbox auto-spawns) — the overlay awaits this before fading.
    whenReady: () =>
      Promise.all([sceneReady, ...billboards.map((entry) => entry.ready)]).then(() => undefined),
    setTileHighlights: (kind, positions) => highlights?.set(kind, positions),
    setSpawnZoneHighlights: (zones) => highlights?.setSpawnZones(zones),
    addPokemon: (entry) => {
      const created = createBillboard(entry);
      positionOnTile(created);
      billboards.push(created);
      billboardByTile.set(`${entry.spawn.x},${entry.spawn.y}`, created);
      const handle: CombatPokemonHandle = {
        setFacing: (direction) =>
          created.billboard.setWorldFacing(worldFacingFromDirection(direction)),
        moveTo: (tile) => moveEntryToTile(created, tile.x, tile.y),
        moveAlongPath: (path, moveOptions) =>
          moveBillboardAlongPath(created, path, {
            isFlying: moveOptions?.isFlying ?? false,
            isGhost: moveOptions?.isGhost ?? false,
            onTileReached: moveOptions?.onTileReached,
          }),
        impactGlide: (tile, impactOptions) =>
          impactGlide(created, tile, impactOptions?.hurt ?? false),
        impactShake: () => impactShake(created),
        playAttack: (direction, animationName) =>
          new Promise<void>((resolve) => {
            created.billboard.setWorldFacing(worldFacingFromDirection(direction));
            // Fall back to "Attack" when the sprite lacks the category anim (parity).
            const chosen = created.billboard.hasAnimation(animationName) ? animationName : "Attack";
            let settled = false;
            let timer: ReturnType<typeof setTimeout> | undefined;
            // Bias the lunge nearer so a coplanar front tile can't clip the enlarged
            // attack frame (taller terrain still occludes + X-rays the attacker normally).
            created.billboard.setAttacking(true);
            const finish = (): void => {
              if (settled) {
                return;
              }
              settled = true;
              created.billboard.setAttacking(false);
              if (timer) {
                clearTimeout(timer);
              }
              resolve();
            };
            timer = setTimeout(finish, BABYLON_ATTACK_ANIMATION_MAX_MS);
            created.billboard.playOnce(chosen, { onComplete: finish });
          }),
        setActive: (active) => created.billboard.setActive(active),
        setGroundedByGravity: (grounded) => {
          // Land the flyer (stop flapping → ground idle) or let it float again. Runs on every
          // board re-sync, so it's the final word on an airborne flyer's resting pose — it must be
          // terrain-aware or it would clobber the landing pose: a flyer glides only over a fly-over
          // tile (no ground to stand on); on walkable ground (Normal/TallGrass) it touches down.
          // Gravité/Anti-Air (`grounded`) forces a landing everywhere.
          const overFlyover = isFlyoverTerrain(
            movementMap?.terrainAt(created.spawn.x, created.spawn.y),
          );
          const hovering = !grounded && overFlyover;
          const resting = hovering
            ? created.billboard.playFirstAvailable(FLYING_GLIDE_CANDIDATES, "Idle")
            : created.billboard.playFirstAvailable(["Idle", "Walk"], "Walk");
          created.billboard.setRestingAnimation(resting);
          created.billboard.setAnimation(resting);
          // A hovering flyer floats above a liquid surface; a landed one sinks into it (plan 166).
          created.grounded = !hovering;
          positionOnTile(created);
        },
        flashDamage: () => created.billboard.flashDamage(),
        setPreviewFlash: (active) => created.billboard.setPreviewFlash(active),
        setConfusionWobble: (active) => created.billboard.setConfusionWobble(active),
        updateHp: (currentHp, maxHp) => created.overlay.setHp(currentHp, maxHp),
        updateStatus: (statusType) => created.overlay.setStatus(statusType),
        showDamageEstimate: (estimate) => created.overlay.setDamageEstimate(estimate),
        setLeftIndicators: (specs) => created.overlay.setLeftIndicators(specs),
        setKnockedOut: (knockedOut) => {
          // The billboard now plays the Faint once on the KO edge (so a repeated
          // setKnockedOut from syncBoard doesn't restart it).
          created.billboard.setKnockedOut(knockedOut);
          // KO removes the HP bar + status icon.
          created.overlay.setVisible(!knockedOut);
        },
        setSemiInvulnerable: (state) => created.billboard.setSemiInvulnerable(state),
        playOnce: (animation) => created.billboard.playOnce(animation),
        setSubstitute: (active) => {
          void created.billboard.setSubstitute(active);
        },
        setSpecies: (definitionId) => {
          void created.billboard.setSpecies(getResolvedAtlas(definitionId));
        },
        setHudVisible: (visible) => created.overlay.setVisible(visible),
        koAnimationDurationMs: () => created.billboard.animationDurationMs("Faint"),
        hurtAnimationDurationMs: () => created.billboard.animationDurationMs("Hurt"),
      };
      entryByHandle.set(handle, created);
      return handle;
    },
    removePokemon: (handle) => {
      const entry = entryByHandle.get(handle);
      if (!entry) {
        return;
      }
      entryByHandle.delete(handle);
      const index = billboards.indexOf(entry);
      if (index >= 0) {
        billboards.splice(index, 1);
      }
      const tileKey = `${entry.spawn.x},${entry.spawn.y}`;
      if (billboardByTile.get(tileKey) === entry) {
        billboardByTile.delete(tileKey);
      }
      entry.overlay.dispose();
      entry.billboard.dispose();
    },
    showDirectionPicker: (tile, initialDirection, callbacks) => {
      if (!tileWorldTop) {
        return { dispose: () => undefined };
      }
      const projectTop = tileWorldTop;
      const occupant = billboardByTile.get(`${tile.x},${tile.y}`);
      const center = projectTop(tile.x, tile.y);
      const fraction = BABYLON_DIRECTION_ARROW_TILE_FRACTION;

      // Lay the arrows around the Pokémon at the SAME head anchor as the hover
      // cursor (head offset + gap), and park the cursor there for the duration of
      // the facing choice. spriteTopOffsetY is 0 until the atlas loads, so this is
      // replayed on `occupant.ready` — the only way a big sprite (Léviator) gets
      // the right height, since the placement sprite loads after the picker opens.
      const placeArrows = (): void => {
        const headLift = occupant?.billboard.spriteTopOffsetY || BABYLON_SPRITE_HEAD_LIFT_FALLBACK;
        // Arrows sit AT the head (tracks sprite size); the cursor floats a gap above it.
        const arrowY = center.y + headLift;
        const neighbors = {} as Record<Direction, { x: number; y: number; z: number }>;
        for (const direction of ALL_DIRECTIONS) {
          const { dx, dy } = DIRECTION_NEIGHBOR[direction];
          const top = projectTop(tile.x + dx, tile.y + dy);
          neighbors[direction] = {
            x: center.x + (top.x - center.x) * fraction,
            y: arrowY,
            z: center.z + (top.z - center.z) * fraction,
          };
        }
        directionArrows.show(neighbors, directionPicker?.current ?? initialDirection);
        hoverHead.set(center.x, arrowY + BABYLON_HOVER_CURSOR_GAP, center.z);
        hoverCursor?.showAt(hoverHead);
      };

      placeArrows();
      directionPicker = {
        callbacks,
        current: initialDirection,
        center: { x: tile.x, y: tile.y },
        // Seeded with the facing already on screen so accepting it costs ONE tap: without this the
        // first tap "previews" what is already shown — no visible change, and it looks like a lost
        // tap. Same reasoning as the default direction the attack phase opens with.
        touchAimedDirection: initialDirection,
      };
      // Snap to the real head once the freshly-placed sprite's atlas resolves.
      void occupant?.ready.then(() => {
        if (directionPicker?.center.x === tile.x && directionPicker.center.y === tile.y) {
          placeArrows();
        }
      });
      return {
        dispose: () => {
          // Only close if still ours (a confirm/cancel may have replaced it).
          if (directionPicker?.callbacks === callbacks) {
            closeDirectionPicker();
          }
        },
      };
    },
    setTileOutline: (positions, beneficial) =>
      highlights?.setOutline(positions, beneficial ? TILE_PREVIEW_BUFF_COLOR : undefined),
    setFieldTerrains: (specs) => {
      pendingFieldTerrains = specs;
      fieldTerrains?.set(specs);
    },
    setDistortionZones: (specs) => {
      pendingDistortionZones = specs;
      distortionZones?.set(specs);
    },
    setEntryHazards: (specs) => {
      pendingEntryHazards = specs;
      entryHazards?.set(specs);
    },
    setAuraRings: (specs) => {
      pendingAuraRings = specs;
      auraRings?.set(specs);
    },
    clearHighlights: () => highlights?.clear(),
    onTileHover: (handler) => {
      hoverHandler = handler;
    },
    onTileClick: (handler) => {
      clickHandler = handler;
    },
    onCameraRotated: (handler) => {
      isoCamera.onRotated(handler);
    },
    pickTileAt: (x, y) => pickTile(scene, x, y),
    isCompassHitAt: (x, y) => compass?.isHit(scene, x, y) === true,
    setCursor: (pick) => applyHover(pick),
    pinCursor: (pick) => {
      cursorPick = pick;
      if (showHoverCursor) {
        highlights?.setCursor(pick);
      }
      paintHoverCursor(pick);
    },
    dispatchTileClick: (pick, source) => clickHandler(pick, source),
    directionPickerFacing: () => directionPicker?.current ?? null,
    aimDirectionPickerAt: (x, y) =>
      directionPicker ? directionFromPointer(directionPicker.center, x, y) : null,
    previewDirectionPickerFacing: (direction) => {
      if (!directionPicker) {
        return;
      }
      directionPicker.current = direction;
      directionArrows.setActive(direction);
      directionPicker.callbacks.onPreview(direction);
    },
    confirmDirectionPickerFacing: (direction) => {
      if (!directionPicker) {
        return;
      }
      const { callbacks } = directionPicker;
      closeDirectionPicker();
      callbacks.onConfirm(direction);
    },
    panCameraByPixels: (deltaX, deltaY) =>
      isoCamera.panByPixels(deltaX, deltaY, canvas.clientHeight),
    moveCursor: (direction) => stepCursor(direction),
    aimDirectionPicker: (direction) => aimDirectionPicker(direction),
    gridDirectionFrom: (center, direction) => {
      const aim = SCREEN_DIRECTION_VECTOR[direction];
      return bestNeighborForScreenVector(center, aim.x, aim.y)?.direction ?? null;
    },
    confirmDirectionPicker: () => confirmDirectionPicker(),
    cursorTile: () => cursorPick,
    cameraFocusTile: () => cameraFocusTile,
    rotateCamera: (step) => isoCamera.rotateByStep(step),
    zoomCamera: (step) => {
      // `zoomByWheel` speaks wheel deltas (negative = closer); the logical action speaks notches.
      isoCamera.zoomByWheel(-step);
    },
    setZoomLevel: (index) => isoCamera.setZoomIndex(index),
    cancelDirectionPicker: () => cancelDirectionPicker(),
    panCameraTo: (tile) => {
      if (!tileWorldTop) {
        return;
      }
      cameraFocusTile = { x: tile.x, y: tile.y };
      const top = tileWorldTop(tile.x, tile.y);
      isoCamera.panTo(top.x, top.y, top.z);
    },
    spawnFloatingText: (tile, text, color, floatOptions = {}) => {
      if (!tileWorldTop) {
        return;
      }
      const top = tileWorldTop(tile.x, tile.y);
      // Lift to roughly head height so the label rises off the sprite, not the floor. A secondary
      // label (effectiveness) gets an extra lift so it stacks ABOVE the primary damage number of the
      // same beat instead of overlapping it (both rise together, so the gap holds for the scroll).
      const baseY =
        top.y +
        BABYLON_FLOATING_TEXT_LIFT +
        (floatOptions.secondary ? BABYLON_FLOATING_TEXT_SECONDARY_LIFT : 0);
      const worldHeight =
        BABYLON_FLOATING_TEXT_HEIGHT *
        (floatOptions.secondary ? BABYLON_FLOATING_TEXT_SECONDARY_SCALE : 1);
      const label = createTextPlane(scene, {
        text,
        color,
        worldHeight,
        renderingGroupId: BABYLON_HUD_RENDERING_GROUP,
        strokeColor: BATTLE_TEXT_STROKE_COLOR,
        strokePx: 4,
        billboard: true,
      });
      label.mesh.position.set(top.x, baseY, top.z);
      // Rise (cubic ease-out) + fade then dispose — driven by the render loop so a
      // scene dispose mid-flight frees it.
      let elapsed = -(floatOptions.delayMs ?? 0);
      label.mesh.setEnabled(elapsed >= 0);
      let renderObserver: ReturnType<typeof scene.onBeforeRenderObservable.add> = null;
      let disposeObserver: ReturnType<typeof scene.onDisposeObservable.add> = null;
      const finish = (): void => {
        if (renderObserver) {
          scene.onBeforeRenderObservable.remove(renderObserver);
        }
        if (disposeObserver) {
          scene.onDisposeObservable.remove(disposeObserver);
        }
        label.dispose();
      };
      renderObserver = scene.onBeforeRenderObservable.add(() => {
        elapsed += scene.getEngine().getDeltaTime();
        if (elapsed < 0) {
          return;
        }
        label.mesh.setEnabled(true);
        const progress = Math.min(1, elapsed / BATTLE_TEXT_DURATION_MS);
        const eased = 1 - (1 - progress) ** 3;
        label.mesh.position.y = baseY + BABYLON_FLOATING_TEXT_RISE * eased;
        // Hold full opacity, then fade over the last 40% of the lifetime.
        label.material.alpha = progress < 0.6 ? 1 : Math.max(0, 1 - (progress - 0.6) / 0.4);
        if (progress >= 1) {
          finish();
        }
      });
      disposeObserver = scene.onDisposeObservable.add(finish);
    },
    dispose: () => {
      loadCancelled = true;
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      directionArrows.dispose();
      hoverCursor?.dispose();
      compass?.dispose();
      highlights?.dispose();
      fieldTerrains?.dispose();
      distortionZones?.dispose();
      entryHazards?.dispose();
      spriteHud.dispose();
      auraRings?.dispose();
      for (const { billboard } of billboards) {
        billboard.dispose();
      }
      decorations?.dispose();
      terrain?.dispose();
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
    },
  };
}
