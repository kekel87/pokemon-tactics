import { Material } from "@babylonjs/core/Materials/material";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Matrix } from "@babylonjs/core/Maths/math.vector";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import type { MapDefinition } from "@pokemon-tactic/core";
import { DecorationKind, type DecorationObject } from "@pokemon-tactic/data";
import { planDecorations } from "@pokemon-tactic/view-core";
import {
  BABYLON_DECORATION_DEPTH_BIAS,
  BABYLON_DECORATION_FOOT_DROP,
  BABYLON_SPRITE_PIXELS_PER_UNIT,
  BABYLON_SPRITE_RENDERING_GROUP,
} from "./babylon-constants.js";
import type { TileHeightLookup } from "./babylon-tile-highlights.js";
import { SpriteDepthPlugin } from "./sprite-depth-plugin.js";
import { gridToWorldXZ, tileBodyHeight } from "./terrain-extruder.js";

/** Decoration tile-set PNGs (under `/assets/tilesets/decorations`). */
const DECORATION_TEXTURE_BY_KIND: Readonly<Record<DecorationKind, string>> = {
  [DecorationKind.TallGrass]: "tall-grass",
  [DecorationKind.Rock1]: "rock-1x1x1",
  [DecorationKind.Rock2x2]: "rock-2x2x2",
  [DecorationKind.Tree]: "tree-1x1x3",
};
const DECORATION_TEXTURE_BASE = "/assets/tilesets/decorations";

interface DecorationBillboard {
  readonly root: TransformNode;
  readonly depthPlugin: SpriteDepthPlugin;
}

export interface Decorations {
  /** Per-frame: flatten each occluding decoration to its foot depth (occlusion as the camera turns). */
  update(viewProjection: Matrix): void;
  /**
   * Height in tile units a rock/tree adds on top of a footprint cell, so the
   * cursor rests on the decoration's top instead of clipping through it (0 for
   * free cells and tall-grass, which units stand in).
   */
  decorationHeightAt(x: number, y: number): number;
  dispose(): void;
}

/**
 * Static 2D decoration billboards (rocks/trees + auto-placed tall-grass) that
 * always face the camera (BILLBOARDMODE_Y, like the Pokémon sprites). Rocks/trees
 * occlude via the same per-instance foot-depth flatten; tall-grass never writes
 * depth so it neither hides a Pokémon nor triggers its X-ray silhouette (units
 * stand IN the grass). Décision #475 (tout en 2D face caméra). Pure map data.
 */
