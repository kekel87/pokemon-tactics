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
  DEPTH_CURSOR_OVER_DECORATION_OFFSET,
  DEPTH_ENEMY_RANGE_ISO_OFFSET,
  DEPTH_GRID_TILES,
  DEPTH_HIGHLIGHT_ISO_OFFSET,
  DEPTH_PREVIEW_ISO_OFFSET,
  DEPTH_RAISED_TILE_BASE,
  DEPTH_TILE_MAX_ELEVATION,
  GRID_SIZE,
  TERRAIN_TINT,
  TERRAIN_TINT_ALPHA,
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

export class IsometricGrid {
  private readonly scene: Phaser.Scene;
  private readonly tileGraphics: Phaser.GameObjects.Graphics;
  private readonly tileSprites: Phaser.GameObjects.Image[] = [];
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
  private pickingHeightData: readonly number[] = [];
  private terrainData: readonly string[] = [];
  private slopeData: readonly (string | null)[] = [];
  private decorationsLayer: {
    getDecorationHeightAt(x: number, y: number): number;
  } | null = null;

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
      // Picking uses ground heights (decorations subtracted) so the player
      // selects the cell by clicking the base of a decoration, not its top.
      // The visual cursor is still drawn at the top (see showCursor).
      const heightsForPicking =
        this.pickingHeightData.length > 0 ? this.pickingHeightData : this.heightData;
      return isoScreenToGridWithHeight(screenX, screenY, heightsForPicking, this.projectionContext);
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

    this.heightData = heightData ?? [];
    this.terrainData = terrainData ?? [];
    this.slopeData = slopeData ?? [];
    this.rebuildPickingHeightData();

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
          const isoLadder = (x + y) * DEPTH_TILE_MAX_ELEVATION + layer.elevation;
          const depth =
            layer.elevation > 0 ? DEPTH_RAISED_TILE_BASE + isoLadder : DEPTH_GRID_TILES + isoLadder;
          sprite.setDepth(depth);
          this.tileSprites.push(sprite);
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

  getTileTerrain(gridX: number, gridY: number): string | undefined {
    const index = gridY * this.gridWidth + gridX;
    return this.terrainData[index];
  }

  isSlopeAt(gridX: number, gridY: number): boolean {
    const index = gridY * this.gridWidth + gridX;
    return this.slopeData[index] != null;
  }

  setDecorationsLayer(layer: { getDecorationHeightAt(x: number, y: number): number }): void {
    this.decorationsLayer = layer;
    this.rebuildPickingHeightData();
  }

  private rebuildPickingHeightData(): void {
    if (!this.decorationsLayer || this.heightData.length === 0) {
      this.pickingHeightData = this.heightData;
      return;
    }
    const layer = this.decorationsLayer;
    this.pickingHeightData = this.heightData.map((h, i) => {
      const x = i % this.gridWidth;
      const y = Math.floor(i / this.gridWidth);
      return h - layer.getDecorationHeightAt(x, y);
    });
  }

  getTileGroundHeight(gridX: number, gridY: number): number {
    const patchedHeight = this.getTileHeight(gridX, gridY);
    const decorationHeight = this.decorationsLayer?.getDecorationHeightAt(gridX, gridY) ?? 0;
    return patchedHeight - decorationHeight;
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
      const groundHeight = this.getTileGroundHeight(position.x, position.y);
      const graphics = this.getOrCreateTileGraphicsAtHeight(
        this.highlightLayer,
        position.x,
        position.y,
        groundHeight,
        DEPTH_HIGHLIGHT_ISO_OFFSET,
      );
      this.drawTileAtHeight(graphics, position.x, position.y, groundHeight, color, color, 0.4);
    }
  }

  showEnemyRange(positions: Array<{ x: number; y: number }>): void {
    this.clearLayer(this.enemyRangeLayer);
    for (const position of positions) {
      const groundHeight = this.getTileGroundHeight(position.x, position.y);
      const graphics = this.getOrCreateTileGraphicsAtHeight(
        this.enemyRangeLayer,
        position.x,
        position.y,
        groundHeight,
        DEPTH_ENEMY_RANGE_ISO_OFFSET,
      );
      this.drawTileAtHeight(
        graphics,
        position.x,
        position.y,
        groundHeight,
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
      const groundHeight = this.getTileGroundHeight(position.x, position.y);
      const graphics = this.getOrCreateTileGraphicsAtHeight(
        this.previewLayer,
        position.x,
        position.y,
        groundHeight,
        DEPTH_PREVIEW_ISO_OFFSET,
      );
      this.drawTileAtHeight(graphics, position.x, position.y, groundHeight, color, color, alpha);
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
      const height = this.getTileGroundHeight(position.x, position.y);
      const center = this.gridToScreen(position.x, position.y, height);
      const graphics = this.getOrCreateTileGraphicsAtHeight(
        this.highlightLayer,
        position.x,
        position.y,
        height,
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
      const groundHeight = this.getTileGroundHeight(position.x, position.y);
      const graphics = this.getOrCreateTileGraphicsAtHeight(
        this.highlightLayer,
        position.x,
        position.y,
        groundHeight,
        DEPTH_HIGHLIGHT_ISO_OFFSET,
      );
      this.drawTileAtHeight(graphics, position.x, position.y, groundHeight, color, color, alpha);
    }
  }

  private getOrCreateTileGraphicsAtHeight(
    layer: Map<string, Phaser.GameObjects.Graphics>,
    gridX: number,
    gridY: number,
    height: number,
    isoOffset: number,
  ): Phaser.GameObjects.Graphics {
    const key = `${gridX},${gridY}`;
    const existing = layer.get(key);
    if (existing) {
      return existing;
    }
    const graphics = this.scene.add.graphics();
    const isoLadder = (gridX + gridY) * DEPTH_TILE_MAX_ELEVATION + height;
    const baseDepth = height > 0 ? DEPTH_RAISED_TILE_BASE + isoLadder : isoLadder;
    graphics.setDepth(baseDepth + isoOffset);
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
    const decorationHeight = this.decorationsLayer?.getDecorationHeightAt(gridX, gridY) ?? 0;
    const isOnRaisedCell = decorationHeight > 0 || height > 0;
    const cursorDepth = isOnRaisedCell
      ? DEPTH_RAISED_TILE_BASE +
        (gridX + gridY) * DEPTH_TILE_MAX_ELEVATION +
        height +
        DEPTH_CURSOR_OVER_DECORATION_OFFSET
      : DEPTH_CURSOR_GROUND;
    this.cursorGraphics.setDepth(cursorDepth);
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
    this.drawTileAtHeight(
      graphics,
      gridX,
      gridY,
      this.getTileHeight(gridX, gridY),
      fillColor,
      strokeColor,
      alpha,
    );
  }

  private drawTileAtHeight(
    graphics: Phaser.GameObjects.Graphics,
    gridX: number,
    gridY: number,
    height: number,
    fillColor: number,
    strokeColor: number,
    alpha: number = 1,
  ): void {
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
