import type { PokemonInstance } from "@pokemon-tactic/core";
import { getPokemonName } from "@pokemon-tactic/data";
import { CANVAS_WIDTH, DEPTH_UI_BASE, FONT_FAMILY } from "../constants";
import { getLanguage, t } from "../i18n";

export class BattleUI {
  private readonly scene: Phaser.Scene;
  private readonly turnInfoText: Phaser.GameObjects.Text;
  private victoryOverlay: HTMLDivElement | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.turnInfoText = scene.add
      .text(CANVAS_WIDTH / 2, 16, "", {
        fontSize: "24px",
        color: "#ffffff",
        fontFamily: FONT_FAMILY,
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setDepth(DEPTH_UI_BASE);
  }

  private getPlayerLabel(playerId: string): string {
    const match = playerId.match(/player-(\d+)/);
    const num = match ? match[1] : "1";
    return t(`teamSelect.player${num}` as import("../i18n/types").TranslationKey);
  }

  updateTurnInfo(pokemon: PokemonInstance, playerId: string, roundNumber: number): void {
    const playerLabel = this.getPlayerLabel(playerId);
    const name = getPokemonName(pokemon.definitionId, getLanguage());
    this.turnInfoText.setText(
      `${t("battle.round", { round: roundNumber })} — ${playerLabel} — ${name}`,
    );
  }

  showVictory(winnerId: string, roundNumber: number): void {
    if (this.victoryOverlay) {
      return;
    }

    const playerLabel = this.getPlayerLabel(winnerId);

    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.7);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      z-index: 2000; font-family: monospace;
    `;

    const text = document.createElement("div");
    text.textContent = t("battle.wins", { player: playerLabel, round: roundNumber });
    text.style.cssText =
      "font-size: 42px; color: #ffcc00; margin-bottom: 24px; text-align: center;";
    overlay.appendChild(text);

    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = "display: flex; gap: 16px;";

    const restartButton = document.createElement("button");
    restartButton.textContent = t("battle.restart");
    restartButton.style.cssText = `
      padding: 10px 40px; font-size: 16px; font-family: monospace;
      background: #44aa44; color: white; border: 2px solid #66cc66;
      border-radius: 6px; cursor: pointer;
    `;
    restartButton.addEventListener("click", () => {
      this.hideVictory();
      this.scene.scene.get("BattleScene").scene.restart();
    });
    buttonContainer.appendChild(restartButton);

    const menuButton = document.createElement("button");
    menuButton.textContent = t("battle.backToMenu");
    menuButton.style.cssText = `
      padding: 10px 40px; font-size: 16px; font-family: monospace;
      background: #335577; color: white; border: 2px solid #5577aa;
      border-radius: 6px; cursor: pointer;
    `;
    menuButton.addEventListener("click", () => {
      this.hideVictory();
      const battleScene = this.scene.scene.get("BattleScene");
      battleScene.scene.stop("BattleScene");
      battleScene.scene.stop("BattleUIScene");
      battleScene.scene.start("MainMenuScene");
    });
    buttonContainer.appendChild(menuButton);

    overlay.appendChild(buttonContainer);

    document.body.appendChild(overlay);
    this.victoryOverlay = overlay;
  }

  hideVictory(): void {
    if (this.victoryOverlay) {
      this.victoryOverlay.remove();
      this.victoryOverlay = null;
    }
  }
}
