import Phaser from "phaser";

import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DEPTH_LOADING_OVERLAY,
  FONT_FAMILY,
  LOADING_BAR_BG_COLOR,
  LOADING_BAR_BORDER_ALPHA,
  LOADING_BAR_BORDER_COLOR,
  LOADING_BAR_BORDER_WIDTH,
  LOADING_BAR_FILL_COLOR,
  LOADING_BAR_HEIGHT,
  LOADING_BAR_WIDTH,
  LOADING_FADE_OUT_MS,
  LOADING_LABEL_COLOR,
  LOADING_LABEL_FONT_SIZE,
  LOADING_OVERLAY_BG_ALPHA,
  LOADING_OVERLAY_BG_COLOR,
  LOADING_TIP_COLOR,
  LOADING_TIP_FONT_SIZE,
  LOADING_TIP_ROTATION_MS_DEFAULT,
  LOADING_TIP_WIDTH,
} from "../constants";

export interface LoadingOverlayOptions {
  showTips: boolean;
  tipRotationMs?: number;
  initialLabel?: string;
  initialTip?: string;
}

export class LoadingOverlay {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly barFill: Phaser.GameObjects.Rectangle;
  private readonly labelText: Phaser.GameObjects.Text;
  private readonly tipText: Phaser.GameObjects.Text | null;
  private readonly tipTimer: Phaser.Time.TimerEvent | null;
  private readonly tipProvider: (() => string | null) | null;
  private boundLoader: Phaser.Loader.LoaderPlugin | null = null;
  private boundProgressHandler: ((value: number) => void) | null = null;
  private boundFileProgressHandler: (() => void) | null = null;
  private destroyed = false;

  constructor(
    scene: Phaser.Scene,
    options: LoadingOverlayOptions & { tipProvider?: () => string | null },
  ) {
    this.scene = scene;
    this.tipProvider = options.tipProvider ?? null;

    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    const background = scene.add
      .rectangle(centerX, centerY, CANVAS_WIDTH, CANVAS_HEIGHT, LOADING_OVERLAY_BG_COLOR)
      .setAlpha(LOADING_OVERLAY_BG_ALPHA);

    this.labelText = scene.add
      .text(centerX, centerY - 30, options.initialLabel ?? "", {
        fontFamily: FONT_FAMILY,
        fontSize: `${LOADING_LABEL_FONT_SIZE}px`,
        color: LOADING_LABEL_COLOR,
      })
      .setOrigin(0.5);

    const barBackground = scene.add
      .rectangle(centerX, centerY, LOADING_BAR_WIDTH, LOADING_BAR_HEIGHT, LOADING_BAR_BG_COLOR)
      .setOrigin(0.5);

    this.barFill = scene.add
      .rectangle(
        centerX - LOADING_BAR_WIDTH / 2,
        centerY,
        0,
        LOADING_BAR_HEIGHT,
        LOADING_BAR_FILL_COLOR,
      )
      .setOrigin(0, 0.5);

    const barBorder = scene.add
      .rectangle(centerX, centerY, LOADING_BAR_WIDTH, LOADING_BAR_HEIGHT)
      .setOrigin(0.5)
      .setStrokeStyle(LOADING_BAR_BORDER_WIDTH, LOADING_BAR_BORDER_COLOR, LOADING_BAR_BORDER_ALPHA)
      .setFillStyle();

    const children: Phaser.GameObjects.GameObject[] = [
      background,
      this.labelText,
      barBackground,
      this.barFill,
      barBorder,
    ];

    if (options.showTips) {
      this.tipText = scene.add
        .text(centerX, centerY + 50, options.initialTip ?? "", {
          fontFamily: FONT_FAMILY,
          fontSize: `${LOADING_TIP_FONT_SIZE}px`,
          color: LOADING_TIP_COLOR,
          align: "center",
          wordWrap: { width: LOADING_TIP_WIDTH },
        })
        .setOrigin(0.5);
      children.push(this.tipText);

      const rotationMs = options.tipRotationMs ?? LOADING_TIP_ROTATION_MS_DEFAULT;
      this.tipTimer = scene.time.addEvent({
        delay: rotationMs,
        loop: true,
        callback: () => this.rotateTip(),
      });
    } else {
      this.tipText = null;
      this.tipTimer = null;
    }

    this.container = scene.add.container(0, 0, children).setDepth(DEPTH_LOADING_OVERLAY);
  }

  bindToLoader(loader: Phaser.Loader.LoaderPlugin): void {
    if (this.boundLoader) {
      this.unbindLoader();
    }
    this.boundLoader = loader;
    this.boundProgressHandler = (value: number) => this.setProgress(value);
    this.boundFileProgressHandler = () => this.refreshFileCount();
    loader.on(Phaser.Loader.Events.PROGRESS, this.boundProgressHandler);
    loader.on(Phaser.Loader.Events.FILE_PROGRESS, this.boundFileProgressHandler);
  }

  private unbindLoader(): void {
    if (!this.boundLoader) {
      return;
    }
    if (this.boundProgressHandler) {
      this.boundLoader.off(Phaser.Loader.Events.PROGRESS, this.boundProgressHandler);
    }
    if (this.boundFileProgressHandler) {
      this.boundLoader.off(Phaser.Loader.Events.FILE_PROGRESS, this.boundFileProgressHandler);
    }
    this.boundLoader = null;
    this.boundProgressHandler = null;
    this.boundFileProgressHandler = null;
  }

  setProgress(value: number): void {
    if (this.destroyed) {
      return;
    }
    const clamped = Math.max(0, Math.min(1, value));
    this.barFill.width = LOADING_BAR_WIDTH * clamped;
  }

  setLabel(text: string): void {
    if (this.destroyed) {
      return;
    }
    this.labelText.setText(text);
  }

  setTip(text: string | null): void {
    if (this.destroyed || !this.tipText) {
      return;
    }
    this.tipText.setText(text ?? "");
  }

  private rotateTip(): void {
    if (!this.tipProvider) {
      return;
    }
    const next = this.tipProvider();
    this.setTip(next);
  }

  private refreshFileCount(): void {
    if (this.destroyed || !this.boundLoader) {
      return;
    }
    const loader = this.boundLoader;
    const total = loader.totalToLoad;
    const loaded = loader.totalComplete + loader.totalFailed;
    this.setLabel(`${loaded} / ${total}`);
  }

  fadeOut(durationMs: number = LOADING_FADE_OUT_MS): Promise<void> {
    if (this.destroyed) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        duration: durationMs,
        onComplete: () => {
          this.destroy();
          resolve();
        },
      });
    });
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.unbindLoader();
    if (this.tipTimer) {
      this.tipTimer.remove(false);
    }
    this.container.destroy();
  }
}
