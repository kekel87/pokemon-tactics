import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { AURA_HOVER_MAX_ICONS, SCREEN_HOVER_AURA_ALPHA, TEXT_COLOR_PRIMARY } from "../constants.js";
import {
  BABYLON_AURA_HOVER_ICON_HEIGHT,
  BABYLON_AURA_HOVER_ICON_OFFSET,
  BABYLON_SPRITE_RENDERING_GROUP,
} from "./babylon-constants.js";
import { createTextPlane, type TextPlane } from "./babylon-text-plane.js";

/** Glyph colour for the ground aura icons — irrelevant for colour-emoji symbols. */
const ICON_CSS = TEXT_COLOR_PRIMARY;

/**
 * Per-symbol offsets around a tile centre, mirroring the Phaser `getAuraHoverOffsets`
 * cross/grid layout (1 centred, 2 side-by-side, … up to 6). `x` is horizontal,
 * `y` is screen-vertical (subtracted from world-Y so positive reads "up-screen").
 */
function hoverOffsets(count: number): readonly { x: number; y: number }[] {
  const offset = BABYLON_AURA_HOVER_ICON_OFFSET;
  switch (count) {
    case 1:
      return [{ x: 0, y: 0 }];
    case 2:
      return [
        { x: -offset, y: 0 },
        { x: offset, y: 0 },
      ];
    case 3:
      return [
        { x: -offset, y: 0 },
        { x: offset, y: 0 },
        { x: 0, y: -offset },
      ];
    case 4:
      return [
        { x: -offset, y: 0 },
        { x: offset, y: 0 },
        { x: 0, y: offset },
        { x: 0, y: -offset },
      ];
    case 5:
      return [
        { x: -offset, y: offset },
        { x: offset, y: offset },
        { x: -offset, y: -offset },
        { x: offset, y: -offset },
        { x: 0, y: 0 },
      ];
    default:
      return [
        { x: -offset, y: offset },
        { x: offset, y: offset },
        { x: -offset, y: 0 },
        { x: offset, y: 0 },
        { x: -offset, y: -offset },
        { x: offset, y: -offset },
      ];
  }
}

/** A tile to mark with aura symbols (world top-face centre, already lifted off the floor). */
export interface AuraGroundAnchor {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface AuraGroundIcons {
  /** Replace the symbols painted over every aura-radius tile (empty clears). */
  set(anchors: readonly AuraGroundAnchor[], symbols: readonly string[]): void;
  dispose(): void;
}

/**
 * Ground aura hover icons for the Babylon combat scene: when the pointer rests on
 * an aura caster, the caster's screen symbols (🛡️/✨/🌫️/🕊️) are floated over every
 * tile of its Manhattan aura radius. Mirrors `IsometricGrid.showTeamAuraHoverIcons`.
 * Transient — built on hover-in, cleared on hover-out (not per frame).
 */
export function createAuraGroundIcons(scene: Scene): AuraGroundIcons {
  const root = new TransformNode("aura_ground_icons", scene);
  let planes: TextPlane[] = [];
  let pivots: TransformNode[] = [];

  function clear(): void {
    for (const plane of planes) {
      plane.dispose();
    }
    for (const pivot of pivots) {
      pivot.dispose();
    }
    planes = [];
    pivots = [];
  }

  return {
    set: (anchors, symbols) => {
      clear();
      const capped = symbols.slice(0, AURA_HOVER_MAX_ICONS);
      if (capped.length === 0) {
        return;
      }
      const offsets = hoverOffsets(capped.length);
      for (const anchor of anchors) {
        // One billboarded pivot per tile; the symbols offset in its LOCAL frame, so
        // the cross layout is screen-aligned (offsetting in world X/Z would skew it
        // under the dimetric camera). Children inherit the pivot's facing.
        const pivot = new TransformNode("aura_icon_pivot", scene);
        pivot.parent = root;
        pivot.position.set(anchor.x, anchor.y, anchor.z);
        pivot.billboardMode = TransformNode.BILLBOARDMODE_ALL;
        pivots.push(pivot);
        for (let i = 0; i < capped.length; i++) {
          const symbol = capped[i];
          const offset = offsets[i];
          if (symbol === undefined || offset === undefined) {
            continue;
          }
          // Sprite rendering group (not the always-on-top HUD group) so the shared
          // depth buffer masks an icon behind a Pokémon standing in front of it.
          const plane = createTextPlane(scene, {
            text: symbol,
            color: ICON_CSS,
            worldHeight: BABYLON_AURA_HOVER_ICON_HEIGHT,
            renderingGroupId: BABYLON_SPRITE_RENDERING_GROUP,
          });
          plane.material.alpha = SCREEN_HOVER_AURA_ALPHA;
          plane.mesh.parent = pivot;
          // Local Y up = screen up; Phaser offset.y is screen-down, so negate it.
          plane.mesh.position.set(offset.x, -offset.y, 0);
          planes.push(plane);
        }
      }
    },
    dispose: () => {
      clear();
      root.dispose();
    },
  };
}
