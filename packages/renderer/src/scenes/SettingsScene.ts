import { BACKGROUND_COLOR, CANVAS_WIDTH, FONT_FAMILY, HOVER_CURSOR_OPTIONS } from "../constants";
import { getLanguage, setLanguage, t } from "../i18n";
import { Language } from "../i18n/types";
import { getSettings, updateSettings } from "../settings";

const TITLE_Y = 200;
const ROW_START_Y = 300;
const ROW_SPACING = 60;
const LABEL_X: number = CANVAS_WIDTH / 2 - 140;
const TOGGLE_X: number = CANVAS_WIDTH / 2 + 140;
const TOGGLE_WIDTH = 140;
const TOGGLE_HEIGHT = 32;
const BACK_BUTTON_Y: number = ROW_START_Y + 3 * ROW_SPACING + 40;
const BUTTON_WIDTH = 160;
const BUTTON_HEIGHT = 40;

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super("SettingsScene");
  }

  preload(): void {
    for (const option of HOVER_CURSOR_OPTIONS) {
      if (!this.textures.exists(option.key)) {
        this.load.image(option.key, `assets/ui/cursor/${option.key}.png`);
      }
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BACKGROUND_COLOR);

    this.add
      .text(CANVAS_WIDTH / 2, TITLE_Y, t("settings.title"), {
        fontSize: "36px",
        fontFamily: FONT_FAMILY,
        color: "#ffffff",
      })
      .setOrigin(0.5, 0.5);

    this.buildLanguageRow(ROW_START_Y);
    this.buildDamagePreviewRow(ROW_START_Y + ROW_SPACING);
    this.buildCursorRow(ROW_START_Y + 2 * ROW_SPACING);
    this.buildBackButton();
  }

  private buildLanguageRow(y: number): void {
    this.add
      .text(LABEL_X, y, t("settings.language"), {
        fontSize: "20px",
        fontFamily: FONT_FAMILY,
        color: "#cccccc",
      })
      .setOrigin(0, 0.5);

    const currentLang = getLanguage();
    const langText = currentLang === Language.French ? "FR" : "EN";

    const bg = this.add
      .rectangle(TOGGLE_X, y, TOGGLE_WIDTH, TOGGLE_HEIGHT, 0x335577)
      .setStrokeStyle(2, 0x5577aa)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(TOGGLE_X, y, langText, {
        fontSize: "20px",
        fontFamily: FONT_FAMILY,
        color: "#ffffff",
      })
      .setOrigin(0.5, 0.5);

    bg.on("pointerover", () => bg.setFillStyle(0x446688));
    bg.on("pointerout", () => bg.setFillStyle(0x335577));
    bg.on("pointerdown", () => {
      const next = getLanguage() === Language.French ? Language.English : Language.French;
      setLanguage(next);
      this.scene.restart();
    });
  }

  private buildDamagePreviewRow(y: number): void {
    this.add
      .text(LABEL_X, y, t("settings.damagePreview"), {
        fontSize: "20px",
        fontFamily: FONT_FAMILY,
        color: "#cccccc",
      })
      .setOrigin(0, 0.5);

    const enabled = getSettings().damagePreview;
    const toggleText = enabled ? t("settings.on") : t("settings.off");

    const bg = this.add
      .rectangle(TOGGLE_X, y, TOGGLE_WIDTH, TOGGLE_HEIGHT, enabled ? 0x44aa44 : 0x774444)
      .setStrokeStyle(2, enabled ? 0x66cc66 : 0x996666)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(TOGGLE_X, y, toggleText, {
        fontSize: "20px",
        fontFamily: FONT_FAMILY,
        color: "#ffffff",
      })
      .setOrigin(0.5, 0.5);

    bg.on("pointerover", () => bg.setFillStyle(enabled ? 0x55bb55 : 0x885555));
    bg.on("pointerout", () => bg.setFillStyle(enabled ? 0x44aa44 : 0x774444));
    bg.on("pointerdown", () => {
      updateSettings({ damagePreview: !getSettings().damagePreview });
      this.scene.restart();
    });
  }

  private buildCursorRow(y: number): void {
    this.add
      .text(LABEL_X, y, t("settings.cursor"), {
        fontSize: "20px",
        fontFamily: FONT_FAMILY,
        color: "#cccccc",
      })
      .setOrigin(0, 0.5);

    const currentKey = getSettings().hoverCursorKey;
    const currentIndex = Math.max(
      0,
      HOVER_CURSOR_OPTIONS.findIndex((option) => option.key === currentKey),
    );
    const currentOption = HOVER_CURSOR_OPTIONS[currentIndex] ?? HOVER_CURSOR_OPTIONS[0];

    const bg = this.add
      .rectangle(TOGGLE_X, y, TOGGLE_WIDTH, TOGGLE_HEIGHT, 0x335577)
      .setStrokeStyle(2, 0x5577aa)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

    this.add
      .image(TOGGLE_X - TOGGLE_WIDTH / 2 + 18, y, currentOption.key)
      .setScale(currentOption.scale)
      .setOrigin(0.5, 0.5);

    this.add
      .text(TOGGLE_X + 10, y, currentOption.label, {
        fontSize: "16px",
        fontFamily: FONT_FAMILY,
        color: "#ffffff",
      })
      .setOrigin(0.5, 0.5);

    bg.on("pointerover", () => bg.setFillStyle(0x446688));
    bg.on("pointerout", () => bg.setFillStyle(0x335577));
    bg.on("pointerdown", () => {
      const nextIndex = (currentIndex + 1) % HOVER_CURSOR_OPTIONS.length;
      const nextOption = HOVER_CURSOR_OPTIONS[nextIndex] ?? HOVER_CURSOR_OPTIONS[0];
      updateSettings({ hoverCursorKey: nextOption.key });
      this.scene.restart();
    });
  }

  private buildBackButton(): void {
    const bg = this.add
      .rectangle(CANVAS_WIDTH / 2, BACK_BUTTON_Y, BUTTON_WIDTH, BUTTON_HEIGHT, 0x335577)
      .setStrokeStyle(2, 0x5577aa)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(CANVAS_WIDTH / 2, BACK_BUTTON_Y, t("settings.back"), {
        fontSize: "24px",
        fontFamily: FONT_FAMILY,
        color: "#ffffff",
      })
      .setOrigin(0.5, 0.5);

    bg.on("pointerover", () => bg.setFillStyle(0x446688));
    bg.on("pointerout", () => bg.setFillStyle(0x335577));
    bg.on("pointerdown", () => this.scene.start("MainMenuScene"));
  }
}
