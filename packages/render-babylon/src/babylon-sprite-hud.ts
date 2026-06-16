import { Constants } from "@babylonjs/core/Engines/constants";
import { Material } from "@babylonjs/core/Materials/material";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import {
  drawHpBar,
  HP_BAR_BORDER_PX,
  HP_BAR_RADIUS_PX,
  HP_BAR_TEXTURE_HEIGHT,
  hpBarTextureWidth,
} from "@pokemon-tactic/render-canvas2d";
import type { AuraIndicatorSpec, DamageEstimateView } from "@pokemon-tactic/render-ports";
import { hexToCss } from "./babylon-color.js";
import {
  BABYLON_HP_BAR_HEIGHT,
  BABYLON_HP_BAR_WIDTH,
  BABYLON_HUD_AURA_FIRST_GAP,
  BABYLON_HUD_AURA_ICON_SIZE,
  BABYLON_HUD_AURA_SLOT_OFFSET,
  BABYLON_HUD_DAMAGE_TEXT_GAP,
  BABYLON_HUD_DAMAGE_TEXT_HEIGHT,
  BABYLON_HUD_RENDERING_GROUP,
  BABYLON_HUD_STATUS_GAP,
  BABYLON_HUD_STATUS_ICON_SIZE,
} from "./babylon-constants.js";
import { createTextPlane, type TextPlane } from "./babylon-text-plane.js";
import {
  DAMAGE_ESTIMATE_ALPHA_GUARANTEED,
  DAMAGE_ESTIMATE_ALPHA_POSSIBLE,
  DAMAGE_ESTIMATE_IMMUNE_COLOR,
  DAMAGE_ESTIMATE_TEXT_COLOR,
  DAMAGE_ESTIMATE_TEXT_STROKE_COLOR,
  HP_BAR_BG_COLOR,
  HP_BAR_BORDER_COLOR,
  STATUS_ASSET_KEY,
  TEXT_COLOR_PRIMARY,
} from "./constants.js";

/** Public path of the status icon PNGs (absolute, like the sprite atlas urls). */
const STATUS_ICON_BASE = "/assets/ui/statuses";

/** HP-bar canvas resolution (shared painter); width derives from the world ratio. */
const BAR_TEXTURE_HEIGHT = HP_BAR_TEXTURE_HEIGHT;
const BAR_TEXTURE_WIDTH = hpBarTextureWidth(BABYLON_HP_BAR_WIDTH, BABYLON_HP_BAR_HEIGHT);

const BAR_BG_CSS = hexToCss(HP_BAR_BG_COLOR);
const BAR_BORDER_CSS = hexToCss(HP_BAR_BORDER_COLOR);
/** Glyph colour for aura icons — irrelevant for colour-emoji symbols, but required by the text plane. */
const AURA_ICON_CSS = TEXT_COLOR_PRIMARY;

export type { AuraIndicatorSpec, DamageEstimateView };

/** Per-sprite HP bar + status icon, driven by the orchestrator. */
export interface SpriteHudHandle {
  /** Set the HP fill ratio (`currentHp / maxHp`, clamped to [0,1]). */
  setHp(currentHp: number, maxHp: number): void;
  /** Show the major status icon (first status effect's type), or clear it when null. */
  setStatus(statusType: string | null): void;
  /** Overlay a predicted-damage band + number on the HP bar (confirm phase), or clear it when null. */
  setDamageEstimate(estimate: DamageEstimateView | null): void;
  /** Replace the team-aura icons stacked to the left of the bar (empty clears). */
  setLeftIndicators(specs: readonly AuraIndicatorSpec[]): void;
  /** Hide both bar + icon (KO) or reveal them again. */
  setVisible(visible: boolean): void;
  /** Remove the meshes from the scene. */
  dispose(): void;
}

export interface SpriteHud {
  /**
   * Create a HUD anchored to a sprite. `parent` is the sprite root (the HUD
   * follows it as it glides); `headLift` returns the world-Y offset of the head
   * above the root (0 until the atlas loads, so it is re-read each frame); the
   * `teamColor` tints the HP fill.
   */
  add(parent: TransformNode, headLift: () => number, teamColor: number): SpriteHudHandle;
  /** Lift each anchor to its sprite head. Call each frame (cheap — one Y set per record). */
  update(): void;
  dispose(): void;
}

interface HudRecord {
  readonly anchor: TransformNode;
  readonly barTexture: DynamicTexture;
  readonly barContext: CanvasRenderingContext2D;
  readonly teamColorCss: string;
  readonly headLift: () => number;
  readonly statusMaterial: StandardMaterial;
  statusIcon: Mesh | null;
  statusTexture: Texture | null;
  currentStatusKey: string;
  damageText: TextPlane | null;
  leftIndicators: TextPlane[];
  currentHp: number;
  maxHp: number;
  estimate: DamageEstimateView | null;
  visible: boolean;
}

