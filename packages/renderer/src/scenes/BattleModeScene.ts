import { BACKGROUND_COLOR, CANVAS_WIDTH } from "../constants";
import { t } from "../i18n";
import type { TranslationKey } from "../i18n/types";

const TITLE_Y = 200;
const BUTTON_START_Y = 300;
const BUTTON_SPACING = 50;
const BUTTON_WIDTH = 240;
const BUTTON_HEIGHT = 40;
const BACK_BUTTON_Y: number = BUTTON_START_Y + 3 * BUTTON_SPACING + 20;

export class BattleModeScene extends Phaser.Scene {
  constructor() {
    super("BattleModeScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BACKGROUND_COLOR);

    this.add
      .text(CANVAS_WIDTH / 2, TITLE_Y, t("battleMode.title"), {
        fontSize: "28px",
        fontFamily: "monospace",
        color: "#ffffff",
      })
      .setOrigin(0.5, 0.5);

    this.createMenuButton(0, "battleMode.local", () => this.scene.start("TeamSelectScene"));
    this.createMenuButton(1, "battleMode.online");
    this.createMenuButton(2, "battleMode.tutorial");

    this.buildBackButton();
  }

  private createMenuButton(index: number, key: TranslationKey, action?: () => void): void {
    const y = BUTTON_START_Y + index * BUTTON_SPACING;
    const disabled = !action;

    const bg = this.add
      .rectangle(CANVAS_WIDTH / 2, y, BUTTON_WIDTH, BUTTON_HEIGHT, disabled ? 0x333344 : 0x335577)
      .setStrokeStyle(2, disabled ? 0x444455 : 0x5577aa)
      .setOrigin(0.5, 0.5);

    this.add
      .text(CANVAS_WIDTH / 2, y, t(key), {
        fontSize: "18px",
        fontFamily: "monospace",
        color: disabled ? "#555566" : "#ffffff",
      })
      .setOrigin(0.5, 0.5);

    if (action) {
      bg.setInteractive({ useHandCursor: true });
      bg.on("pointerover", () => bg.setFillStyle(0x446688));
      bg.on("pointerout", () => bg.setFillStyle(0x335577));
      bg.on("pointerdown", action);
    }
  }

  private buildBackButton(): void {
    const bg = this.add
      .rectangle(CANVAS_WIDTH / 2, BACK_BUTTON_Y, BUTTON_WIDTH, BUTTON_HEIGHT, 0x335577)
      .setStrokeStyle(2, 0x5577aa)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(CANVAS_WIDTH / 2, BACK_BUTTON_Y, t("battleMode.back"), {
        fontSize: "18px",
        fontFamily: "monospace",
        color: "#ffffff",
      })
      .setOrigin(0.5, 0.5);

    bg.on("pointerover", () => bg.setFillStyle(0x446688));
    bg.on("pointerout", () => bg.setFillStyle(0x335577));
    bg.on("pointerdown", () => this.scene.start("MainMenuScene"));
  }
}
