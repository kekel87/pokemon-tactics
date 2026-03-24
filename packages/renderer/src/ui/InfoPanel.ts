import { PlayerId, type PokemonInstance } from "@pokemon-tactic/core";
import {
  DEPTH_INFO_PANEL,
  HP_BAR_BG_ALPHA,
  HP_BAR_BG_COLOR,
  HP_BAR_HEIGHT,
  HP_COLOR_HIGH,
  HP_COLOR_LOW,
  HP_THRESHOLD,
  INFO_PANEL_ALPHA,
  INFO_PANEL_CORNER_RADIUS,
  INFO_PANEL_HEIGHT,
  INFO_PANEL_WIDTH,
  INFO_PANEL_X,
  INFO_PANEL_Y,
  TEAM_COLOR_PLAYER_1,
  TEAM_COLOR_PLAYER_2,
  UI_BORDER_ALPHA,
  UI_BORDER_COLOR,
  UI_BORDER_WIDTH,
  PORTRAIT_SIZE,
} from "../constants";
import { getPortraitKey } from "../sprites/SpriteLoader";
const PORTRAIT_MARGIN: number = 8;
const TEXT_OFFSET_X: number = PORTRAIT_MARGIN + PORTRAIT_SIZE + 8;
const HP_BAR_OFFSET_Y: number = 40;
const HP_BAR_MARGIN_RIGHT: number = 12;
const HP_BAR_PANEL_WIDTH: number = INFO_PANEL_WIDTH - TEXT_OFFSET_X - HP_BAR_MARGIN_RIGHT;

export class InfoPanel {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly hpBarBackground: Phaser.GameObjects.Graphics;
  private readonly hpBarFill: Phaser.GameObjects.Graphics;
  private readonly statusText: Phaser.GameObjects.Text;
  private portrait: Phaser.GameObjects.Image | null = null;
  private currentPortraitKey: string = "";

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.background = scene.add.graphics();

    this.nameText = scene.add.text(TEXT_OFFSET_X, 10, "", {
      fontSize: "14px",
      color: "#ffffff",
      fontFamily: "monospace",
      fontStyle: "bold",
    });

    this.hpBarBackground = scene.add.graphics();
    this.hpBarFill = scene.add.graphics();

    this.hpText = scene.add.text(TEXT_OFFSET_X, HP_BAR_OFFSET_Y + HP_BAR_HEIGHT + 4, "", {
      fontSize: "11px",
      color: "#cccccc",
      fontFamily: "monospace",
    });

    this.statusText = scene.add.text(
      INFO_PANEL_WIDTH - HP_BAR_MARGIN_RIGHT,
      HP_BAR_OFFSET_Y + HP_BAR_HEIGHT + 4,
      "",
      {
        fontSize: "11px",
        color: "#ffcc44",
        fontFamily: "monospace",
        align: "right",
      },
    );
    this.statusText.setOrigin(1, 0);

    this.container = scene.add.container(INFO_PANEL_X, INFO_PANEL_Y, [
      this.background,
      this.nameText,
      this.hpBarBackground,
      this.hpBarFill,
      this.hpText,
      this.statusText,
    ]);
    this.container.setDepth(DEPTH_INFO_PANEL);
    this.container.setVisible(false);
  }

  update(pokemon: PokemonInstance, playerId: string): void {
    this.container.setVisible(true);

    const teamColor = playerId === PlayerId.Player1 ? TEAM_COLOR_PLAYER_1 : TEAM_COLOR_PLAYER_2;
    this.drawBackground(teamColor);

    const name = pokemon.definitionId.charAt(0).toUpperCase() + pokemon.definitionId.slice(1);
    this.nameText.setText(name);

    this.updatePortrait(pokemon.definitionId);

    const hpRatio = pokemon.currentHp / pokemon.maxHp;
    this.drawHpBar(hpRatio);

    this.hpText.setText(`${pokemon.currentHp} / ${pokemon.maxHp}`);

    if (pokemon.statusEffects.length > 0) {
      const statusName = pokemon.statusEffects[0]?.type ?? "";
      this.statusText.setText(statusName.toUpperCase());
    } else {
      this.statusText.setText("");
    }
  }

  hide(): void {
    this.container.setVisible(false);
  }

  destroy(): void {
    this.container.destroy();
  }

  private updatePortrait(definitionId: string): void {
    const portraitKey = getPortraitKey(definitionId);
    if (portraitKey === this.currentPortraitKey) {
      return;
    }
    this.currentPortraitKey = portraitKey;

    if (this.portrait) {
      this.portrait.destroy();
      this.portrait = null;
    }

    const texture = this.scene.textures.get(portraitKey);
    if (texture.key === "__MISSING") {
      return;
    }

    this.portrait = this.scene.add.image(
      PORTRAIT_MARGIN + PORTRAIT_SIZE / 2,
      INFO_PANEL_HEIGHT / 2,
      portraitKey,
    );
    this.container.add(this.portrait);
  }

  private drawBackground(teamColor: number): void {
    this.background.clear();
    this.background.fillStyle(teamColor, INFO_PANEL_ALPHA);
    this.background.fillRoundedRect(
      0,
      0,
      INFO_PANEL_WIDTH,
      INFO_PANEL_HEIGHT,
      INFO_PANEL_CORNER_RADIUS,
    );
    this.background.lineStyle(UI_BORDER_WIDTH, UI_BORDER_COLOR, UI_BORDER_ALPHA);
    this.background.strokeRoundedRect(
      0,
      0,
      INFO_PANEL_WIDTH,
      INFO_PANEL_HEIGHT,
      INFO_PANEL_CORNER_RADIUS,
    );
  }

  private drawHpBar(hpRatio: number): void {
    this.hpBarBackground.clear();
    this.hpBarBackground.fillStyle(HP_BAR_BG_COLOR, HP_BAR_BG_ALPHA);
    this.hpBarBackground.fillRect(
      TEXT_OFFSET_X,
      HP_BAR_OFFSET_Y,
      HP_BAR_PANEL_WIDTH,
      HP_BAR_HEIGHT,
    );

    this.hpBarFill.clear();
    const hpColor = hpRatio > HP_THRESHOLD ? HP_COLOR_HIGH : HP_COLOR_LOW;
    this.hpBarFill.fillStyle(hpColor, 1);
    this.hpBarFill.fillRect(
      TEXT_OFFSET_X,
      HP_BAR_OFFSET_Y,
      HP_BAR_PANEL_WIDTH * hpRatio,
      HP_BAR_HEIGHT,
    );
  }
}
