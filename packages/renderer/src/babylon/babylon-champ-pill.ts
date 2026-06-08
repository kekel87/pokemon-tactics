import { Constants } from "@babylonjs/core/Engines/constants";
import { Material } from "@babylonjs/core/Materials/material";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";
import { FONT_FAMILY, TEXT_COLOR_PRIMARY } from "../constants.js";
import { hexToCss } from "./babylon-color.js";
import { BABYLON_CHAMP_PILL_HEIGHT, BABYLON_SPRITE_RENDERING_GROUP } from "./babylon-constants.js";

/** Texture resolution of the round counter badge (NEAREST, kept crisp). */
const PILL_TEXTURE_SIZE = 64;

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
    { width: PILL_TEXTURE_SIZE, height: PILL_TEXTURE_SIZE },
    scene,
    false,
    Constants.TEXTURE_NEAREST_SAMPLINGMODE,
  );
  texture.hasAlpha = true;

  const context = texture.getContext() as CanvasRenderingContext2D;
  const center = PILL_TEXTURE_SIZE / 2;
  const ringWidth = 6;
  const radius = center - ringWidth / 2 - 1;
  context.clearRect(0, 0, PILL_TEXTURE_SIZE, PILL_TEXTURE_SIZE);
  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.fillStyle = hexToCss(options.teamColor);
  context.fill();
  context.lineWidth = ringWidth;
  context.strokeStyle = hexToCss(options.borderColor);
  context.stroke();
  const label = String(options.remainingTurns);
  context.font = `bold ${Math.round(PILL_TEXTURE_SIZE * 0.62)}px ${FONT_FAMILY}`;
  context.textAlign = "center";
  // Exact vertical centring: align on the glyph's own ink box (pixel fonts have
  // odd metrics, so "middle" baseline alone leaves the number off-centre).
  context.textBaseline = "alphabetic";
  context.fillStyle = TEXT_COLOR_PRIMARY;
  const metrics = context.measureText(label);
  const baselineY =
    center + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
  context.fillText(label, center, baselineY);
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
