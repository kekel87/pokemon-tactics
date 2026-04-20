import { type MapDefinition, TerrainType } from "@pokemon-tactic/core";
import type { DecorationObject } from "@pokemon-tactic/data";
import {
  DECORATIONS_DEBUG_FOOTPRINT_ALPHA,
  DECORATIONS_DEBUG_FOOTPRINT_COLOR,
  DECORATIONS_DEBUG_FOOTPRINT_DEPTH_OFFSET,
  DECORATIONS_DEBUG_FOOTPRINT_STROKE_ALPHA,
  DECORATIONS_DEBUG_FOOTPRINT_STROKE_WIDTH,
  DECORATIONS_PREVIEW_MODE_ALPHA,
  DECORATIONS_TEXTURE_KEYS,
  DEPTH_DECORATIONS_OBSTACLE_OFFSET,
  DEPTH_DECORATIONS_TALL_GRASS_OFFSET,
  DEPTH_POKEMON_BASE,
  DEPTH_TILE_MAX_ELEVATION,
  TILE_HEIGHT,
  TILE_WIDTH,
} from "../constants";
import type { IsometricGrid } from "./IsometricGrid";
import type { OcclusionFader } from "./OcclusionFader";
import { getSpriteScreenBounds } from "./sprite-bounds";

export interface DecorationsLayerOptions {
  readonly debugFootprintEnabled?: boolean;
  readonly occlusionFader?: OcclusionFader;
}

export class DecorationsLayer {
  private readonly scene: Phaser.Scene;
  private readonly grid: IsometricGrid;
  private readonly sprites: Phaser.GameObjects.Image[] = [];
  private readonly debugShapes: Phaser.GameObjects.Graphics[] = [];
  private readonly obstacleHeightByCell = new Map<string, number>();
  private readonly debugFootprintEnabled: boolean;
  private readonly occlusionFader: OcclusionFader | null;
  private previewMode = false;

  constructor(scene: Phaser.Scene, grid: IsometricGrid, options?: DecorationsLayerOptions) {
    this.scene = scene;
    this.grid = grid;
    this.debugFootprintEnabled = options?.debugFootprintEnabled ?? false;
    this.occlusionFader = options?.occlusionFader ?? null;
  }

  render(map: MapDefinition, objects: readonly DecorationObject[]): void {
    this.clear();

    const occupiedByObject = new Set<string>();
    for (const object of objects) {
      occupiedByObject.add(`${object.anchorX},${object.anchorY}`);
      for (let dy = 0; dy < object.footprintHeight; dy++) {
        for (let dx = 0; dx < object.footprintWidth; dx++) {
          const cellX = object.anchorX + dx;
          const cellY = object.anchorY - dy;
          this.obstacleHeightByCell.set(`${cellX},${cellY}`, object.heightUnits);
        }
      }
      this.placeObjectSprite(object, map);
    }

    for (let y = 0; y < map.height; y++) {
      const row = map.tiles[y];
      if (!row) {
        continue;
      }
      for (let x = 0; x < map.width; x++) {
        const tile = row[x];
        if (!tile) {
          continue;
        }
        if (tile.terrain !== TerrainType.TallGrass) {
          continue;
        }
        if (occupiedByObject.has(`${x},${y}`)) {
          continue;
        }
        this.placeTallGrass(x, y, tile.height);
      }
    }
  }

  clear(): void {
    for (const sprite of this.sprites) {
      this.occlusionFader?.unregister(sprite);
      sprite.destroy();
    }
    this.sprites.length = 0;
    for (const graphics of this.debugShapes) {
      graphics.destroy();
    }
    this.debugShapes.length = 0;
    this.obstacleHeightByCell.clear();
  }

  getDecorationHeightAt(x: number, y: number): number {
    return this.obstacleHeightByCell.get(`${x},${y}`) ?? 0;
  }

  setPreviewMode(enabled: boolean): void {
    if (this.previewMode === enabled) {
      return;
    }
    this.previewMode = enabled;
    // Preview mode gagne sur le fader : on le désactive d'abord pour que
    // setAlpha(preview) ne soit pas écrasé au prochain updateAll.
    if (enabled) {
      this.occlusionFader?.setEnabled(false);
    }
    const alpha = enabled ? DECORATIONS_PREVIEW_MODE_ALPHA : 1;
    for (const sprite of this.sprites) {
      sprite.setAlpha(alpha);
    }
    if (!enabled) {
      this.occlusionFader?.setEnabled(true);
    }
  }

