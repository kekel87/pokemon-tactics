import { loadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { Scene } from "@babylonjs/core/scene";
import type { MapDefinition } from "@pokemon-tactic/core";
import { DecorationKind, type DecorationObject } from "@pokemon-tactic/data";
import { planDecorations, voxelWorldSize } from "@pokemon-tactic/view-core";
// Side-effect: registers the glTF 2.0 loader used by loadAssetContainerAsync.
import "@babylonjs/loaders/glTF/2.0";
import {
  BABYLON_SPRITE_PIXELS_PER_UNIT,
  BABYLON_SPRITE_RENDERING_GROUP,
  BABYLON_TILE_HEIGHT_SCALE,
} from "./babylon-constants.js";
import type { TileHeightLookup } from "./babylon-tile-highlights.js";
import { DecorationWindPlugin } from "./shaders/decoration-wind-plugin.js";
import { gridToWorldXZ, tileTopCenter } from "./terrain-extruder.js";

/**
 * Voxel GLB basename per decoration kind, in `public/assets/decorations/`. Kept in the voxel tool's
 * native export naming (matches the `.gox` sources; human decision — avoids renaming on re-export).
 * 1 voxel per glTF unit → scaled to 1 voxel = 1 sprite pixel like the hazards (plan 131).
 */
const DECORATION_MODEL_FILE: Readonly<Record<DecorationKind, string>> = {
  [DecorationKind.TallGrass]: "tall_grass",
  [DecorationKind.Rock1]: "rock-1x1x1",
  [DecorationKind.Rock2x2]: "rock-2x2x2",
  [DecorationKind.Tree]: "tree",
};
const DECORATION_MODEL_BASE = "assets/decorations";

const decorationModelUrl = (kind: DecorationKind): string =>
  `${DECORATION_MODEL_BASE}/${DECORATION_MODEL_FILE[kind]}.glb`;

/**
 * Idle wind for the tree foliage + tall-grass (FFTA "alive" feel). Applied as a GPU vertex
 * displacement weighted by height (`DecorationWindPlugin`): the base is pinned (weight 0 → trunk,
 * roots and grass foot stay planted, nothing dips under the map) and the sway ramps to full at the
 * top, so only the canopy/blades move. A per-vertex spatial phase (from world XZ) makes a field ripple
 * instead of moving as one block. Rocks get no plugin (inert). Amplitudes are the world-unit horizontal
 * throw of the very top at full lean — tree gentle, grass springier.
 */
const WIND_PERIOD_MS = 2600;
const TREE_WIND_AMPLITUDE = 0.035;
const GRASS_WIND_AMPLITUDE = 0.07;

interface DecorationTemplate {
  readonly mesh: Mesh;
  /** World-unit lift so the model's floor lands on the tile top (`-boundingBox.min.y`). */
  readonly lift: number;
  /**
   * Rendered mesh height expressed in TILE-HEIGHT units (block units) — the cursor/flyer surface the
   * decoration adds on top of a footprint cell. `surfaceHeightAt` adds this to the raw ground height
   * (also block units) before `tileTopCenter` scales the sum, so the mesh's world height is divided
   * back out by `TILE_HEIGHT_SCALE` here to land the cursor exactly on the visible top.
   */
  readonly blockHeight: number;
}

export interface Decorations {
  /**
   * Height in tile units a rock/tree adds on top of a footprint cell, so the
   * cursor rests on the decoration's top instead of clipping through it (0 for
   * free cells and tall-grass, which units stand in).
   */
  decorationHeightAt(x: number, y: number): number;
  dispose(): void;
}

/**
 * Static voxel decoration meshes (rocks/trees + auto-placed tall-grass) resting on the tile top —
 * same pipeline as the entry-hazard props (plan 131): each GLB is loaded once as a disabled template
 * and cloned as a lightweight instance per placement. They occlude via the real depth buffer in
 * rendering group 0 (terrain group), so a Pokémon behind a rock/tree is hidden like the terrain hides
 * it. Décision #475 (billboards 2D) remplacée par le voxel (re-modélisation Goxel). Pure map data.
 */
export function createDecorations(
  scene: Scene,
  map: MapDefinition,
  decorationObjects: readonly DecorationObject[],
  heightAt: TileHeightLookup,
): Decorations {
  const { width: mapWidth, height: mapHeight } = map;
  const root = new TransformNode("decorations", scene);
  const templates = new Map<DecorationKind, DecorationTemplate>();
  const instances: Mesh[] = [];
  const windPlugins: DecorationWindPlugin[] = [];
  // Rendered top (world units above the tile) per footprint cell so the cursor rests on the art and
  // flyers rise onto it. Filled once the templates load (their bounding box gives the true height).
  const obstacleHeightByCell = new Map<string, number>();
  let disposed = false;

  /**
   * Place one instance of `kind` centred over its footprint: XZ = footprint centre, Y = anchor tile
   * top + the model's lift (its floor lands on the tile). Records the rendered top per cell (rocks/
   * trees only — units stand IN tall-grass, so it adds no cursor height).
   */
  function place(
    template: DecorationTemplate,
    kind: DecorationKind,
    anchorX: number,
    anchorY: number,
    footprintWidth: number,
    footprintHeight: number,
  ): void {
    const centreCol = anchorX + (footprintWidth - 1) / 2;
    const centreRow = anchorY - (footprintHeight - 1) / 2;
    const { x: worldX, z: worldZ } = gridToWorldXZ(centreCol, centreRow, mapWidth, mapHeight);
    const top = tileTopCenter(anchorX, anchorY, heightAt(anchorX, anchorY), mapWidth, mapHeight);

    const isGrass = kind === DecorationKind.TallGrass;
    const instance = template.mesh.clone(`decoration_${kind}_${anchorX}_${anchorY}`);
    instance.setEnabled(true);
    instance.isPickable = false;
    instance.position.set(worldX, top.y + template.lift, worldZ);
    // Rocks/trees: group 0 (with the terrain) — they occlude via the real depth buffer, so a Pokémon
    // behind one is hidden like the terrain hides it, and its silhouette (group 1, depth-tested vs the
    // terrain group) IS revealed through it (intentional, matches terrain). Tall-grass: the SPRITE
    // group (2) instead — units stand IN it, so it must NOT feed the silhouette pass (else a unit in
    // the grass shows an X-ray silhouette through the blades). It still occludes the lower body,
    // depth-sorted with the sprites. A different group clears the depth buffer, hence exactly these two.
    instance.renderingGroupId = isGrass ? BABYLON_SPRITE_RENDERING_GROUP : 0;
    instance.parent = root;
    instances.push(instance);
    // Wind lives on the shared per-kind material (GPU vertex displacement), so a cloned instance needs
    // no per-instance wiring here — the plugin was attached to the template's material at load time.

    if (!isGrass) {
      for (let dy = 0; dy < footprintHeight; dy++) {
        for (let dx = 0; dx < footprintWidth; dx++) {
          obstacleHeightByCell.set(`${anchorX + dx},${anchorY - dy}`, template.blockHeight);
        }
      }
    }
  }

  // Placement plan (explicit rocks/trees + auto-placed tall-grass) is pure map data, shared across
  // engine adapters. Deferred until every referenced template has loaded.
  const placements = planDecorations(map, decorationObjects);
  const kinds = new Set(placements.map((placement) => placement.kind));

  void Promise.all(
    [...kinds].map(async (kind) => {
      const container = await loadAssetContainerAsync(decorationModelUrl(kind), scene);
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
      merged.name = `decoration_template_${kind}`;
      normalizeMesh(merged);
      const material = replaceWithStandardMaterial(merged, scene, kind);
      // VEC4 vertex colours auto-enable transparency + show back faces; the props are opaque.
      merged.hasVertexAlpha = false;
      merged.isPickable = false;
      merged.setEnabled(false);
      merged.parent = root;
      const bounds = merged.getBoundingInfo().boundingBox;
      // Tree + tall-grass sway in the wind: attach the height-weighted vertex-displacement plugin to
      // their (shared, per-kind) material, keyed on the mesh's own vertical bounds so weight 0 sits at
      // the exact floor. Every clone of this template inherits it automatically.
      if (kind === DecorationKind.Tree || kind === DecorationKind.TallGrass) {
        const amplitude =
          kind === DecorationKind.TallGrass ? GRASS_WIND_AMPLITUDE : TREE_WIND_AMPLITUDE;
        windPlugins.push(
          new DecorationWindPlugin(
            material,
            amplitude,
            bounds.minimum.y,
            bounds.maximum.y - bounds.minimum.y,
          ),
        );
      }
      templates.set(kind, {
        mesh: merged,
        lift: -bounds.minimum.y,
        blockHeight: (bounds.maximum.y - bounds.minimum.y) / BABYLON_TILE_HEIGHT_SCALE,
      });
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
      for (const placement of placements) {
        const template = templates.get(placement.kind);
        if (!template) {
          continue;
        }
        place(
          template,
          placement.kind,
          placement.anchorX,
          placement.anchorY,
          placement.footprintWidth,
          placement.footprintHeight,
        );
      }
    })
    .catch((error) => {
      // biome-ignore lint/suspicious/noConsole: surfacing a fatal decoration-asset load failure
      console.error("Failed to load decoration models", error);
    });

  // Advance the wind clock once per frame and push it to every wind material. Elapsed wraps at the
  // period so the shader's sine argument (and float precision) stays bounded over long sessions.
  let windElapsedMs = 0;
  const windObserver: Observer<Scene> = scene.onBeforeRenderObservable.add(() => {
    if (windPlugins.length === 0) {
      return;
    }
    windElapsedMs = (windElapsedMs + scene.getEngine().getDeltaTime()) % WIND_PERIOD_MS;
    const wave = (2 * Math.PI * windElapsedMs) / WIND_PERIOD_MS;
    for (const plugin of windPlugins) {
      plugin.time = wave;
    }
  });

  return {
    decorationHeightAt: (x, y) => obstacleHeightByCell.get(`${x},${y}`) ?? 0,
    dispose: () => {
      disposed = true;
      scene.onBeforeRenderObservable.remove(windObserver);
      for (const instance of instances) {
        instance.dispose();
      }
      instances.length = 0;
      windPlugins.length = 0;
      for (const template of templates.values()) {
        template.mesh.dispose();
      }
      templates.clear();
      root.dispose(false, true);
    },
  };
}

/**
 * Bake the glTF coordinate conversion (goxel exports Z-up, corrected by the root node matrix) and
 * scale to 1 voxel = 1 sprite pixel — PRESERVING the model's authored transform (no X/Z recentre, no
 * ground snap). Each decoration's floor is mapped onto the tile top at placement time via `lift`.
 */
function normalizeMesh(mesh: Mesh): void {
  mesh.setParent(null);
  mesh.bakeCurrentTransformIntoVertices();
  mesh.scaling.setAll(voxelWorldSize(BABYLON_SPRITE_PIXELS_PER_UNIT));
  mesh.bakeCurrentTransformIntoVertices();
  mesh.refreshBoundingInfo();
}

/** Flat StandardMaterial (preserving vertex colours) so no PBR env texture loads (teardown-safe). */
function replaceWithStandardMaterial(mesh: Mesh, scene: Scene, key: string): StandardMaterial {
  const source = mesh.material;
  const standard = new StandardMaterial(`decoration_${key}`, scene);
  if (source instanceof PBRMaterial) {
    standard.diffuseColor = source.albedoColor.clone();
    standard.diffuseTexture = source.albedoTexture ?? null;
  }
  mesh.material = standard;
  source?.dispose();
  return standard;
}
