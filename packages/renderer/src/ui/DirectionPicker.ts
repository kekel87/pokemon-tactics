import { Direction } from "@pokemon-tactic/core";
import { DIRECTION_INACTIVE_TINT } from "../constants";
import { getDirectionFromScreenPosition } from "../utils/screen-direction";

const COLS_PER_ROW = 6;
const YELLOW_ROW = 3;
const ARROW_FRAMES: Record<Direction, number> = {
  [Direction.North]: YELLOW_ROW * COLS_PER_ROW + 1, // ↗ NE
  [Direction.East]: YELLOW_ROW * COLS_PER_ROW + 2, // ↘ SE
  [Direction.South]: YELLOW_ROW * COLS_PER_ROW + 4, // ↙ SW
  [Direction.West]: YELLOW_ROW * COLS_PER_ROW + 5, // ↖ NW
};
const ARROW_SCALE = 0.7;
const SPREAD = 22;
const VERTICAL_OFFSET = -30;

const ARROW_POSITIONS: Record<Direction, { x: number; y: number }> = {
  [Direction.North]: { x: SPREAD, y: VERTICAL_OFFSET - SPREAD / 2 },
  [Direction.East]: { x: SPREAD, y: VERTICAL_OFFSET + SPREAD / 2 },
  [Direction.South]: { x: -SPREAD, y: VERTICAL_OFFSET + SPREAD / 2 },
  [Direction.West]: { x: -SPREAD, y: VERTICAL_OFFSET - SPREAD / 2 },
};

interface DirectionPickerCallbacks {
  onPreview: (direction: Direction) => void;
  onConfirm: (direction: Direction) => void;
  onCancel: () => void;
}

const ALL_DIRECTIONS = [Direction.North, Direction.South, Direction.East, Direction.West] as const;

export class DirectionPicker {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly arrows: Map<Direction, Phaser.GameObjects.Image> = new Map();
  private callbacks: DirectionPickerCallbacks | null = null;
  private currentDirection: Direction = Direction.South;
  private onPointerMove: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  private onPointerDown: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  private onKeyDown: ((event: KeyboardEvent) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setVisible(false);
    this.container.setDepth(900);

    for (const direction of ALL_DIRECTIONS) {
      const frame = ARROW_FRAMES[direction];
      const position = ARROW_POSITIONS[direction];
      const arrow = scene.add.image(position.x, position.y, "arrows", frame);
      arrow.setScale(ARROW_SCALE);
      this.arrows.set(direction, arrow);
      this.container.add(arrow);
    }
  }

  show(
    screenX: number,
    screenY: number,
    initialDirection: Direction,
    callbacks: DirectionPickerCallbacks,
  ): void {
    this.callbacks = callbacks;
    this.currentDirection = initialDirection;
    this.container.setPosition(screenX, screenY);
    this.container.setVisible(true);
    this.updateArrows(initialDirection);

    this.onPointerMove = (pointer: Phaser.Input.Pointer): void => {
      const direction = getDirectionFromScreenPosition(
        pointer.worldX,
        pointer.worldY,
        screenX,
        screenY,
      );
      if (direction !== this.currentDirection) {
        this.currentDirection = direction;
        this.updateArrows(direction);
        this.callbacks?.onPreview(direction);
      }
    };

    this.onPointerDown = (_pointer: Phaser.Input.Pointer): void => {
      const direction = this.currentDirection;
      this.hide();
      callbacks.onConfirm(direction);
    };

    this.onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        this.hide();
        callbacks.onCancel();
      }
    };

    this.scene.input.on("pointermove", this.onPointerMove);
    this.scene.input.on("pointerdown", this.onPointerDown);
    this.scene.input.keyboard?.on("keydown", this.onKeyDown);
  }

  hide(): void {
    this.container.setVisible(false);

    if (this.onPointerMove) {
      this.scene.input.off("pointermove", this.onPointerMove);
      this.onPointerMove = null;
    }
    if (this.onPointerDown) {
      this.scene.input.off("pointerdown", this.onPointerDown);
      this.onPointerDown = null;
    }
    if (this.onKeyDown) {
      this.scene.input.keyboard?.off("keydown", this.onKeyDown);
      this.onKeyDown = null;
    }
    this.callbacks = null;
  }

  private updateArrows(activeDirection: Direction): void {
    for (const direction of ALL_DIRECTIONS) {
      const arrow = this.arrows.get(direction);
      if (!arrow) {
        continue;
      }

      if (direction === activeDirection) {
        arrow.clearTint();
        arrow.setAlpha(1);
      } else {
        arrow.setTint(DIRECTION_INACTIVE_TINT);
      }
    }
  }
}
