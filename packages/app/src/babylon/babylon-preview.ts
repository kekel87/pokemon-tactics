import { Camera } from "@babylonjs/core/Cameras/camera";
import { TargetCamera } from "@babylonjs/core/Cameras/targetCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import {
  BABYLON_AZIMUTH_LERP_EPSILON,
  BABYLON_AZIMUTH_STEP,
  BABYLON_CAMERA_AZIMUTH,
  BABYLON_CAMERA_DISTANCE,
  BABYLON_CLEAR_COLOR,
  BABYLON_DIMETRIC_ELEVATION,
  BABYLON_DIRECTIONAL_LIGHT_INTENSITY,
  BABYLON_HEMI_LIGHT_INTENSITY,
  BABYLON_ROTATION_LERP,
  BABYLON_SPRITE_PIXELS_PER_UNIT,
  BABYLON_VIEW_SIZE,
  BABYLON_ZOOM_MAX,
  BABYLON_ZOOM_MIN,
  BABYLON_ZOOM_STEP,
  createTileCenterMarkers,
  createTileGrid,
  DirectionalBillboard,
  type ExtrudedTerrain,
  extrudeTerrain,
  projectAnchors,
  tileTopCenter,
  type WorldAnchor,
} from "@pokemon-tactic/render-babylon";
import { createInfoPanel } from "@pokemon-tactic/ui-dom";
import { loadTiledMap } from "@pokemon-tactic/view-core";
import { createTeamEditHarness } from "./team-edit-harness.js";

/**
 * Render the 3D scene at 1/N native resolution then let the browser upscale it
 * with `image-rendering: pixelated`, giving a uniform chunky pixel grid that
 * matches the 24px terrain textures. Safe here because the UI lives in a DOM
 * overlay (separate from the canvas), so only the 3D scene is pixelated.
 */
const PIXELATION_SCALE = 1;
const PIXELATION_MIN = 1;
const PIXELATION_MAX = 6;

export interface PreviewSpawn {
  pokemonId: string;
  spawn: { x: number; y: number };
  /** Accepted but unused by the preview harness (no team silhouette); kept so the shared demo roster fits. */
  team?: number;
}

export interface BabylonPreviewOptions {
  canvas: HTMLCanvasElement;
  /** `.ui-world` layer of the game-stage overlay; world-anchored HUD lives here. */
  worldLayer: HTMLElement;
  /** `.ui-screen` layer; edge-anchored chrome panels (InfoPanel) live here. */
  screenLayer: HTMLElement;
  mapUrl: string;
  pokemon: readonly PreviewSpawn[];
}

export interface BabylonPreview {
  dispose(): void;
}

/**
 * Jalon 1 dev preview: extrude one Tiled map, place one animated directional
 * billboard on it, dimetric orthographic camera with mouse-wheel zoom, arrow-key
 * rotation, and `a`/`z` to turn the sprite. Press `i` to toggle the Inspector.
 *
 * This is a throwaway harness to validate the renderer primitives — the
 * production scene orchestration arrives at Jalon 4 (DOM scene FSM).
 */
