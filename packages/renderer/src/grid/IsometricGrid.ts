import { decodeTiledGid } from "@pokemon-tactic/data";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CURSOR_COLOR,
  CURSOR_PULSE_DURATION_MS,
  CURSOR_PULSE_MAX_ALPHA,
  CURSOR_PULSE_MIN_ALPHA,
  CURSOR_STROKE_WIDTH,
  DEPTH_CURSOR_GROUND,
  DEPTH_ENEMY_RANGE_ISO_OFFSET,
  DEPTH_GRID_TILES,
  DEPTH_HIGHLIGHT_ISO_OFFSET,
  DEPTH_PREVIEW_ISO_OFFSET,
  DEPTH_TILE_MAX_ELEVATION,
  GRID_SIZE,
  OCCLUSION_MAX_TILE_DISTANCE,
  TERRAIN_TINT,
  TERRAIN_TINT_ALPHA,
  TILE_ELEVATION_STEP,
  TILE_FILL_COLOR,
  TILE_HEIGHT,
  TILE_HIGHLIGHT_ATTACK_COLOR,
  TILE_HIGHLIGHT_ENEMY_RANGE_ALPHA,
  TILE_HIGHLIGHT_ENEMY_RANGE_COLOR,
  TILE_HIGHLIGHT_MOVE_COLOR,
  TILE_ORIGIN_Y,
  TILE_RANGE_OUTLINE_ALPHA,
  TILE_RANGE_OUTLINE_COLOR,
  TILE_RANGE_OUTLINE_WIDTH,
  TILE_SPRITE_SCALE,
  TILE_STROKE_COLOR,
  TILE_STROKE_WIDTH,
  TILE_WIDTH,
  TILESET_KEY,
} from "../constants";
import { HighlightKind } from "../enums/highlight-kind";
import {
  gridToScreen as isoGridToScreen,
  screenToGridFlat as isoScreenToGridFlat,
  screenToGridWithHeight as isoScreenToGridWithHeight,
  type ScreenPosition,
} from "./iso-math";
import { isOccludedBy } from "./occlusion";

export interface OccludingTile {
  x: number;
  y: number;
  elevation: number;
}

export class IsometricGrid {
  private readonly scene: Phaser.Scene;
  private readonly tileGraphics: Phaser.GameObjects.Graphics;
  private readonly tileSprites: Phaser.GameObjects.Image[] = [];
  private readonly tilesByPosition = new Map<
    string,
    { sprite: Phaser.GameObjects.Image; elevation: number }[]
  >();
  private readonly highlightLayer = new Map<string, Phaser.GameObjects.Graphics>();
  private readonly enemyRangeLayer = new Map<string, Phaser.GameObjects.Graphics>();
  private readonly previewLayer = new Map<string, Phaser.GameObjects.Graphics>();
  private readonly cursorGraphics: Phaser.GameObjects.Graphics;
  private cursorTween: Phaser.Tweens.Tween | null = null;
  private readonly offsetX: number;
  private readonly offsetY: number;
  readonly gridWidth: number;
  readonly gridHeight: number;
  private readonly useTexturedTiles: boolean;
  private heightData: readonly number[] = [];
  private terrainData: readonly string[] = [];
  private slopeData: readonly (string | null)[] = [];

  constructor(scene: Phaser.Scene, gridWidth: number = GRID_SIZE, gridHeight: number = gridWidth) {
    this.scene = scene;
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
    this.useTexturedTiles = scene.textures.exists(TILESET_KEY);
    this.tileGraphics = scene.add.graphics();
    this.cursorGraphics = scene.add.graphics();

    this.offsetX = CANVAS_WIDTH / 2;
    const isoTotalHeight = ((gridWidth + gridHeight) * TILE_HEIGHT) / 2;
    this.offsetY = CANVAS_HEIGHT / 2 - isoTotalHeight / 2;
  }

  private get projectionContext() {
    return {
      gridWidth: this.gridWidth,
      gridHeight: this.gridHeight,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
    };
  }

  gridToScreen(gridX: number, gridY: number, height = 0): ScreenPosition {
    return isoGridToScreen(gridX, gridY, height, this.projectionContext);
  }

  screenToGrid(screenX: number, screenY: number): { x: number; y: number } | null {
    if (this.heightData.length > 0) {
      return isoScreenToGridWithHeight(screenX, screenY, this.heightData, this.projectionContext);
    }

    return isoScreenToGridFlat(screenX, screenY, this.projectionContext);
  }

