import Phaser from "phaser";
import { CANVAS_WIDTH, FONT_FAMILY } from "../constants";

export class MapPreviewUIScene extends Phaser.Scene {
  private infoText: Phaser.GameObjects.Text | null = null;
  private formatText: Phaser.GameObjects.Text | null = null;
  private cursorInfoText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super("MapPreviewUIScene");
  }

  async create(): Promise<void> {
    await document.fonts.ready;

    this.infoText = this.add
      .text(CANVAS_WIDTH / 2, 20, "Loading map...", {
        fontFamily: FONT_FAMILY,
        fontSize: "24px",
        color: "#ffffff",
      })
      .setOrigin(0.5, 0);

    this.formatText = this.add
      .text(CANVAS_WIDTH / 2, 52, "", {
        fontFamily: FONT_FAMILY,
        fontSize: "20px",
        color: "#aaaaff",
        backgroundColor: "#222244",
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        this.scene.get("MapPreviewScene").events.emit("cycleFormat");
      });

    this.cursorInfoText = this.add
      .text(16, 16, "", {
        fontFamily: FONT_FAMILY,
        fontSize: "18px",
        color: "#ffff88",
        backgroundColor: "#222244",
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0, 0);

    this.scene.get("MapPreviewScene").events.emit("uiReady");
  }

  setCursorInfo(gridX: number, gridY: number, height: number): void {
    if (this.cursorInfoText) {
      this.cursorInfoText.setText(`(${gridX}, ${gridY})  h=${height}`);
    }
  }

  clearCursorInfo(): void {
    if (this.cursorInfoText) {
      this.cursorInfoText.setText("");
    }
  }

  setMapInfo(name: string, width: number, height: number): void {
    if (this.infoText) {
      this.infoText.setText(`${name} (${width}x${height})`);
    }
  }

  setFormatInfo(teamCount: number, maxPerTeam: number, index: number, total: number): void {
    if (this.formatText) {
      this.formatText.setText(
        `Format: ${teamCount} teams (${maxPerTeam}/team)  [${index + 1}/${total}]  Click or T`,
      );
    }
  }

  setError(message: string): void {
    if (this.infoText) {
      this.infoText.setText(`Error: ${message}`);
    }
  }
}
