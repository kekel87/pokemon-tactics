import { Camera } from "@babylonjs/core/Cameras/camera";
import { TargetCamera } from "@babylonjs/core/Cameras/targetCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { Direction, directionFromTo, TerrainType } from "@pokemon-tactic/core";
import type {
  CombatPokemonHandle,
  CombatScene,
  CombatSceneSpawn,
  DirectionPickerCallbacks,
  DirectionPickerHandle,
} from "@pokemon-tactic/render-ports";
import {
  FLYING_GLIDE_CANDIDATES,
  FLYING_OVERFLY_TERRAINS,
  getFlyingAnimationMode,
  isJumpStep,
  loadTiledMap,
  type MovementStep,
  selectMovementAnimation,
  selectMovementDuration,
  worldFacingFromDirection,
} from "@pokemon-tactic/view-core";
import { createAuraGroundIcons } from "./babylon-aura-ground-icons.js";
import {
  BABYLON_ATTACK_ANIMATION_MAX_MS,
  BABYLON_AURA_HOVER_ICON_LIFT,
  BABYLON_AZIMUTH_LERP_EPSILON,
  BABYLON_AZIMUTH_STEP,
  BABYLON_CAMERA_AZIMUTH,
  BABYLON_CAMERA_DISTANCE,
  BABYLON_CAMERA_PAN_EPSILON,
  BABYLON_CAMERA_PAN_LERP,
  BABYLON_CLEAR_COLOR,
  BABYLON_DIMETRIC_ELEVATION,
  BABYLON_DIRECTION_ARROW_TILE_FRACTION,
  BABYLON_DIRECTIONAL_LIGHT_INTENSITY,
  BABYLON_FLOATING_TEXT_HEIGHT,
  BABYLON_FLOATING_TEXT_LIFT,
  BABYLON_FLOATING_TEXT_RISE,
  BABYLON_FLOATING_TEXT_SECONDARY_SCALE,
  BABYLON_HEMI_LIGHT_INTENSITY,
  BABYLON_HOVER_CURSOR_GAP,
  BABYLON_HUD_RENDERING_GROUP,
  BABYLON_JUMP_VERTICAL_LEAD,
  BABYLON_KNOCKBACK_SHAKE_AMPLITUDE,
  BABYLON_KNOCKBACK_SHAKE_CYCLES,
  BABYLON_KNOCKBACK_SHAKE_DURATION_MS,
  BABYLON_PICK_DRAG_THRESHOLD_PX,
  BABYLON_ROTATION_LERP,
  BABYLON_SPRITE_HEAD_LIFT_FALLBACK,
  BABYLON_SPRITE_PIXELS_PER_UNIT,
  BABYLON_VIEW_SIZE,
  BABYLON_ZOOM_MAX,
  BABYLON_ZOOM_MIN,
  BABYLON_ZOOM_STEP,
} from "./babylon-constants.js";
import { createDecorations, type Decorations } from "./babylon-decorations.js";
import { createDirectionArrows } from "./babylon-direction-picker.js";
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
 * dimetric orthographic camera that snaps between the 4 iso views (←/→).
 * Sprites render in group 2 (after terrain group 0 and X-ray silhouettes group 1,
 * depth buffer kept) with `SpriteDepthPlugin` flattening each to its foot depth, so
 * taller terrain in front occludes it without the upright plane self-clipping into
 * its tile — and a Pokémon behind another is occluded normally, never X-rayed.
 *
 * This is the parity scene. The DOM HUD (HP bars, InfoPanel) and scene FSM are
 * wired at Jalon 4; the dev tuning affordances live in the `babylon-preview`
 * harness (reachable via `?preview=1`).
 */
