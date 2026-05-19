import type { PlayerId } from "@pokemon-tactic/core";
import { getPokemonName } from "@pokemon-tactic/data";
import {
  CANVAS_WIDTH,
  DEPTH_INFO_PANEL,
  FONT_FAMILY,
  getTeamColorByPlayerId,
  INFO_PANEL_CORNER_RADIUS,
  PLACEMENT_FINISH_BUTTON_BG,
  PLACEMENT_FINISH_BUTTON_BORDER,
  PLACEMENT_FINISH_BUTTON_HEIGHT,
  PLACEMENT_FINISH_BUTTON_WIDTH,
  PLACEMENT_PANEL_ALPHA,
  PLACEMENT_PANEL_HEIGHT,
  PLACEMENT_PANEL_Y,
  PLACEMENT_PORTRAIT_SIZE,
  PLACEMENT_PORTRAIT_SPACING,
  UI_BORDER_ALPHA,
  UI_BORDER_COLOR,
  UI_BORDER_WIDTH,
} from "../constants";
import { getLanguage, t } from "../i18n";
import { getPortraitKey } from "../sprites/SpriteLoader";

interface RosterEntry {
  pokemonId: string;
  definitionId: string;
  placed: boolean;
}

export interface PlacementRosterCallbacks {
  onSelect: (pokemonId: string) => void;
  onFinish?: () => void;
}

export class PlacementRosterPanel {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly turnText: Phaser.GameObjects.Text;
  private readonly portraitContainers: Phaser.GameObjects.Container[] = [];
  private readonly finishButton: Phaser.GameObjects.Container;
  private onSelectCallback: ((pokemonId: string) => void) | null = null;
  private onFinishCallback: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.background = scene.add.graphics();
    this.turnText = scene.add.text(CANVAS_WIDTH / 2, 12, "", {
      fontSize: "18px",
      color: "#ffffff",
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      align: "center",
    });
    this.turnText.setOrigin(0.5, 0);

    this.finishButton = this.buildFinishButton();
    this.finishButton.setVisible(false);