/**
 * World-anchored per-sprite HP bars + status icons + damage-preview overlay for the
 * Babylon combat scene, rendered IN ENGINE (decision #487 — world UI is engine, not
 * DOM-projected). HP bar (rounded team-colour fill over a dark rounded track +
 * uniform border, width by HP ratio) + status icon + darkening damage-preview bands.
 *
 * Each HUD hangs under a billboarded `TransformNode` parented to the sprite root (so
 * it follows the glide and faces the camera as a unit — best-practice: billboard the
 * anchor, keep children plain, like DirectionalBillboard). The bar is a single NEAREST
 * DynamicTexture drawn with `roundRect` (crisp + rounded + homogeneous border, redrawn
 * only on HP / preview change). Everything sits in the top HUD rendering group so it
 * always draws over the sprites + terrain.
 */
export function createSpriteHud(scene: Scene): SpriteHud {
  const records = new Set<HudRecord>();

  function redrawBar(record: HudRecord): void {
    drawHpBar(record.barContext, {
      width: BAR_TEXTURE_WIDTH,
      height: BAR_TEXTURE_HEIGHT,
      borderPx: HP_BAR_BORDER_PX,
      radiusPx: HP_BAR_RADIUS_PX,
      backgroundCss: BAR_BG_CSS,
      borderCss: BAR_BORDER_CSS,
      teamColorCss: record.teamColorCss,
      currentHp: record.currentHp,
      maxHp: record.maxHp,
      estimate: record.estimate,
      alphaPossible: DAMAGE_ESTIMATE_ALPHA_POSSIBLE,
      alphaGuaranteed: DAMAGE_ESTIMATE_ALPHA_GUARANTEED,
    });
    record.barTexture.update(true);
  }

  return {
    add: (parent, headLift, teamColor) => {
      const anchor = new TransformNode("hud_anchor", scene);
      anchor.parent = parent;
      anchor.billboardMode = TransformNode.BILLBOARDMODE_ALL;

      const barTexture = new DynamicTexture(
        "hud_hp_bar",
        { width: BAR_TEXTURE_WIDTH, height: BAR_TEXTURE_HEIGHT },
        scene,
        false,
        Constants.TEXTURE_NEAREST_SAMPLINGMODE,
      );
      barTexture.hasAlpha = true;
      const barMaterial = new StandardMaterial("hud_hp_bar_mat", scene);
      barMaterial.diffuseTexture = barTexture;
      barMaterial.emissiveColor = new Color3(1, 1, 1);
      barMaterial.disableLighting = true;
      barMaterial.useAlphaFromDiffuseTexture = true;
      barMaterial.backFaceCulling = false;
      barMaterial.transparencyMode = Material.MATERIAL_ALPHABLEND;
      barMaterial.disableDepthWrite = true;
      const barMesh = MeshBuilder.CreatePlane(
        "hud_hp_bar_plane",
        { width: BABYLON_HP_BAR_WIDTH, height: BABYLON_HP_BAR_HEIGHT },
        scene,
      );
      barMesh.material = barMaterial;
      barMesh.isPickable = false;
      barMesh.renderingGroupId = BABYLON_HUD_RENDERING_GROUP;
      barMesh.parent = anchor;

      // Status icon shares one material; its texture is (re)loaded on status change.
      const statusMaterial = new StandardMaterial("hud_status_mat", scene);
      statusMaterial.emissiveColor = new Color3(1, 1, 1);
      statusMaterial.disableLighting = true;
      statusMaterial.useAlphaFromDiffuseTexture = true;
      statusMaterial.backFaceCulling = false;
      statusMaterial.transparencyMode = Material.MATERIAL_ALPHABLEND;
      statusMaterial.disableDepthWrite = true;

      const context = barTexture.getContext() as CanvasRenderingContext2D;
      const record: HudRecord = {
        anchor,
        barTexture,
        barContext: context,
        teamColorCss: hexToCss(teamColor),
        headLift,
        statusMaterial,
        statusIcon: null,
        statusTexture: null,
        currentStatusKey: "",
        damageText: null,
        leftIndicators: [],
        currentHp: 1,
        maxHp: 1,
        estimate: null,
        visible: true,
      };
      records.add(record);
      redrawBar(record);

      return {
        setHp: (currentHp, maxHp) => {
          record.currentHp = currentHp;
          record.maxHp = maxHp;
          redrawBar(record);
        },
        setStatus: (statusType) => {
          const assetKey = statusType ? STATUS_ASSET_KEY[statusType] : undefined;
          const key = assetKey ?? "";
          if (key === record.currentStatusKey) {
            return;
          }
          record.currentStatusKey = key;
          record.statusTexture?.dispose();
          record.statusTexture = null;
          if (!key) {
            record.statusIcon?.setEnabled(false);
            return;
          }
          const texture = new Texture(
            `${STATUS_ICON_BASE}/icon-${key}.png`,
            scene,
            true,
            true,
            Texture.NEAREST_SAMPLINGMODE,
          );
          texture.hasAlpha = true;
          record.statusMaterial.diffuseTexture = texture;
          record.statusTexture = texture;
          if (!record.statusIcon) {
            const icon = MeshBuilder.CreatePlane(
              "hud_status_icon",
              { width: BABYLON_HUD_STATUS_ICON_SIZE, height: BABYLON_HUD_STATUS_ICON_SIZE },
              scene,
            );
            icon.material = record.statusMaterial;
            icon.isPickable = false;
            icon.renderingGroupId = BABYLON_HUD_RENDERING_GROUP;
            icon.parent = record.anchor;
            record.statusIcon = icon;
          }
          const icon = record.statusIcon;
          icon.setEnabled(true);
          // Keep the source aspect ratio (icons are not square, e.g. 52×36) so the
          // glyph is never stretched; place it just right of the bar once sized.
          texture.onLoadObservable.addOnce(() => {
            const size = texture.getSize();
            const aspect = size.height > 0 ? size.width / size.height : 1;
            icon.scaling.x = aspect;
            icon.position.x =
              BABYLON_HP_BAR_WIDTH / 2 +
              BABYLON_HUD_STATUS_GAP +
              (BABYLON_HUD_STATUS_ICON_SIZE * aspect) / 2;
          });
        },
        setDamageEstimate: (estimate) => {
          record.estimate = estimate;
          redrawBar(record);
          record.damageText?.dispose();
          record.damageText = null;
          if (estimate?.label) {
            const text = createTextPlane(scene, {
              text: estimate.label,
              color: estimate.immune ? DAMAGE_ESTIMATE_IMMUNE_COLOR : DAMAGE_ESTIMATE_TEXT_COLOR,
              worldHeight: BABYLON_HUD_DAMAGE_TEXT_HEIGHT,
              renderingGroupId: BABYLON_HUD_RENDERING_GROUP,
              strokeColor: DAMAGE_ESTIMATE_TEXT_STROKE_COLOR,
              strokePx: 4,
            });
            text.mesh.parent = record.anchor;
            text.mesh.position.y =
              BABYLON_HP_BAR_HEIGHT / 2 +
              BABYLON_HUD_DAMAGE_TEXT_GAP +
              BABYLON_HUD_DAMAGE_TEXT_HEIGHT / 2;
            record.damageText = text;
          }
        },
        setLeftIndicators: (specs) => {
          for (const plane of record.leftIndicators) {
            plane.dispose();
          }
          record.leftIndicators = [];
          // Stack the emoji symbols leftward from the bar's left edge
          // (left-indicator row: first-gap then tight slot offsets).
          const firstX = -BABYLON_HP_BAR_WIDTH / 2 - BABYLON_HUD_AURA_FIRST_GAP;
          const step = BABYLON_HUD_AURA_SLOT_OFFSET;
          for (let i = 0; i < specs.length; i++) {
            const spec = specs[i];
            if (!spec) {
              continue;
            }
            const plane = createTextPlane(scene, {
              text: spec.symbol,
              color: AURA_ICON_CSS,
              worldHeight: BABYLON_HUD_AURA_ICON_SIZE,
              renderingGroupId: BABYLON_HUD_RENDERING_GROUP,
            });
            plane.mesh.parent = record.anchor;
            plane.mesh.position.x = firstX - i * step;
            if (spec.alpha !== undefined) {
              plane.material.alpha = spec.alpha;
            }
            record.leftIndicators.push(plane);
          }
        },
        setVisible: (visible) => {
          if (record.visible === visible) {
            return;
          }
          record.visible = visible;
          record.anchor.setEnabled(visible);
        },
        dispose: () => {
          records.delete(record);
          // Recurses into every child mesh AND frees their materials + textures
          // (bar, status icon, damage label) — see TransformNode.dispose signature.
          record.anchor.dispose(false, true);
        },
      };
    },
    update: () => {
      for (const record of records) {
        if (record.visible) {
          record.anchor.position.y = record.headLift();
        }
      }
    },
    dispose: () => {
      for (const record of records) {
        record.anchor.dispose(false, true);
      }
      records.clear();
    },
  };
}
