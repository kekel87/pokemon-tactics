import { Constants } from "@babylonjs/core/Engines/constants";
import { Material } from "@babylonjs/core/Materials/material";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";
import { CHAMP_PILL_TEXTURE_SIZE, drawChampPillBadge } from "@pokemon-tactic/render-canvas2d";
import { hexToCss } from "./babylon-color.js";
import { BABYLON_CHAMP_PILL_HEIGHT, BABYLON_SPRITE_RENDERING_GROUP } from "./babylon-constants.js";
import { FONT_FAMILY, TEXT_COLOR_PRIMARY } from "./constants.js";

export interface ChampPillOptions {
  /** Turns left, shown centred in the badge. */
  readonly remainingTurns: number;
  /** Owning team colour (badge fill — whose Champ it is). */
  readonly teamColor: number;
  /** Champ identity colour (badge border). */
  readonly borderColor: number;
}

export interface ChampPill {
  readonly mesh: Mesh;
  dispose(): void;
}

/**
 * The Champ-zone turn counter as an IN-ENGINE billboarded badge (decision #487 —
 * world UI rendered in engine, not a DOM-projected pill). A round DynamicTexture
 * (team-colour fill, Champ-colour ring, white number) on a camera-facing plane in
 * the top HUD rendering group. Drawn once per counter change (cheap; no per-frame
 * reprojection, unlike the old `.field-terrain-pill` DOM node).
 */
export function createChampPill(scene: Scene, options: ChampPillOptions): ChampPill {
  const texture = new DynamicTexture(
    "champ_pill",
    { width: CHAMP_PILL_TEXTURE_SIZE, height: CHAMP_PILL_TEXTURE_SIZE },
    scene,
    false,
    Constants.TEXTURE_NEAREST_SAMPLINGMODE,
  );
  texture.hasAlpha = true;

  const context = texture.getContext() as CanvasRenderingContext2D;
  drawChampPillBadge(context, CHAMP_PILL_TEXTURE_SIZE, {
    label: String(options.remainingTurns),
    teamColorCss: hexToCss(options.teamColor),
    borderColorCss: hexToCss(options.borderColor),
    textColorCss: TEXT_COLOR_PRIMARY,
    fontFamily: FONT_FAMILY,
  });
  texture.update(true);

  const material = new StandardMaterial("champ_pill_mat", scene);
  material.diffuseTexture = texture;
  material.emissiveColor = new Color3(1, 1, 1);
  material.disableLighting = true;
  material.useAlphaFromDiffuseTexture = true;
  material.backFaceCulling = false;
  material.transparencyMode = Material.MATERIAL_ALPHABLEND;
  material.disableDepthWrite = true;

  const mesh = MeshBuilder.CreatePlane(
    "champ_pill_plane",
    { width: BABYLON_CHAMP_PILL_HEIGHT, height: BABYLON_CHAMP_PILL_HEIGHT },
    scene,
  );
  mesh.material = material;
  mesh.isPickable = false;
  mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
  // Sprite group (not the always-on-top HUD group) so a Pokémon in front masks it.
  mesh.renderingGroupId = BABYLON_SPRITE_RENDERING_GROUP;

  return {
    mesh,
    dispose: () => {
      material.dispose();
      texture.dispose();
      mesh.dispose();
    },
  };
}
