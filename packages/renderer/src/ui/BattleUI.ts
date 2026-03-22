import { ActionKind, type Action, type MoveDefinition, type PokemonInstance } from "@pokemon-tactic/core";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  TYPE_COLORS,
  VICTORY_BUTTON_Y,
  VICTORY_TEXT_X,
  VICTORY_TEXT_Y,
} from "../constants";

export class BattleUI {
  private readonly scene: Phaser.Scene;
  private readonly onMoveSelect: (moveId: string) => void;
  private readonly onEndTurn: () => void;

  private readonly turnInfoText: Phaser.GameObjects.Text;
  private readonly pokemonInfoText: Phaser.GameObjects.Text;
  private moveButtons: Phaser.GameObjects.Container[] = [];
  private readonly endTurnButton: Phaser.GameObjects.Container;
  private victoryOverlay: Phaser.GameObjects.Container | null = null;

  constructor(
    scene: Phaser.Scene,
    onMoveSelect: (moveId: string) => void,
    onEndTurn: () => void,
  ) {
    this.scene = scene;
    this.onMoveSelect = onMoveSelect;
    this.onEndTurn = onEndTurn;

    this.turnInfoText = scene.add
      .text(640, 16, "", {
        fontSize: "16px",
        color: "#ffffff",
        fontFamily: "monospace",
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setDepth(1000);

    this.pokemonInfoText = scene.add
      .text(20, 620, "", {
        fontSize: "14px",
        color: "#ffffff",
        fontFamily: "monospace",
      })
      .setDepth(1000);

    this.endTurnButton = this.createButton(1160, 680, "End Turn", 100, 28, 0x555555, () => {
      this.onEndTurn();
    });
  }

  updateTurnInfo(pokemon: PokemonInstance, playerId: string, roundNumber: number): void {
    const playerLabel = playerId === "player-1" ? "Player 1" : "Player 2";
    this.turnInfoText.setText(
      `Round ${roundNumber} — ${playerLabel} — ${pokemon.definitionId}`,
    );
  }

  updateMoveList(
    moves: MoveDefinition[],
    currentPp: Record<string, number>,
    legalActions: Action[],
  ): void {
    for (const button of this.moveButtons) {
      button.destroy();
    }
    this.moveButtons = [];

    const useMoveIds = new Set<string>();
    for (const action of legalActions) {
      if (action.kind === ActionKind.UseMove) {
        useMoveIds.add(action.moveId);
      }
    }

    const startX = 400;
    const startY = 672;
    const buttonWidth = 160;
    const buttonSpacing = 8;

    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      if (!move) continue;

      const pp = currentPp[move.id] ?? 0;
      const hasTargets = useMoveIds.has(move.id);
      const isUsable = pp > 0 && hasTargets;

      const x = startX + i * (buttonWidth + buttonSpacing);
      const typeColor = TYPE_COLORS[move.type] ?? 0x888888;
      const alpha = isUsable ? 1 : 0.4;

      const button = this.createButton(
        x,
        startY,
        `${move.name}\n${pp}/${move.pp} PP`,
        buttonWidth,
        40,
        typeColor,
        () => {
          if (isUsable) {
            this.onMoveSelect(move.id);
          }
        },
        alpha,
      );

      this.moveButtons.push(button);
    }
  }

  updatePokemonInfo(pokemon: PokemonInstance): void {
    const statusText =
      pokemon.statusEffects.length > 0
        ? ` [${pokemon.statusEffects[0]?.type ?? ""}]`
        : "";
    this.pokemonInfoText.setText(
      `${pokemon.definitionId} — HP: ${pokemon.currentHp}/${pokemon.maxHp}${statusText}`,
    );
  }

  showVictory(winnerId: string): void {
    const playerLabel = winnerId === "player-1" ? "Player 1" : "Player 2";

    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    overlay.setDepth(2000);

    const text = this.scene.add
      .text(VICTORY_TEXT_X, VICTORY_TEXT_Y, `${playerLabel} wins!`, {
        fontSize: "48px",
        color: "#ffcc00",
        fontFamily: "monospace",
        align: "center",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(2001);

    const restartButton = this.createButton(VICTORY_TEXT_X, VICTORY_BUTTON_Y, "Restart", 140, 40, 0x44aa44, () => {
      this.scene.scene.restart();
    });
    restartButton.setDepth(2001);

    this.victoryOverlay = this.scene.add.container(0, 0, [overlay, text, restartButton]);
    this.victoryOverlay.setDepth(2000);
  }

  private createButton(
    x: number,
    y: number,
    label: string,
    width: number,
    height: number,
    color: number,
    onClick: () => void,
    alpha = 1,
  ): Phaser.GameObjects.Container {
    const background = this.scene.add.graphics();
    background.fillStyle(color, alpha);
    background.fillRoundedRect(-width / 2, -height / 2, width, height, 4);
    background.lineStyle(1, 0xffffff, 0.3 * alpha);
    background.strokeRoundedRect(-width / 2, -height / 2, width, height, 4);

    const text = this.scene.add
      .text(0, 0, label, {
        fontSize: "12px",
        color: "#ffffff",
        fontFamily: "monospace",
        align: "center",
      })
      .setOrigin(0.5, 0.5)
      .setAlpha(alpha);

    const container = this.scene.add.container(x, y, [background, text]);
    container.setSize(width, height);
    container.setInteractive();
    container.setDepth(1000);
    container.on("pointerdown", onClick);

    return container;
  }
}