export function createDecorations(
  scene: Scene,
  map: MapDefinition,
  decorationObjects: readonly DecorationObject[],
  heightAt: TileHeightLookup,
): Decorations {
  const { width: mapWidth, height: mapHeight } = map;
  const root = new TransformNode("decorations", scene);
  // Texture cached per kind; each decoration gets its OWN material so its
  // SpriteDepthPlugin holds a per-instance foot depth (shared material → one
  // depth for all = broken sort).
  const textureByKind = new Map<DecorationKind, Texture>();
  const materials: StandardMaterial[] = [];
  const billboards: DecorationBillboard[] = [];

  function textureFor(kind: DecorationKind): Texture {
    const cached = textureByKind.get(kind);
    if (cached) {
      return cached;
    }
    const texture = new Texture(
      `${DECORATION_TEXTURE_BASE}/${DECORATION_TEXTURE_BY_KIND[kind]}.png`,
      scene,
      true,
      true,
      Texture.NEAREST_SAMPLINGMODE,
    );
    texture.hasAlpha = true;
    textureByKind.set(kind, texture);
    return texture;
  }

  /**
   * Spawn a billboard for `kind` standing on its footprint. The anchor is the
   * footprint's near corner; the billboard is centred over the whole footprint
   * (a 2×2 rock sits in the middle of its 4 tiles) and its frame centre sits on
   * the tile-top centre — same grounding as the Pokémon sprites (lower half
   * overlaps the tile front for the 2.5D look).
   */
  function place(
    kind: DecorationKind,
    anchorX: number,
    anchorY: number,
    footprintWidth: number,
    footprintHeight: number,
  ): void {
    const texture = textureFor(kind);
    const material = new StandardMaterial(`decoration_${kind}_${anchorX}_${anchorY}`, scene);
    material.diffuseTexture = texture;
    material.emissiveColor = new Color3(1, 1, 1);
    material.disableLighting = true;
    material.useAlphaFromDiffuseTexture = true;
    material.backFaceCulling = false;
    const isGrass = kind === DecorationKind.TallGrass;
    // Crisp alpha-tested edges + depth write (they occlude). Grass occludes too —
    // a Pokémon standing in or behind the grass has its lower body hidden by the
    // nearer blades (foot-depth bias `BABYLON_DECORATION_DEPTH_BIAS` > the sprite's).
    material.transparencyMode = Material.MATERIAL_ALPHATEST;
    material.alphaCutOff = 0.5;
    materials.push(material);

    const centreCol = anchorX + (footprintWidth - 1) / 2;
    const centreRow = anchorY - (footprintHeight - 1) / 2;
    const { x: worldX, z: worldZ } = gridToWorldXZ(centreCol, centreRow, mapWidth, mapHeight);
    const groundY = tileBodyHeight(heightAt(anchorX, anchorY));
    const billboardRoot = new TransformNode(`decoration_${kind}_${anchorX}_${anchorY}`, scene);
    billboardRoot.parent = root;
    billboardRoot.position.set(worldX, groundY, worldZ);

    const plane = MeshBuilder.CreatePlane(
      `decoration_plane_${kind}_${anchorX}_${anchorY}`,
      { size: 1 },
      scene,
    );
    plane.material = material;
    plane.billboardMode = Mesh.BILLBOARDMODE_Y;
    plane.parent = billboardRoot;
    // Grass sits in the SPRITE group (2), not terrain (0): the X-ray silhouette
    // pass (group 1) depth-tests against terrain only, so grass occluding a unit
    // hides it cleanly instead of revealing its silhouette through the blades.
    // Rocks/trees stay in group 0 (their silhouette reveal is intentional).
    plane.renderingGroupId = isGrass ? BABYLON_SPRITE_RENDERING_GROUP : 0;
    plane.isPickable = false;

    const sizePlane = (): void => {
      const size = texture.getSize();
      if (size.height === 0) {
        return;
      }
      const worldHeight = size.height / BABYLON_SPRITE_PIXELS_PER_UNIT;
      plane.scaling.set(worldHeight * (size.width / size.height), worldHeight, 1);
      // Bottom-anchor dropped toward the tile's front vertex so the decoration
      // reads as planted on the tile (grass art is drawn low in its frame, so the
      // same drop seats it without sinking below the tile front — base stays ≥ 0).
      plane.position.y = worldHeight / 2 - BABYLON_DECORATION_FOOT_DROP;
      // Record the rendered top (world units above the tile) per footprint cell so
      // the cursor rests on the art and flyers rise onto it. Use the actual drawn
      // height, NOT the gameplay `heightUnits`: the 2D art is shorter than its
      // collision height, so heightUnits would overshoot the visible decoration.
      if (!isGrass) {
        const surfaceOffset = Math.max(0, worldHeight - BABYLON_DECORATION_FOOT_DROP);
        for (let dy = 0; dy < footprintHeight; dy++) {
          for (let dx = 0; dx < footprintWidth; dx++) {
            obstacleHeightByCell.set(`${anchorX + dx},${anchorY - dy}`, surfaceOffset);
          }
        }
      }
    };
    if (texture.isReady()) {
      sizePlane();
    } else {
      texture.onLoadObservable.addOnce(sizePlane);
    }

    billboards.push({ root: billboardRoot, depthPlugin: new SpriteDepthPlugin(material) });
  }

  // Placement plan (explicit rocks/trees + auto-placed tall-grass) is pure map data,
  // shared across engine adapters. Each rock/tree's rendered top is recorded in `place`
  // (when the texture size is known) so the cursor rests on it and flyers rise onto it.
  const obstacleHeightByCell = new Map<string, number>();
  for (const placement of planDecorations(map, decorationObjects)) {
    place(
      placement.kind,
      placement.anchorX,
      placement.anchorY,
      placement.footprintWidth,
      placement.footprintHeight,
    );
  }

  // Reused each frame so the foot-depth projection allocates no Vector3 per decoration.
  const ndcScratch = new Vector3();
  return {
    update: (viewProjection) => {
      for (const { root: billboardRoot, depthPlugin } of billboards) {
        Vector3.TransformCoordinatesToRef(billboardRoot.position, viewProjection, ndcScratch);
        depthPlugin.footDepth = Math.min(
          1,
          Math.max(0, 0.5 * ndcScratch.z + 0.5 - BABYLON_DECORATION_DEPTH_BIAS),
        );
      }
    },
    decorationHeightAt: (x, y) => obstacleHeightByCell.get(`${x},${y}`) ?? 0,
    dispose: () => {
      // Dispose the meshes only (not materials — textures are shared per kind, so
      // we free materials then textures explicitly below, in the right order).
      root.dispose(false, false);
      for (const material of materials) {
        material.dispose();
      }
      for (const texture of textureByKind.values()) {
        texture.dispose();
      }
    },
  };
}
