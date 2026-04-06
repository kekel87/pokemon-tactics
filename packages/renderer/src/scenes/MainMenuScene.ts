import {
  BACKGROUND_COLOR,
  BUTTON_BORDER_COLOR,
  BUTTON_COLOR,
  BUTTON_DISABLED_BORDER_COLOR,
  BUTTON_DISABLED_COLOR,
  BUTTON_HOVER_COLOR,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  TEXT_COLOR_DISABLED,
  TEXT_COLOR_MUTED,
  TEXT_COLOR_PRIMARY,
  TEXT_COLOR_TITLE,
} from "../constants";
import { getLanguage, setLanguage, t } from "../i18n";
import type { TranslationKey } from "../i18n/types";
import { Language } from "../i18n/types";

const TITLE_Y = 180;
const BUTTON_START_Y = 300;
const BUTTON_SPACING = 50;
const BUTTON_WIDTH = 240;
const BUTTON_HEIGHT = 40;
const VERSION_TEXT = "v2026.00";

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BACKGROUND_COLOR);

    this.add
      .text(CANVAS_WIDTH / 2, TITLE_Y, "POKEMON TACTICS", {
        fontSize: "36px",
        fontFamily: "monospace",
        color: TEXT_COLOR_TITLE,
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0.5);

    this.createMenuButton(0, "menu.adventure");
    this.createMenuButton(1, "menu.battle", () => this.scene.start("BattleModeScene"));
    this.createMenuButton(2, "menu.settings", () => this.scene.start("SettingsScene"));
    this.createMenuButton(3, "menu.credits", () => this.scene.start("CreditsScene"));

    this.add
      .text(20, CANVAS_HEIGHT - 24, VERSION_TEXT, {
        fontSize: "12px",
        fontFamily: "monospace",
        color: TEXT_COLOR_DISABLED,
      })
      .setOrigin(0, 1);

    const langButton = this.add
      .text(CANVAS_WIDTH - 20, CANVAS_HEIGHT - 24, getLanguage().toUpperCase(), {
        fontSize: "14px",
        fontFamily: "monospace",
        color: TEXT_COLOR_MUTED,
        backgroundColor: "#222233",
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 1)
      .setInteractive({ useHandCursor: true });

    langButton.on("pointerdown", () => {
      const next = getLanguage() === Language.French ? Language.English : Language.French;
      setLanguage(next);
      this.scene.restart();
    });
  }

  private createMenuButton(index: number, key: TranslationKey, action?: () => void): void {
    const y = BUTTON_START_Y + index * BUTTON_SPACING;
    const disabled = !action;

    const bg = this.add
      .rectangle(
        CANVAS_WIDTH / 2,
        y,
        BUTTON_WIDTH,
        BUTTON_HEIGHT,
        disabled ? BUTTON_DISABLED_COLOR : BUTTON_COLOR,
      )
      .setStrokeStyle(2, disabled ? BUTTON_DISABLED_BORDER_COLOR : BUTTON_BORDER_COLOR)
      .setOrigin(0.5, 0.5);

    this.add
      .text(CANVAS_WIDTH / 2, y, t(key), {
        fontSize: "18px",
        fontFamily: "monospace",
        color: disabled ? "#555566" : TEXT_COLOR_PRIMARY,
      })
      .setOrigin(0.5, 0.5);

    if (action) {
      bg.setInteractive({ useHandCursor: true });
      bg.on("pointerover", () => bg.setFillStyle(BUTTON_HOVER_COLOR));
      bg.on("pointerout", () => bg.setFillStyle(BUTTON_COLOR));
      bg.on("pointerdown", action);
    }
  }
}
