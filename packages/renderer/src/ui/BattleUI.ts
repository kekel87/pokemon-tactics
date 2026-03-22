import type { PokemonInstance } from "@pokemon-tactic/core";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DEPTH_UI_BASE,
  DEPTH_VICTORY_CONTENT,
  DEPTH_VICTORY_OVERLAY,
  UI_BORDER_ALPHA,
  UI_BORDER_COLOR,
  UI_BORDER_WIDTH,
  UI_BUTTON_CORNER_RADIUS,
  VICTORY_BUTTON_Y,
  VICTORY_TEXT_X,
  VICTORY_TEXT_Y,
} from "../constants";

export class BattleUI {
  private readonly scene: Phaser.Scene;
  private readonly turnInfoText: Phaser.GameObjects.Text;
  private victoryOverlay: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.turnInfoText = scene.add
      .text(CANVAS_WIDTH / 2, 16, "", {
        fontSize: "16px",
        color: "#ffffff",
        fontFamily: "monospace",
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setDepth(DEPTH_UI_BASE);
  }

  updateTurnInfo(pokemon: PokemonInstance, playerId: string, roundNumber: number): void {
    const playerLabel = playerId === "player-1" ? "Player 1" : "Player 2";
    const name = pokemon.definitionId.charAt(0).toUpperCase() + pokemon.definitionId.slice(1);
    this.turnInfoText.setText(`Round ${roundNumber} — ${playerLabel} — ${name}`);
  }

  showVictory(winnerId: string, roundNumber: number): void {
    if (this.victoryOverlay) {
      return;
    }

    const playerLabel = winnerId === "player-1" ? "Player 1" : "Player 2";

    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    overlay.setDepth(DEPTH_VICTORY_OVERLAY);

    const text = this.scene.add
      .text(VICTORY_TEXT_X, VICTORY_TEXT_Y, `${playerLabel} wins!\nRound ${roundNumber}`, {
        fontSize: "48px",
        color: "#ffcc00",
        fontFamily: "monospace",
        align: "center",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH_VICTORY_CONTENT);

    const restartButton = this.createButton(
      VICTORY_TEXT_X,
      VICTORY_BUTTON_Y,
      "Restart",
      140,
      40,
      0x44aa44,
      () => {
        this.scene.scene.restart();
      },
    );
    restartButton.setDepth(DEPTH_VICTORY_CONTENT);

    this.victoryOverlay = this.scene.add.container(0, 0, [overlay, text, restartButton]);
    this.victoryOverlay.setDepth(DEPTH_VICTORY_OVERLAY);
  }

  private createButton(
    x: number,
    y: number,
    label: string,
    width: number,
    height: number,
    color: number,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const background = this.scene.add.graphics();
    background.fillStyle(color, 1);
    background.fillRoundedRect(-width / 2, -height / 2, width, height, UI_BUTTON_CORNER_RADIUS);
    background.lineStyle(UI_BORDER_WIDTH, UI_BORDER_COLOR, UI_BORDER_ALPHA);
    background.strokeRoundedRect(-width / 2, -height / 2, width, height, UI_BUTTON_CORNER_RADIUS);

    const buttonText = this.scene.add
      .text(0, 0, label, {
        fontSize: "12px",
        color: "#ffffff",
        fontFamily: "monospace",
        align: "center",
      })
      .setOrigin(0.5, 0.5);

    const container = this.scene.add.container(x, y, [background, buttonText]);
    container.setSize(width, height);
    container.setInteractive(
      new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
      Phaser.Geom.Rectangle.Contains,
    );
    container.setDepth(DEPTH_UI_BASE);
    container.on("pointerdown", onClick);

    return container;
  }
}
