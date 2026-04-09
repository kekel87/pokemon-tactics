import {
  ARENA_GRASS_BORDER_SIZE,
  ARENA_MARKING_ALPHA,
  ARENA_MARKING_COLOR,
  ARENA_MARKING_LINE_WIDTH,
  ARENA_TILE_FRAME_FLOOR,
  ARENA_TILE_FRAME_FLOOR_VARIANTS,
  ARENA_TILE_FRAME_GRASS,
  ARENA_TILE_FRAME_GRASS_VARIANTS,
  ARENA_TILE_VARIANT_RATIO,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CURSOR_COLOR,
  CURSOR_PULSE_DURATION_MS,
  CURSOR_PULSE_MAX_ALPHA,
  CURSOR_PULSE_MIN_ALPHA,
  CURSOR_STROKE_WIDTH,
  DEPTH_GRID_CURSOR,
  DEPTH_GRID_ENEMY_RANGE,
  DEPTH_GRID_HIGHLIGHT,
  DEPTH_GRID_MARKINGS,
  DEPTH_GRID_PREVIEW,
  DEPTH_GRID_TILES,
  GRID_SIZE,
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

interface ScreenPosition {
  x: number;
  y: number;
}

export class IsometricGrid {
  private readonly scene: Phaser.Scene;
  private readonly tileGraphics: Phaser.GameObjects.Graphics;
  private readonly tileSprites: Phaser.GameObjects.Image[] = [];
  private readonly markingsGraphics: Phaser.GameObjects.Graphics;
  private readonly highlightGraphics: Phaser.GameObjects.Graphics;
  private readonly enemyRangeGraphics: Phaser.GameObjects.Graphics;
  private readonly previewGraphics: Phaser.GameObjects.Graphics;
  private readonly cursorGraphics: Phaser.GameObjects.Graphics;
  private cursorTween: Phaser.Tweens.Tween | null = null;
  private readonly offsetX: number;
  private readonly offsetY: number;
  readonly gridWidth: number;
  readonly gridHeight: number;
  private readonly useTexturedTiles: boolean;

  constructor(scene: Phaser.Scene, gridWidth: number = GRID_SIZE, gridHeight: number = gridWidth) {
    this.scene = scene;
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
    this.useTexturedTiles = scene.textures.exists(TILESET_KEY);
    this.tileGraphics = scene.add.graphics();
    this.markingsGraphics = scene.add.graphics();
    this.markingsGraphics.setDepth(DEPTH_GRID_MARKINGS);
    this.highlightGraphics = scene.add.graphics();
    this.highlightGraphics.setDepth(DEPTH_GRID_HIGHLIGHT);
    this.enemyRangeGraphics = scene.add.graphics();
    this.enemyRangeGraphics.setDepth(DEPTH_GRID_ENEMY_RANGE);
    this.previewGraphics = scene.add.graphics();
    this.previewGraphics.setDepth(DEPTH_GRID_PREVIEW);
    this.cursorGraphics = scene.add.graphics();
    this.cursorGraphics.setDepth(DEPTH_GRID_CURSOR);

    this.offsetX = CANVAS_WIDTH / 2;
    const isoTotalHeight = ((gridWidth + gridHeight) * TILE_HEIGHT) / 2;
    this.offsetY = CANVAS_HEIGHT / 2 - isoTotalHeight / 2;
  }

  gridToScreen(gridX: number, gridY: number): ScreenPosition {
    return {
      x: (gridX - gridY) * (TILE_WIDTH / 2) + this.offsetX,
      y: (gridX + gridY) * (TILE_HEIGHT / 2) + this.offsetY,
    };
  }

  screenToGrid(screenX: number, screenY: number): { x: number; y: number } | null {
    const relX = screenX - this.offsetX;
    const relY = screenY - this.offsetY;

    const gridX = (relX / (TILE_WIDTH / 2) + relY / (TILE_HEIGHT / 2)) / 2;
    const gridY = (relY / (TILE_HEIGHT / 2) - relX / (TILE_WIDTH / 2)) / 2;

    const roundedX = Math.round(gridX);
    const roundedY = Math.round(gridY);

    if (roundedX < 0 || roundedX >= this.gridWidth || roundedY < 0 || roundedY >= this.gridHeight) {
      return null;
    }

    return { x: roundedX, y: roundedY };
  }

  drawGrid(): void {
    if (this.useTexturedTiles) {
      this.drawTexturedGrid();
      this.drawArenaMarkings();
    } else {
      this.drawFallbackGrid();
    }
  }

  drawGridFromTileData(tileData: readonly number[], firstgid: number): void {
    for (const sprite of this.tileSprites) {
      sprite.destroy();
    }
    this.tileSprites.length = 0;

    if (!this.useTexturedTiles) {
      this.drawFallbackGrid();
      return;
    }

    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const index = y * this.gridWidth + x;
        const gid = tileData[index] ?? 0;
        if (gid === 0) {
          continue;
        }
        const frameIndex = gid - firstgid;
        const center = this.gridToScreen(x, y);
        const sprite = this.scene.add.sprite(center.x, center.y, TILESET_KEY, frameIndex);
        sprite.setScale(TILE_SPRITE_SCALE);
        sprite.setOrigin(0.5, TILE_ORIGIN_Y);
        sprite.setDepth(DEPTH_GRID_TILES + y);
        this.tileSprites.push(sprite);
      }
    }
  }

  private drawFallbackGrid(): void {
    this.tileGraphics.clear();
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        this.drawTile(this.tileGraphics, x, y, TILE_FILL_COLOR, TILE_STROKE_COLOR);
      }
    }
  }

  private drawTexturedGrid(): void {
    for (const sprite of this.tileSprites) {
      sprite.destroy();
    }
    this.tileSprites.length = 0;

    const border = ARENA_GRASS_BORDER_SIZE;

    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const center = this.gridToScreen(x, y);
        const isGrass =
          x < border || x >= this.gridWidth - border || y < border || y >= this.gridHeight - border;

        const variants = isGrass
          ? ARENA_TILE_FRAME_GRASS_VARIANTS
          : ARENA_TILE_FRAME_FLOOR_VARIANTS;
        const baseFrame = isGrass ? ARENA_TILE_FRAME_GRASS : ARENA_TILE_FRAME_FLOOR;

        const hash = ((x * 7 + y * 13 + x * y * 3) % 100) / 100;
        let frameIndex: number;
        if (hash < ARENA_TILE_VARIANT_RATIO) {
          const variantIdx = ((x * 3 + y * 7) % (variants.length - 1)) + 1;
          frameIndex = variants[variantIdx] ?? baseFrame;
        } else {
          frameIndex = baseFrame;
        }

        const sprite = this.scene.add.sprite(center.x, center.y, TILESET_KEY, frameIndex);
        sprite.setScale(TILE_SPRITE_SCALE);
        sprite.setOrigin(0.5, TILE_ORIGIN_Y);
        sprite.setDepth(DEPTH_GRID_TILES + y);
        this.tileSprites.push(sprite);
      }
    }
  }

  private drawArenaMarkings(): void {
    this.markingsGraphics.clear();
    const border = ARENA_GRASS_BORDER_SIZE;
    const left = border;
    const right = this.gridWidth - border - 1;
    const top = border;
    const bottom = this.gridHeight - border - 1;
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;

    this.markingsGraphics.lineStyle(
      ARENA_MARKING_LINE_WIDTH,
      ARENA_MARKING_COLOR,
      ARENA_MARKING_ALPHA,
    );

    const tl = this.gridToScreen(left, top);
    const tr = this.gridToScreen(right, top);
    const bl = this.gridToScreen(left, bottom);
    const br = this.gridToScreen(right, bottom);

    this.markingsGraphics.beginPath();
    this.markingsGraphics.moveTo(tl.x, tl.y);
    this.markingsGraphics.lineTo(tr.x, tr.y);
    this.markingsGraphics.lineTo(br.x, br.y);
    this.markingsGraphics.lineTo(bl.x, bl.y);
    this.markingsGraphics.closePath();
    this.markingsGraphics.strokePath();

    const ml = this.gridToScreen(left, centerY);
    const mr = this.gridToScreen(right, centerY);
    this.markingsGraphics.beginPath();
    this.markingsGraphics.moveTo(ml.x, ml.y);
    this.markingsGraphics.lineTo(mr.x, mr.y);
    this.markingsGraphics.strokePath();

    this.drawIsoEllipse(centerX, centerY, 2.5);
    this.drawIsoEllipse(centerX, centerY, 0.6);
  }

  private drawIsoEllipse(centerX: number, centerY: number, radius: number): void {
    const steps = 64;
    this.markingsGraphics.beginPath();
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const gx = centerX + Math.cos(angle) * radius;
      const gy = centerY + Math.sin(angle) * radius;
      const screen = this.gridToScreen(gx, gy);
      if (i === 0) {
        this.markingsGraphics.moveTo(screen.x, screen.y);
      } else {
        this.markingsGraphics.lineTo(screen.x, screen.y);
      }
    }
    this.markingsGraphics.strokePath();
  }

  clearHighlights(): void {
    this.highlightGraphics.clear();
  }

  highlightTiles(positions: Array<{ x: number; y: number }>, kind: HighlightKind): void {
    if (kind === HighlightKind.EnemyRange) {
      this.showEnemyRange(positions);
      return;
    }
    const color =
      kind === HighlightKind.Move ? TILE_HIGHLIGHT_MOVE_COLOR : TILE_HIGHLIGHT_ATTACK_COLOR;
    for (const position of positions) {
      this.drawTile(this.highlightGraphics, position.x, position.y, color, color, 0.4);
    }
  }

  showEnemyRange(positions: Array<{ x: number; y: number }>): void {
    this.enemyRangeGraphics.clear();
    for (const position of positions) {
      this.drawTile(
        this.enemyRangeGraphics,
        position.x,
        position.y,
        TILE_HIGHLIGHT_ENEMY_RANGE_COLOR,
        TILE_HIGHLIGHT_ENEMY_RANGE_COLOR,
        TILE_HIGHLIGHT_ENEMY_RANGE_ALPHA,
      );
    }
  }

  clearEnemyRange(): void {
    this.enemyRangeGraphics.clear();
  }

  showPreview(positions: Array<{ x: number; y: number }>, color: number, alpha: number): void {
    for (const position of positions) {
      this.drawTile(this.previewGraphics, position.x, position.y, color, color, alpha);
    }
  }

  clearPreview(): void {
    this.previewGraphics.clear();
  }

  highlightTilesOutline(positions: Array<{ x: number; y: number }>): void {
    const positionSet = new Set(positions.map((p) => `${p.x},${p.y}`));
    const halfW = TILE_WIDTH / 2;
    const halfH = TILE_HEIGHT / 2;

    this.highlightGraphics.lineStyle(
      TILE_RANGE_OUTLINE_WIDTH,
      TILE_RANGE_OUTLINE_COLOR,
      TILE_RANGE_OUTLINE_ALPHA,
    );

    for (const position of positions) {
      const center = this.gridToScreen(position.x, position.y);

      const top = { x: center.x, y: center.y - halfH };
      const right = { x: center.x + halfW, y: center.y };
      const bottom = { x: center.x, y: center.y + halfH };
      const left = { x: center.x - halfW, y: center.y };

      if (!positionSet.has(`${position.x},${position.y - 1}`)) {
        this.drawEdge(top, right);
      }
      if (!positionSet.has(`${position.x + 1},${position.y}`)) {
        this.drawEdge(right, bottom);
      }
      if (!positionSet.has(`${position.x},${position.y + 1}`)) {
        this.drawEdge(bottom, left);
      }
      if (!positionSet.has(`${position.x - 1},${position.y}`)) {
        this.drawEdge(left, top);
      }
    }
  }

  private drawEdge(from: { x: number; y: number }, to: { x: number; y: number }): void {
    this.highlightGraphics.beginPath();
    this.highlightGraphics.moveTo(from.x, from.y);
    this.highlightGraphics.lineTo(to.x, to.y);
    this.highlightGraphics.strokePath();
  }

  highlightTilesWithColor(
    positions: Array<{ x: number; y: number }>,
    color: number,
    alpha: number,
  ): void {
    for (const position of positions) {
      this.drawTile(this.highlightGraphics, position.x, position.y, color, color, alpha);
    }
  }

  showCursor(gridX: number, gridY: number): void {
    this.cursorGraphics.clear();
    this.drawTileOutline(this.cursorGraphics, gridX, gridY, CURSOR_COLOR, CURSOR_STROKE_WIDTH);

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

  private drawTileOutline(
    graphics: Phaser.GameObjects.Graphics,
    gridX: number,
    gridY: number,
    color: number,
    lineWidth: number,
  ): void {
    const center = this.gridToScreen(gridX, gridY);
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
    const center = this.gridToScreen(gridX, gridY);
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
