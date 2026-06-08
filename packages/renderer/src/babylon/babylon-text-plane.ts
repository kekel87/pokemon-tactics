import { Constants } from "@babylonjs/core/Engines/constants";
import { Material } from "@babylonjs/core/Materials/material";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";
import { FONT_FAMILY } from "../constants.js";
import { BABYLON_HUD_TEXT_FONT_PX, BABYLON_HUD_TEXT_PADDING_PX } from "./babylon-constants.js";

/** Shared offscreen canvas for measuring text width before sizing the texture. */
let measureContext: CanvasRenderingContext2D | null = null;
function getMeasureContext(): CanvasRenderingContext2D {
  if (!measureContext) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("babylon-text-plane: 2D canvas context unavailable");
    }
    measureContext = context;
  }
  return measureContext;
}

function fontString(fontPx: number): string {
  return `bold ${fontPx}px ${FONT_FAMILY}`;
}

export interface TextPlaneOptions {
  readonly text: string;
  /** CSS colour of the glyphs (data-driven). */
  readonly color: string;
  /** On-screen world height of the plane (tiles); width derives from the text aspect. */
  readonly worldHeight: number;
  /** Rendering group (HUD = always-on-top group). */
  readonly renderingGroupId: number;
  /** Glyph outline colour (default black). */
  readonly strokeColor?: string;
  /** Glyph outline thickness in canvas px (default 0 = none). */
  readonly strokePx?: number;
  /** Font size on the rasterised canvas (default BABYLON_HUD_TEXT_FONT_PX). */
  readonly fontPx?: number;
  /** Billboard the plane to always face the camera (standalone labels; default false). */
  readonly billboard?: boolean;
}

export interface TextPlane {
  readonly mesh: Mesh;
  readonly material: StandardMaterial;
  readonly texture: DynamicTexture;
  dispose(): void;
}

/**
 * Rasterise a line of pixel-font text onto a fitted NEAREST DynamicTexture and
 * wrap it in a flat plane mesh (no per-mesh billboard — the caller parents it to a
 * billboarded anchor, like `DirectionalBillboard`'s sprite pivot). Used for every
 * in-engine HUD label: floating combat text, the damage-preview number and the
 * Champ counter pill (decision #487 — world UI rendered in engine, not DOM).
 *
 * Best-practice (agent, 2026): NEAREST sampling + a texture sized to the measured
 * text keeps the glyphs crisp without canvas-redraw-per-frame; the plane carries an
 * alpha-blended emissive material with depth-write disabled so it sorts cleanly in
 * the top HUD rendering group.
 */
export function createTextPlane(scene: Scene, options: TextPlaneOptions): TextPlane {
  const fontPx = options.fontPx ?? BABYLON_HUD_TEXT_FONT_PX;
  const strokePx = options.strokePx ?? 0;
  const padding = BABYLON_HUD_TEXT_PADDING_PX + strokePx;

  const measure = getMeasureContext();
  measure.font = fontString(fontPx);
  const measured = measure.measureText(options.text).width;
  const textureWidth = Math.max(1, Math.ceil(measured) + padding * 2);
  const textureHeight = fontPx + padding * 2;

  const texture = new DynamicTexture(
    "hud_text",
    { width: textureWidth, height: textureHeight },
    scene,
    false,
    Constants.TEXTURE_NEAREST_SAMPLINGMODE,
  );
  texture.hasAlpha = true;

  const context = texture.getContext() as CanvasRenderingContext2D;
  context.clearRect(0, 0, textureWidth, textureHeight);
  context.font = fontString(fontPx);
  context.textAlign = "center";
  context.textBaseline = "middle";
  const centerX = textureWidth / 2;
  const centerY = textureHeight / 2;
  if (strokePx > 0) {
    context.lineJoin = "round";
    context.strokeStyle = options.strokeColor ?? "#000000";
    context.lineWidth = strokePx;
    context.strokeText(options.text, centerX, centerY);
  }
  context.fillStyle = options.color;
  context.fillText(options.text, centerX, centerY);
  texture.update(true);

  const material = new StandardMaterial("hud_text_mat", scene);
  material.diffuseTexture = texture;
  material.emissiveColor = new Color3(1, 1, 1);
  material.disableLighting = true;
  material.useAlphaFromDiffuseTexture = true;
  material.backFaceCulling = false;
  material.transparencyMode = Material.MATERIAL_ALPHABLEND;
  material.disableDepthWrite = true;

  const worldWidth = options.worldHeight * (textureWidth / textureHeight);
  const mesh = MeshBuilder.CreatePlane(
    "hud_text_plane",
    { width: worldWidth, height: options.worldHeight },
    scene,
  );
  mesh.material = material;
  mesh.isPickable = false;
  mesh.renderingGroupId = options.renderingGroupId;
  if (options.billboard) {
    mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
  }

  return {
    mesh,
    material,
    texture,
    dispose: () => {
      material.dispose();
      texture.dispose();
      mesh.dispose();
    },
  };
}
