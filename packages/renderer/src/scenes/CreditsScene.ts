import { BACKGROUND_COLOR, CANVAS_WIDTH, FONT_FAMILY } from "../constants";
import { t } from "../i18n";

const TITLE_Y = 140;
const CONTENT_START_Y = 220;
const BUTTON_WIDTH = 160;
const BUTTON_HEIGHT = 40;

export class CreditsScene extends Phaser.Scene {
  constructor() {
    super("CreditsScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BACKGROUND_COLOR);

    this.add
      .text(CANVAS_WIDTH / 2, TITLE_Y, t("credits.title"), {
        fontSize: "36px",
        fontFamily: FONT_FAMILY,
        color: "#ffffff",
      })
      .setOrigin(0.5, 0.5);

    let y = CONTENT_START_Y;

    this.add
      .text(CANVAS_WIDTH / 2, y, t("credits.disclaimer"), {
        fontSize: "16px",
        fontFamily: FONT_FAMILY,
        color: "#cccccc",
        align: "center",
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0);

    y += 130;

    this.add.rectangle(CANVAS_WIDTH / 2, y, 400, 1, 0x444466).setOrigin(0.5, 0.5);

    y += 30;

    this.add
      .text(CANVAS_WIDTH / 2, y, t("credits.sprites"), {
        fontSize: "16px",
        fontFamily: FONT_FAMILY,
        color: "#aaaacc",
        align: "center",
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0);

    y += 60;

    this.add
      .text(CANVAS_WIDTH / 2, y, t("credits.tileset"), {
        fontSize: "16px",
        fontFamily: FONT_FAMILY,
        color: "#aaaacc",
        align: "center",
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0);

    y += 50;

    this.add
      .text(CANVAS_WIDTH / 2, y, t("credits.font"), {
        fontSize: "16px",
        fontFamily: FONT_FAMILY,
        color: "#aaaacc",
        align: "center",
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0);

    y += 50;

    this.add
      .text(CANVAS_WIDTH / 2, y, t("credits.code"), {
        fontSize: "16px",
        fontFamily: FONT_FAMILY,
        color: "#aaaacc",
        align: "center",
      })
      .setOrigin(0.5, 0);

    y += 70;

    this.buildBackButton(y);
  }

  private buildBackButton(y: number): void {
    const bg = this.add
      .rectangle(CANVAS_WIDTH / 2, y, BUTTON_WIDTH, BUTTON_HEIGHT, 0x335577)
      .setStrokeStyle(2, 0x5577aa)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(CANVAS_WIDTH / 2, y, t("credits.back"), {
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
