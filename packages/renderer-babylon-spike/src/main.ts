import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { TargetCamera } from "@babylonjs/core/Cameras/targetCamera";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";

import { DirectionalBillboard } from "./directional-billboard.js";
import { createPokemonPanel } from "./hud.js";
import { loadTiledMap } from "./load-tiled-map.js";
import { extrudeTerrain } from "./terrain-extruder.js";

const canvas = document.getElementById("app") as HTMLCanvasElement;

const engine = new Engine(canvas, false, {
  preserveDrawingBuffer: false,
  stencil: false,
  antialias: false,
});
engine.setHardwareScalingLevel(1);

const scene = new Scene(engine);
scene.clearColor = new Color4(0x1a / 255, 0x1a / 255, 0x2e / 255, 1);

const VIEW_SIZE = 13;
const cameraAngle = { azimuth: Math.PI / 4, elevation: Math.atan(1 / Math.sqrt(2)) };
const cameraDistance = 20;
const zoom = { value: 1 };
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 3;

const camera = new TargetCamera("ortho", new Vector3(0, 0, 0), scene);
camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
camera.minZ = 0.1;
camera.maxZ = 100;

function updateCamera(): void {
  const { azimuth, elevation } = cameraAngle;
  camera.position.set(
    Math.cos(elevation) * Math.cos(azimuth) * cameraDistance,
    Math.sin(elevation) * cameraDistance,
    Math.cos(elevation) * Math.sin(azimuth) * cameraDistance,
  );
  camera.setTarget(Vector3.Zero());
  const aspect = engine.getRenderWidth() / engine.getRenderHeight();
  const halfWidth = (VIEW_SIZE * aspect) / (2 * zoom.value);
  const halfHeight = VIEW_SIZE / (2 * zoom.value);
  camera.orthoLeft = -halfWidth;
  camera.orthoRight = halfWidth;
  camera.orthoTop = halfHeight;
  camera.orthoBottom = -halfHeight;
}
updateCamera();

const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
hemi.intensity = 0.8;
const dir = new DirectionalLight("dir", new Vector3(-1, -2, -1), scene);
dir.intensity = 0.6;

const pokemonGridPosition = { x: 4, y: 3 };

const pokemon = new DirectionalBillboard({
  scene,
  atlasJsonUrl: "/assets/sprites/pokemon/bulbasaur/atlas.json",
  atlasPngUrl: "/assets/sprites/pokemon/bulbasaur/atlas.png",
  animation: "Idle",
  worldFacing: 0,
  frameDurationMs: 140,
  scale: 1,
  footAnchor: 0.34,
});
void pokemon.load();

const pokemonPanel = createPokemonPanel(scene, "Bulbizarre");

function placePokemonOnGrid(width: number, height: number, cellHeight: number): void {
  const worldX = pokemonGridPosition.x - width / 2 + 0.5;
  const worldZ = pokemonGridPosition.y - height / 2 + 0.5;
  const baseHeight = 0.5;
  const totalCellHeight = Math.max(baseHeight, cellHeight + baseHeight);
  pokemon.root.position.set(worldX, totalCellHeight, worldZ);
}

const MAP_URL = "/assets/maps/sandbox-los.tmj";
loadTiledMap(MAP_URL)
  .then((loaded) => {
    extrudeTerrain(scene, loaded);
    const { width, height } = loaded.map;
    const cellIndex = pokemonGridPosition.y * width + pokemonGridPosition.x;
    const cellHeight = loaded.heightData[cellIndex] ?? 0;
    placePokemonOnGrid(width, height, cellHeight);
  })
  .catch((error) => {
    console.error("Failed to load map", error);
  });

const keys = new Set<string>();
window.addEventListener("keydown", (event) => {
  keys.add(event.key);
  if (event.key === "i" || event.key === "I") {
    void toggleInspector();
  }
});
window.addEventListener("keyup", (event) => {
  keys.delete(event.key);
});
window.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
    zoom.value = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom.value * factor));
    updateCamera();
  },
  { passive: false },
);

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

window.addEventListener("resize", () => {
  engine.resize();
  updateCamera();
});

const hudDebug = document.getElementById("hud-debug") as HTMLDivElement;
let lastTime = performance.now();
let ctAccumulator = 0;

engine.runRenderLoop(() => {
  const now = performance.now();
  const deltaSeconds = (now - lastTime) / 1000;
  lastTime = now;

  const rotationSpeed = 1.5 * deltaSeconds;
  const zoomSpeed = 1.5 * deltaSeconds;
  const facingSpeed = 1.5 * deltaSeconds;
  let cameraDirty = false;
  if (keys.has("ArrowLeft")) {
    cameraAngle.azimuth -= rotationSpeed;
    cameraDirty = true;
  }
  if (keys.has("ArrowRight")) {
    cameraAngle.azimuth += rotationSpeed;
    cameraDirty = true;
  }
  if (keys.has("ArrowUp")) {
    zoom.value = Math.min(ZOOM_MAX, zoom.value * (1 + zoomSpeed));
    cameraDirty = true;
  }
  if (keys.has("ArrowDown")) {
    zoom.value = Math.max(ZOOM_MIN, zoom.value / (1 + zoomSpeed));
    cameraDirty = true;
  }
  if (keys.has("a") || keys.has("A")) {
    pokemon.setWorldFacing(pokemon.worldFacing.value - facingSpeed);
  }
  if (keys.has("z") || keys.has("Z") || keys.has("w")) {
    pokemon.setWorldFacing(pokemon.worldFacing.value + facingSpeed);
  }
  if (cameraDirty) updateCamera();

  pokemon.update(deltaSeconds * 1000, cameraAngle.azimuth);

  ctAccumulator = (ctAccumulator + deltaSeconds * 25) % 120;
  pokemonPanel.setCt(Math.min(100, ctAccumulator));

  const degrees = (rad: number) => ((rad * 180) / Math.PI).toFixed(0);
  hudDebug.textContent = `grid (${pokemonGridPosition.x},${pokemonGridPosition.y}) · facing=${degrees(pokemon.worldFacing.value)}° · camera=${degrees(cameraAngle.azimuth)}° · display=${pokemon.direction}`;

  scene.render();
});
