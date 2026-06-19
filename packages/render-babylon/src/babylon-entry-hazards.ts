import { loadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { Scene } from "@babylonjs/core/scene";
import type { EntryHazardSpec } from "@pokemon-tactic/render-ports";
import { voxelWorldSize } from "@pokemon-tactic/view-core";
// Side-effect: registers the glTF 2.0 loader used by loadAssetContainerAsync.
import "@babylonjs/loaders/glTF/2.0";
import {
  BABYLON_ENTRY_HAZARD_RENDERING_GROUP,
  BABYLON_SPRITE_PIXELS_PER_UNIT,
} from "./babylon-constants.js";
import type { TileHeightLookup } from "./babylon-tile-highlights.js";
import { tileTopCenter } from "./terrain-extruder.js";

export type { EntryHazardSpec };

/**
 * Voxel GLB basenames in `public/assets/ui/hazards/`, kept in the voxel tool's native snake_case
 * export naming (human decision 2026-06-18 — avoids renaming on every re-export). 1 voxel per glTF
 * unit.
 */
const HAZARD_MODEL_FILES = [
  "hazards_spikes_1",
  "hazards_spikes_2",
  "hazards_spikes_3",
  "hazards_stealth_rock",
  "hazards_sticky_web",
  "hazards_toxic_spikes_1",
  "hazards_toxic_spikes_2",
] as const;
type HazardModelFile = (typeof HAZARD_MODEL_FILES)[number];

const hazardModelUrl = (file: HazardModelFile): string => `assets/ui/hazards/${file}.glb`;

/**
 * The voxel build-volume floor (lowest authored Y across grounded models, read from the GLBs). Models
 * are authored centred on X/Z and share this floor, so grounded pieces rest on it and floating ones
 * (e.g. Pièges de Roc, bottom ≈ -8.5) keep their gap. We lift every model by this much so the volume
 * floor lands on the tile top — no per-model recentring (that would break floating + layer alignment).
 */
const HAZARD_GROUND_LIFT = 12.5 / BABYLON_SPRITE_PIXELS_PER_UNIT;

/** Idle float for Pièges de Roc only (it already hovers): gentle vertical bob, world units + period. */
const STEALTH_ROCK_BOB_FILE = "hazards_stealth_rock";
const STEALTH_ROCK_BOB_AMPLITUDE = 1.2 / BABYLON_SPRITE_PIXELS_PER_UNIT;
const STEALTH_ROCK_BOB_PERIOD_MS = 2600;

/**
 * The cumulative voxel models shown for a hazard cell: stacking Picots/Pics Toxik renders one extra
 * model per layer (the human authored them to sit together on a tile), so 3 Picots = the 3 GLBs.
 */
function modelFilesFor(kind: string, layers: number): HazardModelFile[] {
  switch (kind) {
    case "spikes":
      return (["hazards_spikes_1", "hazards_spikes_2", "hazards_spikes_3"] as const).slice(
        0,
        layers,
      );
    case "toxic-spikes":
      return (["hazards_toxic_spikes_1", "hazards_toxic_spikes_2"] as const).slice(0, layers);
    case "stealth-rock":
      return ["hazards_stealth_rock"];
    case "sticky-web":
      return ["hazards_sticky_web"];
    default:
      return [];
  }
}

export interface EntryHazards {
  /** Replace every placed hazard prop (empty clears). Idempotent. */
  set(specs: readonly EntryHazardSpec[]): void;
  dispose(): void;
}

/**
 * Entry-hazard voxel props (plan 131): per trapped tile, one or more stacked GLB models resting on
 * the tile top (terrain occludes them; sprites draw over them). Models are loaded once as disabled
 * templates and cloned as lightweight instances on each `set`. Team-agnostic — no team colour.
 */
export function createEntryHazardProps(
  scene: Scene,
  heightAt: TileHeightLookup,
  mapWidth: number,
  mapHeight: number,
): EntryHazards {
  const root = new TransformNode("entry_hazards", scene);
  const templates = new Map<HazardModelFile, Mesh>();
  let instances: Mesh[] = [];
  // Pièges de Roc instances + their resting Y, bobbed each frame by the idle-float observer.
  let bobbers: { mesh: Mesh; baseY: number }[] = [];
  let bobElapsedMs = 0;
  let pending: readonly EntryHazardSpec[] = [];
  let ready = false;
  let disposed = false;

  const inBounds = (x: number, y: number): boolean =>
    x >= 0 && x < mapWidth && y >= 0 && y < mapHeight;

  function clearInstances(): void {
    for (const instance of instances) {
      instance.dispose();
    }
    instances = [];
    bobbers = [];
  }

  function place(specs: readonly EntryHazardSpec[]): void {
    clearInstances();
    for (const spec of specs) {
      if (!inBounds(spec.tile.x, spec.tile.y)) {
        continue;
      }
      const top = tileTopCenter(
        spec.tile.x,
        spec.tile.y,
        heightAt(spec.tile.x, spec.tile.y),
        mapWidth,
        mapHeight,
      );
      for (const file of modelFilesFor(spec.kind, spec.layers)) {
        const template = templates.get(file);
        if (!template) {
          continue;
        }
        const instance = template.clone(`hazard_${file}_${spec.tile.x}_${spec.tile.y}`);
        instance.setEnabled(true);
        // Models are authored centred on X/Z, so the tile centre is the anchor; lift so the voxel
        // build-volume floor lands on the tile top (floating pieces keep their authored gap).
        instance.position.set(top.x, top.y + HAZARD_GROUND_LIFT, top.z);
        instance.isPickable = false;
        instance.renderingGroupId = BABYLON_ENTRY_HAZARD_RENDERING_GROUP;
        instance.parent = root;
        instances.push(instance);
        if (file === STEALTH_ROCK_BOB_FILE) {
          bobbers.push({ mesh: instance, baseY: instance.position.y });
        }
      }
    }
  }

  // Idle float: oscillate only the Pièges de Roc instances around their resting Y (FFTA "alive" feel).
  const bobObserver: Observer<Scene> = scene.onBeforeRenderObservable.add(() => {
    if (bobbers.length === 0) {
      return;
    }
    bobElapsedMs = (bobElapsedMs + scene.getEngine().getDeltaTime()) % STEALTH_ROCK_BOB_PERIOD_MS;
    const dy =
      STEALTH_ROCK_BOB_AMPLITUDE *
      Math.sin((2 * Math.PI * bobElapsedMs) / STEALTH_ROCK_BOB_PERIOD_MS);
    for (const bobber of bobbers) {
      bobber.mesh.position.y = bobber.baseY + dy;
    }
  });

  void Promise.all(
    HAZARD_MODEL_FILES.map(async (file) => {
      const container = await loadAssetContainerAsync(hazardModelUrl(file), scene);
      if (disposed || scene.isDisposed) {
        container.dispose();
        return;
      }
      container.addAllToScene();
      const geometryMeshes = container.meshes.filter(
        (mesh): mesh is Mesh => mesh instanceof Mesh && mesh.getTotalVertices() > 0,
      );
      const merged =
        geometryMeshes.length === 1
          ? geometryMeshes[0]
          : Mesh.MergeMeshes(geometryMeshes, true, true);
      if (!merged) {
        return;
      }
      merged.name = `hazard_template_${file}`;
      normalizeMesh(merged);
      replaceWithStandardMaterial(merged, scene, file);
      // VEC4 vertex colours auto-enable transparency + show back faces; the props are opaque.
      merged.hasVertexAlpha = false;
      merged.isPickable = false;
      merged.setEnabled(false);
      merged.parent = root;
      templates.set(file, merged);
      for (const node of container.rootNodes) {
        if (node !== merged) {
          node.dispose();
        }
      }
    }),
  )
    .then(() => {
      if (disposed) {
        return;
      }
      ready = true;
      place(pending);
    })
    .catch((error) => {
      // biome-ignore lint/suspicious/noConsole: surfacing a fatal hazard-asset load failure
      console.error("Failed to load entry-hazard models", error);
    });

  return {
    set: (specs) => {
      pending = specs;
      if (ready) {
        place(specs);
      }
    },
    dispose: () => {
      disposed = true;
      scene.onBeforeRenderObservable.remove(bobObserver);
      clearInstances();
      for (const template of templates.values()) {
        template.dispose();
      }
      templates.clear();
      root.dispose(false, true);
    },
  };
}

/**
 * Bake the glTF coordinate conversion and scale to 1 voxel = 1 sprite pixel — but PRESERVE the
 * model's authored transform (no X/Z recentre, no ground snap). The human exports with "centrer
 * X/Z" and "placer au sol" UNCHECKED on purpose, so each model keeps its hand-placed offset and
 * floating height, and stacked layers keep their relative alignment. We only map the voxel origin
 * (0,0,0) to the tile corner at placement time.
 */
function normalizeMesh(mesh: Mesh): void {
  mesh.setParent(null);
  mesh.bakeCurrentTransformIntoVertices();
  mesh.scaling.setAll(voxelWorldSize(BABYLON_SPRITE_PIXELS_PER_UNIT));
  mesh.bakeCurrentTransformIntoVertices();
}

/** Flat StandardMaterial (preserving vertex colours) so no PBR env texture loads (teardown-safe). */
function replaceWithStandardMaterial(mesh: Mesh, scene: Scene, key: string): void {
  const source = mesh.material;
  const standard = new StandardMaterial(`hazard_${key}`, scene);
  if (source instanceof PBRMaterial) {
    standard.diffuseColor = source.albedoColor.clone();
    standard.diffuseTexture = source.albedoTexture ?? null;
  }
  mesh.material = standard;
  source?.dispose();
}