export function createBabylonPreview(options: BabylonPreviewOptions): BabylonPreview {
  const { canvas, worldLayer, screenLayer, mapUrl, pokemon: pokemonSpawns } = options;

  const engine = new Engine(canvas, false, {
    preserveDrawingBuffer: false,
    stencil: false,
    antialias: false,
  });
  let pixelScale = PIXELATION_SCALE;
  engine.setHardwareScalingLevel(pixelScale);
  const pixelInfo = document.getElementById("pixinfo");
  function applyPixelScale(next: number): void {
    pixelScale = Math.min(PIXELATION_MAX, Math.max(PIXELATION_MIN, next));
    engine.setHardwareScalingLevel(pixelScale);
    updateCamera();
  }

  const scene = new Scene(engine);
  scene.clearColor = new Color4(
    BABYLON_CLEAR_COLOR.r,
    BABYLON_CLEAR_COLOR.g,
    BABYLON_CLEAR_COLOR.b,
    1,
  );

  const cameraAngle = {
    azimuth: BABYLON_CAMERA_AZIMUTH,
    target: BABYLON_CAMERA_AZIMUTH,
    elevation: BABYLON_DIMETRIC_ELEVATION,
  };
  let flatView = false;
  const zoom = { value: 1 };

  const camera = new TargetCamera("ortho", Vector3.Zero(), scene);
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.minZ = 0.1;
  camera.maxZ = 100;
  const cameraTarget = new Vector3(0, 0, 0);

  function updateCamera(): void {
    const { azimuth, elevation } = cameraAngle;
    camera.position.set(
      cameraTarget.x + Math.cos(elevation) * Math.cos(azimuth) * BABYLON_CAMERA_DISTANCE,
      cameraTarget.y + Math.sin(elevation) * BABYLON_CAMERA_DISTANCE,
      cameraTarget.z + Math.cos(elevation) * Math.sin(azimuth) * BABYLON_CAMERA_DISTANCE,
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

  const billboards = pokemonSpawns.map((entry) => {
    const billboard = new DirectionalBillboard({
      scene,
      atlasJsonUrl: `assets/sprites/pokemon/${entry.pokemonId}/atlas.json`,
      atlasPngUrl: `assets/sprites/pokemon/${entry.pokemonId}/atlas.png`,
      offsetsJsonUrl: `assets/sprites/pokemon/${entry.pokemonId}/offsets.json`,
      animation: "Idle",
      worldFacing: 0,
      pixelsPerWorldUnit: BABYLON_SPRITE_PIXELS_PER_UNIT,
    });
    void billboard.load();
    return { billboard, spawn: entry.spawn };
  });

  // World-anchored HUD demo (Jalon 2a): one HP bar per sprite, anchored at its
  // head and re-projected to screen pixels every frame. Proves the projection
  // helper + 60fps with N transformed DOM elements (plan 119 §4-A, bloquant perf).
  const anchors: WorldAnchor[] = billboards.map((_entry, index) => {
    const element = document.createElement("div");
    element.className = "world-healthbar";
    const track = document.createElement("div");
    track.className = "world-healthbar-track";
    const fill = document.createElement("div");
    fill.className = "world-healthbar-fill";
    fill.style.width = `${Math.round((1 - index * 0.1) * 100)}%`;
    track.append(fill);
    element.append(track);
    worldLayer.append(element);
    return { element, worldPosition: new Vector3() };
  });

  // Screen-anchored chrome demo (Jalon 2b): a real DOM InfoPanel in `.ui-screen`,
  // scaled by container-query units (tracks the game box, not the browser) with a
  // mobile reflow breakpoint. Proves the category-B contract (plan 119 §4-B).
  // Static demo data until combat wires the core→view-model adapter at Jalon 4.
  const infoPanel = createInfoPanel();
  screenLayer.append(infoPanel.element);
  infoPanel.update({
    name: "Pikachu",
    level: 50,
    gender: "male",
    hpCurrent: 98,
    hpMax: 142,
    team: 1,
    portraitUrl: "assets/sprites/pokemon/pikachu/portrait-normal.png",
    badges: [
      { label: "Vit. +1", variant: "buff" },
      { label: "Déf. -1", variant: "debuff" },
      { label: "Confus", variant: "volatile" },
    ],
  });

  // Team Builder under the contract (Jalon 2c): a full-screen complex panel
  // mounted in `.ui-screen`, filling the stage box and scaling via the cqw
  // token overrides in `team-builder-overlay.css`. Hidden by default; press `t`
  // to overlay it on the scene (proves the contract holds beyond the InfoPanel).
  const teamEdit = createTeamEditHarness();
  teamEdit.element.hidden = true;
  screenLayer.append(teamEdit.element);

  // Live sprite-size tuning: lower px/unit = bigger sprite + bigger (chunkier)
  // texels. At 24 the sprite texels match the 24px terrain textures exactly.
  let spritePpu = BABYLON_SPRITE_PIXELS_PER_UNIT;
  function applySpritePpu(next: number): void {
    spritePpu = Math.min(96, Math.max(6, next));
    for (const { billboard } of billboards) {
      billboard.setPixelsPerWorldUnit(spritePpu);
    }
    if (pixelInfo) {
      const ratio = spritePpu === 24 ? "MATCH tile" : `${(24 / spritePpu).toFixed(2)}× tile`;
      pixelInfo.textContent = `sprite ${spritePpu}px/u · ${ratio}`;
    }
  }
  applySpritePpu(spritePpu);

  let terrain: ExtrudedTerrain | null = null;
  let centerMarkers: TransformNode | null = null;
  let tileGrid: TransformNode | null = null;
  let loadCancelled = false;
  loadTiledMap(mapUrl)
    .then((loaded) => {
      if (loadCancelled) {
        return;
      }
      terrain = extrudeTerrain(scene, loaded);
      centerMarkers = createTileCenterMarkers(scene, loaded);
      centerMarkers.setEnabled(false);
      tileGrid = createTileGrid(scene, loaded);
      tileGrid.setEnabled(false);
      const { width, height } = loaded.map;
      for (const { billboard, spawn } of billboards) {
        const cellHeight = loaded.visualTiles[spawn.y]?.[spawn.x]?.height ?? 0;
        const standOn = tileTopCenter(spawn.x, spawn.y, cellHeight, width, height);
        billboard.root.position.set(standOn.x, standOn.y, standOn.z);
      }
    })
    .catch((error) => {
      // biome-ignore lint/suspicious/noConsole: dev-only preview harness (removed Jalon 5)
      console.error("Failed to load map", mapUrl, error);
    });

  const keys = new Set<string>();
  let inspectorVisible = false;

  async function toggleInspector(): Promise<void> {
    if (inspectorVisible) {
      scene.debugLayer.hide();
      inspectorVisible = false;
      return;
    }
    await import("@babylonjs/inspector");
    await scene.debugLayer.show({ overlay: true, embedMode: true });
    inspectorVisible = true;
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    keys.add(event.key);
    if (event.key === "i" || event.key === "I") {
      void toggleInspector();
    }
    // 90° snaps: edge-triggered so a single press rotates exactly one iso view.
    if (event.key === "ArrowLeft") {
      cameraAngle.target -= BABYLON_AZIMUTH_STEP;
    }
    if (event.key === "ArrowRight") {
      cameraAngle.target += BABYLON_AZIMUTH_STEP;
    }
    if (event.key === "c" || event.key === "C") {
      centerMarkers?.setEnabled(!centerMarkers.isEnabled());
    }
    if (event.key === "g" || event.key === "G") {
      tileGrid?.setEnabled(!tileGrid.isEnabled());
    }
    // t = toggle the Team Builder overlay (Jalon 2c contract proof). Hide the
    // debug hint while it's up so the legend doesn't sit over the topbar.
    if (event.key === "t" || event.key === "T") {
      teamEdit.element.hidden = !teamEdit.element.hidden;
      document.getElementById("hint")?.toggleAttribute("hidden", !teamEdit.element.hidden);
    }
    // Framebuffer pixelation: k = sharper, l = chunkier.
    if (event.key === "k" || event.key === "K") {
      applyPixelScale(pixelScale - 1);
    }
    if (event.key === "l" || event.key === "L") {
      applyPixelScale(pixelScale + 1);
    }
    // Sprite size: o = bigger sprite (bigger texels), p = smaller (finer texels).
    if (event.key === "o" || event.key === "O") {
      applySpritePpu(spritePpu - 2);
    }
    if (event.key === "p" || event.key === "P") {
      applySpritePpu(spritePpu + 2);
    }
    // v = toggle flat front view (elevation ~0) vs dimetric iso, to compare 2D vs iso.
    if (event.key === "v" || event.key === "V") {
      flatView = !flatView;
      cameraAngle.elevation = flatView ? 0.001 : BABYLON_DIMETRIC_ELEVATION;
      cameraAngle.target = flatView ? 0 : BABYLON_CAMERA_AZIMUTH;
      cameraAngle.azimuth = cameraAngle.target;
      updateCamera();
    }
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    keys.delete(event.key);
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

  // Left-drag pans the camera target in the view plane (frame a Pokemon, then zoom).
  let dragging = false;
  let previousPointerX = 0;
  let previousPointerY = 0;
  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return;
    }
    dragging = true;
    previousPointerX = event.clientX;
    previousPointerY = event.clientY;
  };
  const onPointerUp = (): void => {
    dragging = false;
  };
  const onPointerMove = (event: PointerEvent): void => {
    if (!dragging) {
      return;
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
    updateCamera();
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("resize", onResize);
  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointermove", onPointerMove);

  let lastTime = performance.now();
  // Reused each frame so the shared view-projection matrix is built once, not per sprite.
  const viewProjection = new Matrix();
  engine.runRenderLoop(() => {
    const now = performance.now();
    const deltaSeconds = (now - lastTime) / 1000;
    lastTime = now;

    const facingSpeed = 1.5 * deltaSeconds;
    let cameraDirty = false;
    // Ease the azimuth toward the snapped target (smooth 90° turn).
    const azimuthDelta = cameraAngle.target - cameraAngle.azimuth;
    if (Math.abs(azimuthDelta) > BABYLON_AZIMUTH_LERP_EPSILON) {
      cameraAngle.azimuth += azimuthDelta * Math.min(1, BABYLON_ROTATION_LERP * deltaSeconds);
      cameraDirty = true;
    } else if (cameraAngle.azimuth !== cameraAngle.target) {
      cameraAngle.azimuth = cameraAngle.target;
      cameraDirty = true;
    }
    const facingDelta =
      keys.has("a") || keys.has("A")
        ? -facingSpeed
        : keys.has("z") || keys.has("Z")
          ? facingSpeed
          : 0;
    if (cameraDirty) {
      updateCamera();
    }

    camera.getViewMatrix().multiplyToRef(camera.getProjectionMatrix(), viewProjection);
    billboards.forEach(({ billboard }, index) => {
      if (facingDelta !== 0) {
        billboard.setWorldFacing(billboard.worldFacing.value + facingDelta);
      }
      billboard.update(deltaSeconds * 1000, cameraAngle.azimuth, viewProjection);
      // Anchor the HP bar at the sprite head (root + current sprite top).
      const anchor = anchors[index];
      if (anchor) {
        anchor.worldPosition.copyFrom(billboard.root.position);
        anchor.worldPosition.y += billboard.spriteTopOffsetY;
      }
    });
    scene.render();
    projectAnchors(scene, camera, anchors, canvas.clientWidth, canvas.clientHeight);
  });

  return {
    dispose: () => {
      loadCancelled = true;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointermove", onPointerMove);
      for (const { billboard } of billboards) {
        billboard.dispose();
      }
      for (const anchor of anchors) {
        anchor.element.remove();
      }
      infoPanel.destroy();
      teamEdit.destroy();
      terrain?.dispose();
      centerMarkers?.dispose();
      tileGrid?.dispose();
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
    },
  };
}
