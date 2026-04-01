import { PlayerId, type PokemonInstance } from "@pokemon-tactic/core";
import { CANVAS_WIDTH, DEPTH_UI_BASE } from "../constants";

export class BattleUI {
  private readonly scene: Phaser.Scene;
  private readonly turnInfoText: Phaser.GameObjects.Text;
  private victoryOverlay: HTMLDivElement | null = null;

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
    const playerLabel = playerId === PlayerId.Player1 ? "Player 1" : "Player 2";
    const name = pokemon.definitionId.charAt(0).toUpperCase() + pokemon.definitionId.slice(1);
    this.turnInfoText.setText(`Round ${roundNumber} — ${playerLabel} — ${name}`);
  }

  showVictory(winnerId: string, roundNumber: number): void {
    if (this.victoryOverlay) {
      return;
    }

    const playerLabel = winnerId === PlayerId.Player1 ? "Player 1" : "Player 2";

    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.7);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      z-index: 2000; font-family: monospace;
    `;

    const text = document.createElement("div");
    text.textContent = `${playerLabel} wins! — Round ${roundNumber}`;
    text.style.cssText = "font-size: 42px; color: #ffcc00; margin-bottom: 24px; text-align: center;";
    overlay.appendChild(text);

    const button = document.createElement("button");
    button.textContent = "Restart";
    button.style.cssText = `
      padding: 10px 40px; font-size: 16px; font-family: monospace;
      background: #44aa44; color: white; border: 2px solid #66cc66;
      border-radius: 6px; cursor: pointer;
    `;
    button.addEventListener("click", () => {
      this.hideVictory();
      this.scene.scene.get("BattleScene").scene.restart();
    });
    overlay.appendChild(button);

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
