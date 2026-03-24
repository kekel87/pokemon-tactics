import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CURSOR_COLOR,
  CURSOR_PULSE_DURATION_MS,
  CURSOR_PULSE_MAX_ALPHA,
  CURSOR_PULSE_MIN_ALPHA,
  CURSOR_STROKE_WIDTH,
  DEPTH_GRID_CURSOR,
  DEPTH_GRID_HIGHLIGHT,
  GRID_SIZE,
  TILE_FILL_COLOR,
  TILE_HEIGHT,
  TILE_HIGHLIGHT_ATTACK_COLOR,
  TILE_HIGHLIGHT_MOVE_COLOR,
  TILE_STROKE_COLOR,
  TILE_STROKE_WIDTH,
  TILE_WIDTH,
} from "../constants";
import { HighlightKind } from "../enums/highlight-kind";

interface ScreenPosition {
  x: number;
  y: number;
}

export class IsometricGrid {
  private readonly scene: Phaser.Scene;
  private readonly tileGraphics: Phaser.GameObjects.Graphics;
  private readonly highlightGraphics: Phaser.GameObjects.Graphics;
  private readonly cursorGraphics: Phaser.GameObjects.Graphics;
  private cursorTween: Phaser.Tweens.Tween | null = null;
  private readonly offsetX: number;
  private readonly offsetY: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.tileGraphics = scene.add.graphics();
    this.highlightGraphics = scene.add.graphics();
    this.highlightGraphics.setDepth(DEPTH_GRID_HIGHLIGHT);
    this.cursorGraphics = scene.add.graphics();
    this.cursorGraphics.setDepth(DEPTH_GRID_CURSOR);

    this.offsetX = CANVAS_WIDTH / 2;
    this.offsetY = CANVAS_HEIGHT / 2 - (GRID_SIZE * TILE_HEIGHT) / 2;
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

    if (roundedX < 0 || roundedX >= GRID_SIZE || roundedY < 0 || roundedY >= GRID_SIZE) {
      return null;
    }

    return { x: roundedX, y: roundedY };
  }

  drawGrid(): void {
    this.tileGraphics.clear();

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        this.drawTile(this.tileGraphics, x, y, TILE_FILL_COLOR, TILE_STROKE_COLOR);
      }
    }
  }

  clearHighlights(): void {
    this.highlightGraphics.clear();
  }

  highlightTiles(positions: Array<{ x: number; y: number }>, kind: HighlightKind): void {
    const color =
      kind === HighlightKind.Move ? TILE_HIGHLIGHT_MOVE_COLOR : TILE_HIGHLIGHT_ATTACK_COLOR;
    for (const position of positions) {
      this.drawTile(this.highlightGraphics, position.x, position.y, color, color, 0.4);
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