export function createCombatScene(options: CombatSceneOptions): CombatScene {
  const { canvas, mapUrl, pokemon: pokemonSpawns, showHoverCursor = true } = options;

  const engine = new Engine(canvas, false, {
    preserveDrawingBuffer: false,
    stencil: false,
    antialias: false,
  });

  const scene = new Scene(engine);
  scene.clearColor = new Color4(
    BABYLON_CLEAR_COLOR.r,
    BABYLON_CLEAR_COLOR.g,
    BABYLON_CLEAR_COLOR.b,
    1,
  );
  let sceneIsReady = false;

  const cameraTarget = new Vector3(0, 0, 0);
  // Goal the camera centre eases toward (recentering on the active Pokémon); the
  // first placement snaps, later turns slide smoothly.
  const cameraTargetGoal = new Vector3(0, 0, 0);
  let cameraCentered = false;
  const zoom = { value: 1 };
  // Current (eased) and target azimuth — ←/→ snap the target by 90°, the render
  // loop eases `azimuth` toward it so the view always rests on an iso angle.
  const cameraAngle = { azimuth: BABYLON_CAMERA_AZIMUTH, target: BABYLON_CAMERA_AZIMUTH };

  const camera = new TargetCamera("combat_ortho", Vector3.Zero(), scene);
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.minZ = 0.1;
  camera.maxZ = 100;

  function updateCamera(): void {
    const { azimuth } = cameraAngle;
    camera.position.set(
      cameraTarget.x +
        Math.cos(BABYLON_DIMETRIC_ELEVATION) * Math.cos(azimuth) * BABYLON_CAMERA_DISTANCE,
      cameraTarget.y + Math.sin(BABYLON_DIMETRIC_ELEVATION) * BABYLON_CAMERA_DISTANCE,
      cameraTarget.z +
        Math.cos(BABYLON_DIMETRIC_ELEVATION) * Math.sin(azimuth) * BABYLON_CAMERA_DISTANCE,
    );
    camera.setTarget(cameraTarget);
    const aspect = engine.getRenderWidth() / engine.getRenderHeight();
    const halfWidth = (BABYLON_VIEW_SIZE * aspect) / (2 * zoom.value);
    const halfHeight = BABYLON_VIEW_SIZE / (2 * zoom.value);
    camera.orthoLeft = -halfWidth;
    camera.orthoRight = halfWidth;
    camera.orthoTop = halfHeight;
    camera.orthoBottom = -halfHeight;
  }
  updateCamera();

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
  const auraGroundIcons = createAuraGroundIcons(scene);

  interface BillboardEntry {
    billboard: DirectionalBillboard;
    spawn: { x: number; y: number };
    /** Resolves once the atlas (and thus the real head offset) is loaded. */
    ready: Promise<void>;
    /** World HP bar + status icon anchored to this sprite's head. */
    overlay: SpriteHudHandle;
  }

  function createBillboard(entry: CombatSceneSpawn): BillboardEntry {
    const teamColor = teamColorByIndex(entry.team ?? 1);
    const billboard = new DirectionalBillboard({
      scene,
      atlasJsonUrl: `assets/sprites/pokemon/${entry.pokemonId}/atlas.json`,
      atlasPngUrl: `assets/sprites/pokemon/${entry.pokemonId}/atlas.png`,
      offsetsJsonUrl: `assets/sprites/pokemon/${entry.pokemonId}/offsets.json`,
      substituteAtlasJsonUrl: `assets/sprites/pokemon/${SUBSTITUTE_SPRITE_ID}/atlas.json`,
      substituteAtlasPngUrl: `assets/sprites/pokemon/${SUBSTITUTE_SPRITE_ID}/atlas.png`,
      substituteOffsetsJsonUrl: `assets/sprites/pokemon/${SUBSTITUTE_SPRITE_ID}/offsets.json`,
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
    return { billboard, spawn: entry.spawn, ready, overlay };
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
  } | null = null;
  function closeDirectionPicker(): void {
    directionArrows.hide();
    directionPicker = null;
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
   * Direction whose neighbour tile lies closest (by screen angle) to the pointer,
   * measured from the placed Pokémon's tile. Mouse-driven (not arrow-picking) so
   * the whole screen is a generous hit area, and re-projected each call so it
   * tracks camera rotation/zoom. Returns null before the map loads.
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
    const pointerVectorX = pointerX - centerScreen.x;
    const pointerVectorY = pointerY - centerScreen.y;
    const pointerLength = Math.hypot(pointerVectorX, pointerVectorY) || 1;
    let best: Direction | null = null;
    let bestDot = Number.NEGATIVE_INFINITY;
    for (const direction of ALL_DIRECTIONS) {
      const { dx, dy } = DIRECTION_NEIGHBOR[direction];
      const neighbor = tileWorldTop(centerTile.x + dx, centerTile.y + dy);
      const neighborScreen = projectWorld(new Vector3(neighbor.x, neighbor.y, neighbor.z));
      const vectorX = neighborScreen.x - centerScreen.x;
      const vectorY = neighborScreen.y - centerScreen.y;
      const length = Math.hypot(vectorX, vectorY) || 1;
      const dot = (pointerVectorX * vectorX + pointerVectorY * vectorY) / (pointerLength * length);
      if (dot > bestDot) {
        bestDot = dot;
        best = direction;
      }
    }
    return best;
  }

  const hoverCursor = showHoverCursor ? new BabylonHoverCursor(scene) : null;
  const hoverHead = new Vector3();

  let terrain: ExtrudedTerrain | null = null;
  let decorations: Decorations | null = null;
  let highlights: TileHighlights | null = null;
  let fieldTerrains: FieldTerrains | null = null;
  // Field-terrain zones requested before the map finished loading (replayed on load).
  let pendingFieldTerrains: readonly FieldTerrainSpec[] = [];
  // World top-face centre of a tile, lifted onto any rock/tree top, set once the
  // map loads. Used for the cursor, sprite standing and flyer movement so they
  // rest on a decoration instead of clipping into it (decoration-patched
  // height). Decoration foot placement keeps the raw `heightAt`.
  let tileWorldTop: ((x: number, y: number) => { x: number; y: number; z: number }) | null = null;
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
      for (const { billboard, spawn } of billboards) {
        const standOn = tileTopCenter(spawn.x, spawn.y, heightAt(spawn.x, spawn.y), width, height);
        billboard.root.position.set(standOn.x, standOn.y, standOn.z);
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
      cameraTarget.set(mapCenter.x, mapCenter.y, mapCenter.z);
      updateCamera();
    })
    .catch((error) => {
      // biome-ignore lint/suspicious/noConsole: surfacing a fatal asset load failure
      console.error("Failed to load map", mapUrl, error);
    });

  // ←/→ snap the camera by 90° between the 4 iso views (edge-triggered).
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && directionPicker) {
      // Cancel the facing choice. Block the placement-flow's own Escape=undo
      // (also a window listener) so a single press doesn't both cancel AND undo.
      event.stopImmediatePropagation();
      const { callbacks } = directionPicker;
      closeDirectionPicker();
      callbacks.onCancel();
      return;
    }
    if (event.key === "ArrowLeft") {
      cameraAngle.target -= BABYLON_AZIMUTH_STEP;
    } else if (event.key === "ArrowRight") {
      cameraAngle.target += BABYLON_AZIMUTH_STEP;
    } else if (event.key === "h" || event.key === "H") {
      hoverCursor?.cycleVariant();
    }
  };

  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? BABYLON_ZOOM_STEP : 1 / BABYLON_ZOOM_STEP;
    zoom.value = Math.min(BABYLON_ZOOM_MAX, Math.max(BABYLON_ZOOM_MIN, zoom.value * factor));
    updateCamera();
  };
  const onResize = (): void => {
    engine.resize();
    updateCamera();
  };

  // Tile picking callbacks (wired by the host — core/FSM lands at Jalon 4).
  const noop = (): void => {
    // Default until the host wires onTileHover / onTileClick.
  };
  let hoverHandler: (pick: TilePick | null) => void = noop;
  let clickHandler: (pick: TilePick) => void = noop;

  // Read-only e2e scene-graph hook (stripped from prod). clickTile drives the same handler a
  // real canvas pick would, so Playwright can pilot a turn. Installed here so `clickHandler` is
  // in scope; it reads the current handler at call time (reassigned by `onTileClick`).
  installE2eSceneHook(
    scene,
    () => sceneIsReady,
    (x, y) => clickHandler({ x, y }),
    (x, y) => hoverHandler({ x, y }),
    () => {
      if (!directionPicker) {
        return;
      }
      const { callbacks, current } = directionPicker;
      closeDirectionPicker();
      callbacks.onConfirm(current);
    },
  );

  // Left press: pan while dragging, or click-select the tile if released without
  // moving past the drag threshold. A cell hidden by a pillar is reached by
  // rotating the camera (←/→), not a 2D-style Alt disambiguation.
  let dragging = false;
  let pressMoved = false;
  let pressStartX = 0;
  let pressStartY = 0;
  let previousPointerX = 0;
  let previousPointerY = 0;
  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return;
    }
    dragging = true;
    pressMoved = false;
    pressStartX = event.clientX;
    pressStartY = event.clientY;
    previousPointerX = event.clientX;
    previousPointerY = event.clientY;
  };
  // Pointer → canvas-relative coords (what `scene.pick` expects), independent of
  // which overlay element the event bubbled from.
  const canvasPointer = (event: PointerEvent): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const onPointerUp = (event: PointerEvent): void => {
    const wasClick = dragging && !pressMoved;
    dragging = false;
    if (!wasClick) {
      return;
    }
    const { x, y } = canvasPointer(event);
    if (directionPicker) {
      const { callbacks, center, current } = directionPicker;
      const direction = directionFromPointer(center, x, y) ?? current;
      closeDirectionPicker();
      callbacks.onConfirm(direction);
      return;
    }
    const pick = pickTile(scene, x, y);
    if (pick) {
      clickHandler(pick);
    }
  };
  const onPointerMove = (event: PointerEvent): void => {
    if (!dragging) {
      // Hover: the FFTA selection cursor follows every tile, lifted to the head
      // when a Pokémon stands there; the tile cursor is its ground base.
      const { x, y } = canvasPointer(event);
      if (directionPicker) {
        // Picker open: the pointer position relative to the placed Pokémon picks
        // the facing (generous, whole-screen hit area); suppress the tile cursor.
        const direction = directionFromPointer(directionPicker.center, x, y);
        if (direction && direction !== directionPicker.current) {
          directionPicker.current = direction;
          directionArrows.setActive(direction);
          directionPicker.callbacks.onPreview(direction);
        }
        return;
      }
      const pick = pickTile(scene, x, y);
      if (showHoverCursor) {
        highlights?.setCursor(pick);
      }
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
      hoverHandler(pick);
      return;
    }
    if (
      Math.abs(event.clientX - pressStartX) > BABYLON_PICK_DRAG_THRESHOLD_PX ||
      Math.abs(event.clientY - pressStartY) > BABYLON_PICK_DRAG_THRESHOLD_PX
    ) {
      pressMoved = true;
    }
    const deltaX = event.clientX - previousPointerX;
    const deltaY = event.clientY - previousPointerY;
    previousPointerX = event.clientX;
    previousPointerY = event.clientY;
    const worldPerPixel = BABYLON_VIEW_SIZE / zoom.value / canvas.clientHeight;
    const right = camera.getDirection(Vector3.Right());
    const up = camera.getDirection(Vector3.Up());
    cameraTarget
      .addInPlace(right.scale(-deltaX * worldPerPixel))
      .addInPlace(up.scale(deltaY * worldPerPixel));
    // A manual pan wins over any in-flight auto-pan: align the goal onto the new
    // target so the render-loop lerp has nothing left to pull back toward.
    cameraTargetGoal.copyFrom(cameraTarget);
    updateCamera();
  };

  window.addEventListener("keydown", onKeyDown);
  // On the canvas (not window): an embedded scene (map-select preview) must not
  // steal the wheel from surrounding scrollable DOM panels.
  canvas.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("resize", onResize);
  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointermove", onPointerMove);

  let lastTime = performance.now();
  // Reused each frame so the shared view-projection matrix is built once, not per sprite.
  const viewProjection = new Matrix();
  engine.runRenderLoop(() => {
    const now = performance.now();
    const deltaMs = now - lastTime;
    lastTime = now;

    // Ease the azimuth toward the snapped 90° target (smooth iso turn).
    const azimuthDelta = cameraAngle.target - cameraAngle.azimuth;
    if (Math.abs(azimuthDelta) > BABYLON_AZIMUTH_LERP_EPSILON) {
      cameraAngle.azimuth += azimuthDelta * Math.min(1, BABYLON_ROTATION_LERP * (deltaMs / 1000));
      updateCamera();
    } else if (cameraAngle.azimuth !== cameraAngle.target) {
      cameraAngle.azimuth = cameraAngle.target;
      updateCamera();
    }

    // Ease the camera centre toward its goal (smooth recentre on the active Pokémon).
    const panDistance = Vector3.Distance(cameraTarget, cameraTargetGoal);
    if (panDistance > BABYLON_CAMERA_PAN_EPSILON) {
      Vector3.LerpToRef(
        cameraTarget,
        cameraTargetGoal,
        Math.min(1, BABYLON_CAMERA_PAN_LERP * (deltaMs / 1000)),
        cameraTarget,
      );
      updateCamera();
    } else if (!cameraTarget.equals(cameraTargetGoal)) {
      cameraTarget.copyFrom(cameraTargetGoal);
      updateCamera();
    }

    camera.getViewMatrix().multiplyToRef(camera.getProjectionMatrix(), viewProjection);
    for (const { billboard } of billboards) {
      billboard.update(deltaMs, cameraAngle.azimuth, viewProjection);
    }
    decorations?.update(viewProjection);
    spriteHud.update();
    scene.render();
  });

  function positionOnTile(entry: BillboardEntry): void {
    if (!tileWorldTop) {
      return;
    }
    const top = tileWorldTop(entry.spawn.x, entry.spawn.y);
    entry.billboard.root.position.set(top.x, top.y, top.z);
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

  /** Lerp a billboard's world position over `durationMs` (optional jump arc), driven by the render loop. */
  function tweenRootPosition(
    entry: BillboardEntry,
    from: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number },
    durationMs: number,
    jump: boolean,
  ): Promise<void> {
    return new Promise((resolve) => {
      let elapsed = 0;
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
      // Jump steps clear cliffs by easing the vertical axis independently of the
      // horizontal one (port of PokemonSprite.animateMoveTo): on an ascent the
      // sprite rises fast (easeOut) so it tops the cliff before sliding over the
      // edge; on a descent it stays high (easeIn) then drops late. A linear Y
      // would cut straight through the cliff face at mid-step.
      const ascent = to.y >= from.y;
      renderObserver = scene.onBeforeRenderObservable.add(() => {
        elapsed += scene.getEngine().getDeltaTime();
        const progress = Math.min(1, elapsed / durationMs);
        const verticalProgress = jump ? jumpVerticalProgress(progress, ascent) : progress;
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
    options: { isFlying: boolean; isGhost: boolean },
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
      if (getFlyingAnimationMode(movementStep) === "glide") {
        entry.billboard.playFirstAvailable(
          FLYING_GLIDE_CANDIDATES,
          selectMovementAnimation(movementStep),
        );
      } else {
        entry.billboard.setAnimation(selectMovementAnimation(movementStep));
      }
      const fromWorld = tileTopCenter(
        previous.x,
        previous.y,
        previousHeight,
        map.width,
        map.height,
      );
      const toWorld = tileTopCenter(to.x, to.y, stepHeight, map.width, map.height);
      await tweenRootPosition(
        entry,
        fromWorld,
        toWorld,
        selectMovementDuration(movementStep),
        isJumpStep(movementStep),
      );
      previous = to;
      previousHeight = stepHeight;
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
    const landOnSpecialTerrain =
      isFlying && terrainType !== undefined && FLYING_OVERFLY_TERRAINS.has(terrainType);
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
    // A knockback off a cliff is a jump, not a flat slide: without the vertical
    // lead the Pokémon would fall diagonally straight through the cliff face
    // (visible via the X-ray silhouette). Reuse the movement jump test so the
    // push slides to the edge then drops late. Ramps stay a linear slide.
    const map = movementMap;
    const jump =
      map !== null &&
      isJumpStep({
        heightDiff: Math.abs(map.heightAt(to.x, to.y) - map.heightAt(entry.spawn.x, entry.spawn.y)),
        isRamp: map.isSlopeAt(entry.spawn.x, entry.spawn.y) || map.isSlopeAt(to.x, to.y),
        isFlying: false,
      });
    await tweenRootPosition(entry, from, toWorld, MOVE_TWEEN_DURATION_MS, jump);
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
        setHudVisible: (visible) => created.overlay.setVisible(visible),
        koAnimationDurationMs: () => created.billboard.animationDurationMs("Faint"),
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
      directionPicker = { callbacks, current: initialDirection, center: { x: tile.x, y: tile.y } };
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
    setAuraGroundIcons: (cells, symbols) => {
      if (!tileWorldTop || cells.length === 0 || symbols.length === 0) {
        auraGroundIcons.set([], []);
        return;
      }
      const project = tileWorldTop;
      const anchors = cells.map((cell) => {
        const top = project(cell.x, cell.y);
        return { x: top.x, y: top.y + BABYLON_AURA_HOVER_ICON_LIFT, z: top.z };
      });
      auraGroundIcons.set(anchors, symbols);
    },
    clearHighlights: () => highlights?.clear(),
    onTileHover: (handler) => {
      hoverHandler = handler;
    },
    onTileClick: (handler) => {
      clickHandler = handler;
    },
    panCameraTo: (tile) => {
      if (!tileWorldTop) {
        return;
      }
      const top = tileWorldTop(tile.x, tile.y);
      cameraTargetGoal.set(top.x, top.y, top.z);
      // First recentre snaps (no slide from the world origin); later ones ease in
      // the render loop.
      if (!cameraCentered) {
        cameraTarget.copyFrom(cameraTargetGoal);
        cameraCentered = true;
        updateCamera();
      }
    },
    spawnFloatingText: (tile, text, color, floatOptions = {}) => {
      if (!tileWorldTop) {
        return;
      }
      const top = tileWorldTop(tile.x, tile.y);
      // Lift to roughly head height so the label rises off the sprite, not the floor.
      const baseY = top.y + BABYLON_FLOATING_TEXT_LIFT;
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
      window.removeEventListener("keydown", onKeyDown);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointermove", onPointerMove);
      directionArrows.dispose();
      hoverCursor?.dispose();
      highlights?.dispose();
      fieldTerrains?.dispose();
      spriteHud.dispose();
      auraGroundIcons.dispose();
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