  drawGridFromTileData(
    elevationLayers: readonly { elevation: number; tileData: readonly number[] }[],
    firstgid: number,
    heightData?: readonly number[],
    slopeData?: readonly (string | null)[],
    terrainData?: readonly string[],
  ): void {
    for (const sprite of this.tileSprites) {
      sprite.destroy();
    }
    this.tileSprites.length = 0;
    this.tilesByPosition.clear();

    this.heightData = heightData ?? [];
    this.terrainData = terrainData ?? [];
    this.slopeData = slopeData ?? [];

    if (!this.useTexturedTiles) {
      this.drawFallbackGrid();
      return;
    }

    const sorted = [...elevationLayers].sort((a, b) => a.elevation - b.elevation);

    for (const layer of sorted) {
      for (let y = 0; y < this.gridHeight; y++) {
        for (let x = 0; x < this.gridWidth; x++) {
          const index = y * this.gridWidth + x;
          const rawGid = layer.tileData[index] ?? 0;
          if (rawGid === 0) {
            continue;
          }
          const { tileId, flipH, flipV } = decodeTiledGid(rawGid);
          const frameIndex = tileId - firstgid;
          const center = this.gridToScreen(x, y, layer.elevation);
          const spriteY = center.y + TILE_HEIGHT / 2;
          const sprite = this.scene.add.sprite(center.x, spriteY, TILESET_KEY, frameIndex);
          sprite.setFlipX(flipH);
          sprite.setFlipY(flipV);
          sprite.setScale(TILE_SPRITE_SCALE);
          sprite.setOrigin(0.5, TILE_ORIGIN_Y);
          sprite.setDepth(DEPTH_GRID_TILES + (x + y) * DEPTH_TILE_MAX_ELEVATION + layer.elevation);
          this.tileSprites.push(sprite);
          const positionKey = `${x},${y}`;
          const bucket = this.tilesByPosition.get(positionKey);
          const entry = { sprite, elevation: layer.elevation };
          if (bucket) {
            bucket.push(entry);
          } else {
            this.tilesByPosition.set(positionKey, [entry]);
          }
        }
      }
    }

    this.drawTerrainTints();
  }

