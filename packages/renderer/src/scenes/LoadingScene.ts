import { createPrng } from "@pokemon-tactic/core";
import Phaser from "phaser";

import { t } from "../i18n";
import { createTipProvider } from "../i18n/loading-tips";
import type { TranslationKey } from "../i18n/types";
import { sandboxBootConfig } from "../sandbox-boot";
import { LoadingOverlay } from "../ui/LoadingOverlay";
import { preloadSharedUiAssets } from "./preload-shared";

export interface LoadingSceneData {
  queueAssets: (scene: Phaser.Scene) => void;
  nextScene: string;
  nextSceneData?: object;
  showTips: boolean;
  labelKey?: TranslationKey;
}

export class LoadingScene extends Phaser.Scene {
  private config: LoadingSceneData | null = null;
  private overlay: LoadingOverlay | null = null;

  constructor() {
    super("LoadingScene");
  }

  init(data: Partial<LoadingSceneData> | undefined): void {
    if (data && typeof data.queueAssets === "function" && data.nextScene) {
      this.config = {
        queueAssets: data.queueAssets,
        nextScene: data.nextScene,
        nextSceneData: data.nextSceneData,
        showTips: data.showTips ?? false,
        labelKey: data.labelKey,
      };
    } else {
      this.config = {
        queueAssets: preloadSharedUiAssets,
        nextScene: sandboxBootConfig.enabled ? "TeamSelectScene" : "MainMenuScene",
        showTips: false,
        labelKey: "loading.boot",
      };
    }
  }

  preload(): void {
    if (!this.config) {
      return;
    }
    const tipProvider = this.config.showTips
      ? createTipProvider(createPrng(Date.now() & 0xffffffff))
      : undefined;
    this.overlay = new LoadingOverlay(this, {
      showTips: this.config.showTips,
      initialLabel: this.config.labelKey ? t(this.config.labelKey) : "",
      initialTip: tipProvider ? tipProvider() : undefined,
      tipProvider,
    });
    this.overlay.bindToLoader(this.load);
    this.config.queueAssets(this);
  }

  async create(): Promise<void> {
    if (!this.config) {
      return;
    }
    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    await fontsReady;
    if (this.overlay) {
      await this.overlay.fadeOut();
      this.overlay = null;
    }
    this.scene.start(this.config.nextScene, this.config.nextSceneData ?? {});
  }
}
