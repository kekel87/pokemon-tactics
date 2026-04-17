import {
  DEPTH_HOVER_CURSOR,
  HOVER_CURSOR_GAP_Y,
  HOVER_CURSOR_OPTIONS,
  type HoverCursorOption,
  TILE_HEIGHT,
} from "../constants";
import type { IsometricGrid } from "../grid/IsometricGrid";

export class HoverCursor {
  private readonly isometricGrid: IsometricGrid;
  private readonly sprite: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, isometricGrid: IsometricGrid, option: HoverCursorOption) {
    this.isometricGrid = isometricGrid;
    this.sprite = scene.add.image(0, 0, option.key);
    this.sprite.setScale(option.scale);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setDepth(DEPTH_HOVER_CURSOR);
    this.sprite.setVisible(false);
  }

  showAt(gridX: number, gridY: number): void {
    const height = this.isometricGrid.getTileHeight(gridX, gridY);
    const screen = this.isometricGrid.gridToScreen(gridX, gridY, height);
    this.sprite.setPosition(screen.x, screen.y - TILE_HEIGHT / 2 - HOVER_CURSOR_GAP_Y);
    this.sprite.setVisible(true);
  }

  hide(): void {
    this.sprite.setVisible(false);
  }

  setOption(option: HoverCursorOption): void {
    this.sprite.setTexture(option.key);
    this.sprite.setScale(option.scale);
  }
}

export function resolveHoverCursorOption(storedKey: string): HoverCursorOption {
  const fallback = HOVER_CURSOR_OPTIONS[0];
  return HOVER_CURSOR_OPTIONS.find((option) => option.key === storedKey) ?? fallback;
}