  private drawTerrainTints(): void {
    this.tileGraphics.clear();
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const index = y * this.gridWidth + x;
        const terrain = this.terrainData[index];
        if (!terrain) {
          continue;
        }
        const tintColor = TERRAIN_TINT[terrain];
        if (tintColor === undefined) {
          continue;
        }
        this.drawTile(this.tileGraphics, x, y, tintColor, tintColor, TERRAIN_TINT_ALPHA);
      }
    }
    this.tileGraphics.setDepth(
      DEPTH_GRID_TILES + this.gridWidth * this.gridHeight * DEPTH_TILE_MAX_ELEVATION + 1,
    );
  }

  getTileHeight(gridX: number, gridY: number): number {
    const index = gridY * this.gridWidth + gridX;
    return this.heightData[index] ?? 0;
  }

  /**
   * Returns the list of tiles that visually occlude a Pokemon standing on
   * (pokemonX, pokemonY). An occluder is a tile in front of the subject (iso
   * depth > subject depth), on the same or adjacent iso column, tall enough,
   * and within OCCLUSION_MAX_TILE_DISTANCE. See `./occlusion.ts` for the rule.
   */
  getOccludingTiles(pokemonX: number, pokemonY: number): OccludingTile[] {
    const occluders: OccludingTile[] = [];
    for (let dy = 0; dy <= OCCLUSION_MAX_TILE_DISTANCE; dy++) {
      for (let dx = 0; dx <= OCCLUSION_MAX_TILE_DISTANCE - dy; dx++) {
        if (dx === 0 && dy === 0) {
          continue;
        }
        const tileX = pokemonX + dx;
        const tileY = pokemonY + dy;
        const bucket = this.tilesByPosition.get(`${tileX},${tileY}`);
        if (!bucket) {
          continue;
        }
        for (const entry of bucket) {
          if (
            isOccludedBy(
              { x: pokemonX, y: pokemonY },
              { x: tileX, y: tileY, elevation: entry.elevation },
            )
          ) {
            occluders.push({ x: tileX, y: tileY, elevation: entry.elevation });
          }
        }
      }
    }
    return occluders;
  }

  /**
   * Returns the visible front-face polygon (SE + SW walls + top diamond edges)
   * of an occluder tile in world-space screen coordinates. Used as a mask so
   * that the silhouette of an occluded Pokemon only shows through the part of
   * the tile that actually hides it.
   */
  getOccluderFacePolygon(tile: OccludingTile): { x: number; y: number }[] {
    const topCenter = this.gridToScreen(tile.x, tile.y, tile.elevation);
    const halfW = TILE_WIDTH / 2;
    const halfH = TILE_HEIGHT / 2;
    const cx = topCenter.x;
    const cyTop = topCenter.y;
    const cyBase = cyTop + tile.elevation * TILE_ELEVATION_STEP;
    return [
      { x: cx + halfW, y: cyTop },
      { x: cx + halfW, y: cyBase },
      { x: cx, y: cyBase + halfH },
      { x: cx - halfW, y: cyBase },
      { x: cx - halfW, y: cyTop },
      { x: cx, y: cyTop + halfH },
    ];
  }

  /**
   * Returns `true` when the cell (x, y) carries a `slope` property in the
   * Tiled map (any layer). Slope tiles are ramps that let Pokemon walk
   * smoothly between elevations without the animation switching to "Hop".
   */
  isSlopeAt(gridX: number, gridY: number): boolean {
    const index = gridY * this.gridWidth + gridX;
    return this.slopeData[index] != null;
  }

  private drawFallbackGrid(): void {
    this.tileGraphics.clear();
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        this.drawTile(this.tileGraphics, x, y, TILE_FILL_COLOR, TILE_STROKE_COLOR);
      }
    }
  }

  clearHighlights(): void {
    this.clearLayer(this.highlightLayer);
  }

  highlightTiles(positions: Array<{ x: number; y: number }>, kind: HighlightKind): void {
    if (kind === HighlightKind.EnemyRange) {
      this.showEnemyRange(positions);
      return;
    }
    const color =
      kind === HighlightKind.Move ? TILE_HIGHLIGHT_MOVE_COLOR : TILE_HIGHLIGHT_ATTACK_COLOR;
    for (const position of positions) {
      const graphics = this.getOrCreateTileGraphics(
        this.highlightLayer,
        position.x,
        position.y,
        DEPTH_HIGHLIGHT_ISO_OFFSET,
      );
      this.drawTile(graphics, position.x, position.y, color, color, 0.4);
    }
  }

  showEnemyRange(positions: Array<{ x: number; y: number }>): void {
    this.clearLayer(this.enemyRangeLayer);
    for (const position of positions) {
      const graphics = this.getOrCreateTileGraphics(
        this.enemyRangeLayer,
        position.x,
        position.y,
        DEPTH_ENEMY_RANGE_ISO_OFFSET,
      );
      this.drawTile(
        graphics,
        position.x,
        position.y,
        TILE_HIGHLIGHT_ENEMY_RANGE_COLOR,
        TILE_HIGHLIGHT_ENEMY_RANGE_COLOR,
        TILE_HIGHLIGHT_ENEMY_RANGE_ALPHA,
      );
    }
  }

  clearEnemyRange(): void {
    this.clearLayer(this.enemyRangeLayer);
  }

  showPreview(positions: Array<{ x: number; y: number }>, color: number, alpha: number): void {
    for (const position of positions) {
      const graphics = this.getOrCreateTileGraphics(
        this.previewLayer,
        position.x,
        position.y,
        DEPTH_PREVIEW_ISO_OFFSET,
      );
      this.drawTile(graphics, position.x, position.y, color, color, alpha);
    }
  }

  clearPreview(): void {
    this.clearLayer(this.previewLayer);
  }

  highlightTilesOutline(positions: Array<{ x: number; y: number }>): void {
    const positionSet = new Set(positions.map((p) => `${p.x},${p.y}`));
    const halfW = TILE_WIDTH / 2;
    const halfH = TILE_HEIGHT / 2;

    for (const position of positions) {
      const height = this.getTileHeight(position.x, position.y);
      const center = this.gridToScreen(position.x, position.y, height);
      const graphics = this.getOrCreateTileGraphics(
        this.highlightLayer,
        position.x,
        position.y,
        DEPTH_HIGHLIGHT_ISO_OFFSET,
      );
      graphics.lineStyle(
        TILE_RANGE_OUTLINE_WIDTH,
        TILE_RANGE_OUTLINE_COLOR,
        TILE_RANGE_OUTLINE_ALPHA,
      );

      const top = { x: center.x, y: center.y - halfH };
      const right = { x: center.x + halfW, y: center.y };
      const bottom = { x: center.x, y: center.y + halfH };
      const left = { x: center.x - halfW, y: center.y };

      if (!positionSet.has(`${position.x},${position.y - 1}`)) {
        this.drawEdgeOn(graphics, top, right);
      }
      if (!positionSet.has(`${position.x + 1},${position.y}`)) {
        this.drawEdgeOn(graphics, right, bottom);
      }
      if (!positionSet.has(`${position.x},${position.y + 1}`)) {
        this.drawEdgeOn(graphics, bottom, left);
      }
      if (!positionSet.has(`${position.x - 1},${position.y}`)) {
        this.drawEdgeOn(graphics, left, top);
      }
    }
  }

  private drawEdgeOn(
    graphics: Phaser.GameObjects.Graphics,
    from: { x: number; y: number },
    to: { x: number; y: number },
  ): void {
    graphics.beginPath();
    graphics.moveTo(from.x, from.y);
    graphics.lineTo(to.x, to.y);
    graphics.strokePath();
  }

  highlightTilesWithColor(
    positions: Array<{ x: number; y: number }>,
    color: number,
    alpha: number,
  ): void {
    for (const position of positions) {
      const graphics = this.getOrCreateTileGraphics(
        this.highlightLayer,
        position.x,
        position.y,
        DEPTH_HIGHLIGHT_ISO_OFFSET,
      );
      this.drawTile(graphics, position.x, position.y, color, color, alpha);
    }
  }

  private getOrCreateTileGraphics(
    layer: Map<string, Phaser.GameObjects.Graphics>,
    gridX: number,
    gridY: number,
    isoOffset: number,
  ): Phaser.GameObjects.Graphics {
    const key = `${gridX},${gridY}`;
    const existing = layer.get(key);
    if (existing) {
      return existing;
    }
    const graphics = this.scene.add.graphics();
    const height = this.getTileHeight(gridX, gridY);
    graphics.setDepth((gridX + gridY) * DEPTH_TILE_MAX_ELEVATION + height + isoOffset);
    layer.set(key, graphics);
    return graphics;
  }

  private clearLayer(layer: Map<string, Phaser.GameObjects.Graphics>): void {
    for (const graphics of layer.values()) {
      graphics.destroy();
    }
    layer.clear();
  }

  showCursor(gridX: number, gridY: number): void {
    this.cursorGraphics.clear();
    const height = this.getTileHeight(gridX, gridY);
    const center = this.gridToScreen(gridX, gridY, height);
    this.cursorGraphics.setDepth(DEPTH_CURSOR_GROUND);
    this.drawDiamondStroke(this.cursorGraphics, center, CURSOR_COLOR, CURSOR_STROKE_WIDTH);

    if (this.cursorTween) {
      this.cursorTween.destroy();
    }

    this.cursorGraphics.setAlpha(CURSOR_PULSE_MAX_ALPHA);
    this.cursorTween = this.scene.tweens.add({
      targets: this.cursorGraphics,
      alpha: CURSOR_PULSE_MIN_ALPHA,
      duration: CURSOR_PULSE_DURATION_MS,
      yoyo: true,
      repeat: -1,
    });
  }

  hideCursor(): void {
    if (this.cursorTween) {
      this.cursorTween.destroy();
      this.cursorTween = null;
    }
    this.cursorGraphics.clear();
  }

  private drawDiamondStroke(
    graphics: Phaser.GameObjects.Graphics,
    center: ScreenPosition,
    color: number,
    lineWidth: number,
  ): void {
    const halfW = TILE_WIDTH / 2;
    const halfH = TILE_HEIGHT / 2;
    graphics.lineStyle(lineWidth, color, 1);
    graphics.beginPath();
    graphics.moveTo(center.x, center.y - halfH);
    graphics.lineTo(center.x + halfW, center.y);
    graphics.lineTo(center.x, center.y + halfH);
    graphics.lineTo(center.x - halfW, center.y);
    graphics.closePath();
    graphics.strokePath();
  }

  private drawTile(
    graphics: Phaser.GameObjects.Graphics,
    gridX: number,
    gridY: number,
    fillColor: number,
    strokeColor: number,
    alpha: number = 1,
  ): void {
    const height = this.getTileHeight(gridX, gridY);
    const center = this.gridToScreen(gridX, gridY, height);
    const halfW = TILE_WIDTH / 2;
    const halfH = TILE_HEIGHT / 2;

    const top = { x: center.x, y: center.y - halfH };
    const right = { x: center.x + halfW, y: center.y };
    const bottom = { x: center.x, y: center.y + halfH };
    const left = { x: center.x - halfW, y: center.y };

    graphics.fillStyle(fillColor, alpha);
    graphics.beginPath();
    graphics.moveTo(top.x, top.y);
    graphics.lineTo(right.x, right.y);
    graphics.lineTo(bottom.x, bottom.y);
    graphics.lineTo(left.x, left.y);
    graphics.closePath();
    graphics.fillPath();

    graphics.lineStyle(TILE_STROKE_WIDTH, strokeColor, alpha);
    graphics.beginPath();
    graphics.moveTo(top.x, top.y);
    graphics.lineTo(right.x, right.y);
    graphics.lineTo(bottom.x, bottom.y);
    graphics.lineTo(left.x, left.y);
    graphics.closePath();
    graphics.strokePath();
  }
}
