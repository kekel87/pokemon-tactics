import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPixelatedPass } from "three/addons/postprocessing/RenderPixelatedPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { DirectionalBillboard } from "./directional-billboard.js";
import { loadTiledMap } from "./load-tiled-map.js";
import { extrudeTerrain } from "./terrain-extruder.js";

const canvas = document.getElementById("app") as HTMLCanvasElement;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const aspect = window.innerWidth / window.innerHeight;
const viewSize = 8;
const camera = new THREE.OrthographicCamera(
  (-viewSize * aspect) / 2,
  (viewSize * aspect) / 2,
  viewSize / 2,
  -viewSize / 2,
  0.1,
  100,
);

const cameraAngle = { azimuth: Math.PI / 4, elevation: Math.atan(1 / Math.sqrt(2)) };
const cameraDistance = 20;
const zoom = { value: 1 };
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 3;
function updateCamera() {
  const { azimuth, elevation } = cameraAngle;
  camera.position.set(
    Math.cos(elevation) * Math.cos(azimuth) * cameraDistance,
    Math.sin(elevation) * cameraDistance,
    Math.cos(elevation) * Math.sin(azimuth) * cameraDistance,
  );
  camera.lookAt(0, 0, 0);
  camera.zoom = zoom.value;
  camera.updateProjectionMatrix();
}
updateCamera();

scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
directionalLight.position.set(5, 10, 5);
scene.add(directionalLight);

const terrainGroup = new THREE.Group();
scene.add(terrainGroup);

const debugMarkersGroup = new THREE.Group();
scene.add(debugMarkersGroup);

function addTileCenterMarker(x: number, y: number, topY: number): void {
  const geometry = new THREE.SphereGeometry(0.06, 8, 8);
  const material = new THREE.MeshBasicMaterial({ color: 0xff3355, depthTest: false });
  const marker = new THREE.Mesh(geometry, material);
  marker.position.set(x, topY, y);
  marker.renderOrder = 999;
  debugMarkersGroup.add(marker);
}

const spriteAnchorMarker = new THREE.Mesh(
  new THREE.SphereGeometry(0.08, 8, 8),
  new THREE.MeshBasicMaterial({ color: 0xffff33, depthTest: false }),
);
spriteAnchorMarker.renderOrder = 1000;
scene.add(spriteAnchorMarker);

const pokemon = new DirectionalBillboard({
  atlasJsonUrl: "/assets/sprites/pokemon/bulbasaur/atlas.json",
  atlasPngUrl: "/assets/sprites/pokemon/bulbasaur/atlas.png",
  animation: "Idle",
  worldFacing: 0,
  frameDurationMs: 140,
  scale: 1,
  footAnchor: 0.34,
});
scene.add(pokemon.object);
void pokemon.load();

const pokemonGridPosition = { x: 4, y: 3 };

function placePokemonOnGrid(width: number, height: number, cellHeight: number): void {
  const worldX = pokemonGridPosition.x - width / 2 + 0.5;
  const worldZ = pokemonGridPosition.y - height / 2 + 0.5;
  const baseHeight = 0.5;
  const totalCellHeight = Math.max(baseHeight, cellHeight + baseHeight);
  pokemon.object.position.set(worldX, totalCellHeight, worldZ);
  spriteAnchorMarker.position.set(worldX, totalCellHeight, worldZ);
}

const MAP_URL = "/assets/maps/sandbox-los.tmj";
loadTiledMap(MAP_URL)
  .then((loaded) => {
    const extruded = extrudeTerrain(loaded);
    terrainGroup.add(extruded.group);
    const { width, height } = loaded.map;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cellHeight = loaded.heightData[y * width + x] ?? 0;
        const baseHeight = 0.5;
        const topY = Math.max(baseHeight, cellHeight + baseHeight);
        addTileCenterMarker(x - width / 2 + 0.5, y - height / 2 + 0.5, topY);
      }
    }
    const cellIndex = pokemonGridPosition.y * width + pokemonGridPosition.x;
    const cellHeight = loaded.heightData[cellIndex] ?? 0;
    placePokemonOnGrid(width, height, cellHeight);
  })
  .catch((error) => {
    console.error("Failed to load map", error);
  });

const composer = new EffectComposer(renderer);
const pixelSize = 4;
const pixelPass = new RenderPixelatedPass(pixelSize, scene, camera);
composer.addPass(pixelPass);
composer.addPass(new OutputPass());

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  composer.setSize(width, height);
  const nextAspect = width / height;
  camera.left = (-viewSize * nextAspect) / 2;
  camera.right = (viewSize * nextAspect) / 2;
  camera.top = viewSize / 2;
  camera.bottom = -viewSize / 2;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener("resize", resize);

const keys = new Set<string>();
window.addEventListener("keydown", (event) => {
  keys.add(event.key);
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

const hudDebug = document.getElementById("hud-debug") as HTMLDivElement;

let lastTime = performance.now();
function animate(now: number) {
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
  if (keys.has("a")) pokemon.setWorldFacing(pokemon.worldFacing.value - facingSpeed);
  if (keys.has("z") || keys.has("w")) {
    pokemon.setWorldFacing(pokemon.worldFacing.value + facingSpeed);
  }
  if (cameraDirty) updateCamera();

  pokemon.update(deltaSeconds * 1000, cameraAngle.azimuth);

  const degrees = (rad: number) => ((rad * 180) / Math.PI).toFixed(0);
  hudDebug.textContent = `grid (${pokemonGridPosition.x},${pokemonGridPosition.y}) · facing=${degrees(pokemon.worldFacing.value)}° · camera=${degrees(cameraAngle.azimuth)}° · display=${pokemon.direction}`;

  composer.render();
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