  private placeObjectSprite(object: DecorationObject, map: MapDefinition): void {
    const textureKey = DECORATIONS_TEXTURE_KEYS[object.kind];
    if (!this.scene.textures.exists(textureKey)) {
      return;
    }
    const patchedHeight = this.grid.getTileHeight(object.anchorX, object.anchorY);
    const groundHeight = patchedHeight - object.heightUnits;
    // For a WxH footprint, the sprite's bottom-center must sit at the bottom
    // tip of the footprint's iso diamond, which is the bottom tip of the
    // "front" cell (anchorX + W - 1, anchorY). Using the anchor cell directly
    // would shift the sprite up-left by (W-1) half-tiles.
    const placementX = object.anchorX + object.footprintWidth - 1;
    const placementY = object.anchorY;
    const center = this.grid.gridToScreen(placementX, placementY, groundHeight);
    const sprite = this.scene.add.image(center.x, center.y + TILE_HEIGHT / 2, textureKey);
    sprite.setOrigin(0.5, 1.0);
    const depth =
      DEPTH_POKEMON_BASE +
      (placementX + placementY) * DEPTH_TILE_MAX_ELEVATION +
      object.heightUnits +
      DEPTH_DECORATIONS_OBSTACLE_OFFSET;
    sprite.setDepth(depth);
    if (this.previewMode) {
      sprite.setAlpha(DECORATIONS_PREVIEW_MODE_ALPHA);
    }
    this.sprites.push(sprite);
    this.occlusionFader?.register({
      sprite,
      depth,
      screenBounds: getSpriteScreenBounds(sprite),
    });

    if (this.debugFootprintEnabled) {
      for (let dy = 0; dy < object.footprintHeight; dy++) {
        for (let dx = 0; dx < object.footprintWidth; dx++) {
          const cellX = object.anchorX + dx;
          const cellY = object.anchorY - dy;
          const cellHeight = map.tiles[cellY]?.[cellX]?.height ?? patchedHeight;
          const cellGroundHeight = cellHeight - object.heightUnits;
          this.drawDebugFootprint(cellX, cellY, cellGroundHeight);
        }
      }
    }
  }

  private placeTallGrass(x: number, y: number, height: number): void {
    const textureKey = DECORATIONS_TEXTURE_KEYS.tall_grass;
    if (!this.scene.textures.exists(textureKey)) {
      return;
    }
    const center = this.grid.gridToScreen(x, y, height);
    const sprite = this.scene.add.image(center.x, center.y + TILE_HEIGHT / 2, textureKey);
    sprite.setOrigin(0.5, 1.0);
    sprite.setDepth(
      DEPTH_POKEMON_BASE +
        (x + y) * DEPTH_TILE_MAX_ELEVATION +
        height +
        DEPTH_DECORATIONS_TALL_GRASS_OFFSET,
    );
    if (this.previewMode) {
      sprite.setAlpha(DECORATIONS_PREVIEW_MODE_ALPHA);
    }
    this.sprites.push(sprite);

    if (this.debugFootprintEnabled) {
      this.drawDebugFootprint(x, y, height);
    }
  }

  private drawDebugFootprint(gridX: number, gridY: number, height: number): void {
    const center = this.grid.gridToScreen(gridX, gridY, height);
    const halfWidth = TILE_WIDTH / 2;
    const halfHeight = TILE_HEIGHT / 2;
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(DECORATIONS_DEBUG_FOOTPRINT_COLOR, DECORATIONS_DEBUG_FOOTPRINT_ALPHA);
    graphics.lineStyle(
      DECORATIONS_DEBUG_FOOTPRINT_STROKE_WIDTH,
      DECORATIONS_DEBUG_FOOTPRINT_COLOR,
      DECORATIONS_DEBUG_FOOTPRINT_STROKE_ALPHA,
    );
    graphics.beginPath();
    graphics.moveTo(center.x, center.y - halfHeight);
    graphics.lineTo(center.x + halfWidth, center.y);
    graphics.lineTo(center.x, center.y + halfHeight);
    graphics.lineTo(center.x - halfWidth, center.y);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
    graphics.setDepth(
      DEPTH_POKEMON_BASE +
        (gridX + gridY) * DEPTH_TILE_MAX_ELEVATION +
        height +
        DECORATIONS_DEBUG_FOOTPRINT_DEPTH_OFFSET,
    );
    this.debugShapes.push(graphics);
  }
}