    this.container = scene.add.container(0, PLACEMENT_PANEL_Y, [
      this.background,
      this.turnText,
      this.finishButton,
    ]);
    this.container.setDepth(DEPTH_INFO_PANEL);
    this.container.setScrollFactor(0);
    this.container.setVisible(false);
  }

  show(
    playerId: PlayerId,
    roster: RosterEntry[],
    selectedPokemonId: string | null,
    callbacks: PlacementRosterCallbacks,
  ): void {
    this.onSelectCallback = callbacks.onSelect;
    this.onFinishCallback = callbacks.onFinish ?? null;
    this.container.setVisible(true);

    const teamColor = getTeamColorByPlayerId(playerId);

    this.drawBackground(teamColor);

    const match = playerId.match(/player-(\d+)/);
    const playerNumber = match?.[1] ?? "1";
    this.turnText.setText(t("placement.instruction", { player: playerNumber }));

    this.clearPortraits();

    const totalWidth =
      roster.length * PLACEMENT_PORTRAIT_SIZE + (roster.length - 1) * PLACEMENT_PORTRAIT_SPACING;
    const startX = (CANVAS_WIDTH - totalWidth) / 2;
    const portraitY = 65;

    for (let i = 0; i < roster.length; i++) {
      const entry = roster[i];
      if (!entry) {
        continue;
      }

      const x =
        startX +
        i * (PLACEMENT_PORTRAIT_SIZE + PLACEMENT_PORTRAIT_SPACING) +
        PLACEMENT_PORTRAIT_SIZE / 2;

      const portraitContainer = this.createPortraitEntry(
        x,
        portraitY,
        entry,
        entry.pokemonId === selectedPokemonId,
      );
      this.portraitContainers.push(portraitContainer);
      this.container.add(portraitContainer);
    }

    this.finishButton.setVisible(this.onFinishCallback !== null);
  }

  hide(): void {
    this.container.setVisible(false);
    this.clearPortraits();
    this.finishButton.setVisible(false);
    this.onFinishCallback = null;
  }

  destroy(): void {
    this.container.destroy();
  }

  private createPortraitEntry(
    x: number,
    y: number,
    entry: RosterEntry,
    isSelected: boolean,
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);

    const border = this.scene.add.graphics();
    const borderSize = PLACEMENT_PORTRAIT_SIZE + 4;
    if (isSelected) {
      border.lineStyle(2, 0xffdd44, 1);
      border.strokeRect(-borderSize / 2, -borderSize / 2, borderSize, borderSize);
    }
    container.add(border);

    const portraitKey = getPortraitKey(entry.definitionId);
    const texture = this.scene.textures.get(portraitKey);
    if (texture.key === "__MISSING") {
      const fallback = this.scene.add.graphics();
      const fallbackColor = entry.placed ? 0x555555 : 0xaaaaaa;
      fallback.fillStyle(fallbackColor, 1);
      fallback.fillRect(
        -PLACEMENT_PORTRAIT_SIZE / 2,
        -PLACEMENT_PORTRAIT_SIZE / 2,
        PLACEMENT_PORTRAIT_SIZE,
        PLACEMENT_PORTRAIT_SIZE,
      );
      container.add(fallback);
    } else {
      const portrait = this.scene.add.image(0, 0, portraitKey);
      portrait.setDisplaySize(PLACEMENT_PORTRAIT_SIZE, PLACEMENT_PORTRAIT_SIZE);
      if (entry.placed) {
        portrait.setTint(0x555555);
      }
      container.add(portrait);
    }

    if (entry.placed) {
      const checkmark = this.scene.add.text(0, 0, "✓", {
        fontSize: "24px",
        color: "#44cc44",
        fontFamily: FONT_FAMILY,
        fontStyle: "bold",
      });
      checkmark.setOrigin(0.5, 0.5);
      container.add(checkmark);
    }

    const name = getPokemonName(entry.definitionId, getLanguage());
    const nameText = this.scene.add.text(0, PLACEMENT_PORTRAIT_SIZE / 2 + 4, name, {
      fontSize: "12px",
      color: "#cccccc",
      fontFamily: FONT_FAMILY,
      align: "center",
    });
    nameText.setOrigin(0.5, 0);
    container.add(nameText);

    if (!entry.placed) {
      const hitZone = this.scene.add.zone(0, 0, PLACEMENT_PORTRAIT_SIZE, PLACEMENT_PORTRAIT_SIZE);
      hitZone.setInteractive({ useHandCursor: true });
      hitZone.on("pointerdown", () => {
        this.onSelectCallback?.(entry.pokemonId);
      });
      container.add(hitZone);
    }

    return container;
  }

  private drawBackground(teamColor: number): void {
    this.background.clear();
    this.background.fillStyle(teamColor, PLACEMENT_PANEL_ALPHA);
    this.background.fillRoundedRect(
      0,
      0,
      CANVAS_WIDTH,
      PLACEMENT_PANEL_HEIGHT,
      INFO_PANEL_CORNER_RADIUS,
    );
    this.background.lineStyle(UI_BORDER_WIDTH, UI_BORDER_COLOR, UI_BORDER_ALPHA);
    this.background.strokeRoundedRect(
      0,
      0,
      CANVAS_WIDTH,
      PLACEMENT_PANEL_HEIGHT,
      INFO_PANEL_CORNER_RADIUS,
    );
  }

  private clearPortraits(): void {
    for (const container of this.portraitContainers) {
      container.destroy();
    }
    this.portraitContainers.length = 0;
  }

  private buildFinishButton(): Phaser.GameObjects.Container {
    const width = PLACEMENT_FINISH_BUTTON_WIDTH;
    const height = PLACEMENT_FINISH_BUTTON_HEIGHT;
    const container = this.scene.add.container(CANVAS_WIDTH - width - 20, 10);
    const bg = this.scene.add.graphics();
    bg.fillStyle(PLACEMENT_FINISH_BUTTON_BG, 0.95);
    bg.fillRoundedRect(0, 0, width, height, 6);
    bg.lineStyle(2, PLACEMENT_FINISH_BUTTON_BORDER, 1);
    bg.strokeRoundedRect(0, 0, width, height, 6);
    container.add(bg);
    const label = this.scene.add.text(width / 2, height / 2 + 1, t("placement.done"), {
      fontSize: "18px",
      color: "#ffffff",
      fontFamily: FONT_FAMILY,
    });
    label.setOrigin(0.5, 0.5);
    container.add(label);
    const hit = this.scene.add.zone(0, 0, width, height).setOrigin(0, 0);
    hit.setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => this.onFinishCallback?.());
    container.add(hit);
    return container;
  }
}
