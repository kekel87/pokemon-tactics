import {
  BATTLE_LOG_ACTIONS_HEIGHT,
  BATTLE_LOG_BG_ALPHA,
  BATTLE_LOG_BG_COLOR,
  BATTLE_LOG_FONT_SIZE,
  BATTLE_LOG_HEADER_HEIGHT,
  BATTLE_LOG_LINE_HEIGHT,
  BATTLE_LOG_MAX_ENTRIES,
  BATTLE_LOG_PADDING,
  BATTLE_LOG_VISIBLE_LINES,
  BATTLE_LOG_WIDTH,
  CANVAS_WIDTH,
  DEPTH_BATTLE_LOG,
} from "../constants";
import { t } from "../i18n";
import type { BattleLogEntry } from "./BattleLogFormatter";

const HEADER_FONT_SIZE = 13;
const REPLAY_BUTTON_LABELS = ["|◁", "◁◁", "▷", "▷▷", "▷|"];
const REPLAY_BUTTON_DISABLED_COLOR = "#555555";
const COLLAPSED_SIZE = 32;
const MARGIN = 8;
const TEAM_DOT_SIZE = 6;
const TEAM_DOT_MARGIN = 4;

export class BattleLogPanel {
  private readonly scene: Phaser.Scene;
  private readonly x: number;
  private readonly y: number;

  private readonly entries: BattleLogEntry[] = [];
  private scrollOffset = 0;
  private collapsed = true;

  private background!: Phaser.GameObjects.Graphics;
  private headerTitle!: Phaser.GameObjects.Text;
  private headerBurger!: Phaser.GameObjects.Text;
  private headerHitArea!: Phaser.GameObjects.Rectangle;
  private readonly lineTexts: Phaser.GameObjects.Text[] = [];
  private readonly teamDots: Phaser.GameObjects.Graphics[] = [];
  private replayBar!: Phaser.GameObjects.Graphics;
  private readonly replayButtons: Phaser.GameObjects.Text[] = [];

  private collapsedBg!: Phaser.GameObjects.Graphics;
  private collapsedIcon!: Phaser.GameObjects.Text;
  private collapsedHitArea!: Phaser.GameObjects.Rectangle;
  private scrollZone!: Phaser.GameObjects.Rectangle;

  onPokemonClick: ((pokemonId: string) => void) | null = null;
  getTeamColor: ((pokemonId: string) => number) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.x = CANVAS_WIDTH - BATTLE_LOG_WIDTH - MARGIN;
    this.y = MARGIN;

    this.createExpandedView();
    this.createCollapsedView();
    this.setCollapsed(true);
  }

  addEntry(entry: BattleLogEntry): void {
    this.pushEntry(entry);
    this.scrollToBottom();
    this.renderLines();
  }

  addEntries(entries: readonly BattleLogEntry[]): void {
    for (const entry of entries) {
      this.pushEntry(entry);
    }
    this.scrollToBottom();
    this.renderLines();
  }

  private pushEntry(entry: BattleLogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > BATTLE_LOG_MAX_ENTRIES) {
      this.entries.shift();
      if (this.scrollOffset > 0) this.scrollOffset--;
    }
  }

  toggle(): void {
    this.setCollapsed(!this.collapsed);
  }

  destroy(): void {
    this.background.destroy();
    this.headerTitle.destroy();
    this.headerBurger.destroy();
    this.headerHitArea.destroy();
    for (const text of this.lineTexts) text.destroy();
    for (const dot of this.teamDots) dot.destroy();
    this.replayBar.destroy();
    for (const button of this.replayButtons) button.destroy();
    this.scrollZone.destroy();
    this.collapsedBg.destroy();
    this.collapsedIcon.destroy();
    this.collapsedHitArea.destroy();
  }

  private createExpandedView(): void {
    const bodyHeight = BATTLE_LOG_VISIBLE_LINES * BATTLE_LOG_LINE_HEIGHT;
    const totalHeight = BATTLE_LOG_HEADER_HEIGHT + bodyHeight + BATTLE_LOG_ACTIONS_HEIGHT;

    this.background = this.scene.add.graphics();
    this.background.setDepth(DEPTH_BATTLE_LOG);
    this.drawExpandedBackground(totalHeight);

    this.headerTitle = this.scene.add
      .text(this.x + BATTLE_LOG_PADDING, this.y + 6, t("log.title"), {
        fontSize: `${HEADER_FONT_SIZE}px`,
        color: "#cccccc",
        fontFamily: "monospace",
      })
      .setDepth(DEPTH_BATTLE_LOG + 1);

    this.headerBurger = this.scene.add
      .text(this.x + BATTLE_LOG_WIDTH - BATTLE_LOG_PADDING, this.y + 6, "☰", {
        fontSize: `${HEADER_FONT_SIZE}px`,
        color: "#cccccc",
        fontFamily: "monospace",
      })
      .setOrigin(1, 0)
      .setDepth(DEPTH_BATTLE_LOG + 1);

    this.headerHitArea = this.scene.add
      .rectangle(
        this.x + BATTLE_LOG_WIDTH / 2,
        this.y + BATTLE_LOG_HEADER_HEIGHT / 2,
        BATTLE_LOG_WIDTH,
        BATTLE_LOG_HEADER_HEIGHT,
        0x000000,
        0,
      )
      .setDepth(DEPTH_BATTLE_LOG + 2)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.toggle());

    const textOffsetX = BATTLE_LOG_PADDING + TEAM_DOT_SIZE + TEAM_DOT_MARGIN;
    const bodyY = this.y + BATTLE_LOG_HEADER_HEIGHT;
    for (let i = 0; i < BATTLE_LOG_VISIBLE_LINES; i++) {
      const lineY = bodyY + i * BATTLE_LOG_LINE_HEIGHT + 2;

      const dot = this.scene.add.graphics();
      dot.setDepth(DEPTH_BATTLE_LOG + 1);
      this.teamDots.push(dot);

      const lineText = this.scene.add
        .text(
          this.x + textOffsetX,
          lineY,
          "",
          {
            fontSize: `${BATTLE_LOG_FONT_SIZE}px`,
            color: "#ffffff",
            fontFamily: "monospace",
            wordWrap: { width: BATTLE_LOG_WIDTH - textOffsetX - BATTLE_LOG_PADDING },
          },
        )
        .setDepth(DEPTH_BATTLE_LOG + 1)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.onLineClick(i));
      this.lineTexts.push(lineText);
    }

    const actionsY = bodyY + bodyHeight;
    this.replayBar = this.scene.add.graphics();
    this.replayBar.setDepth(DEPTH_BATTLE_LOG);
    this.replayBar.fillStyle(0x000000, 0.3);
    this.replayBar.fillRect(this.x, actionsY, BATTLE_LOG_WIDTH, BATTLE_LOG_ACTIONS_HEIGHT);

    const buttonSpacing = BATTLE_LOG_WIDTH / (REPLAY_BUTTON_LABELS.length + 1);
    for (let i = 0; i < REPLAY_BUTTON_LABELS.length; i++) {
      const button = this.scene.add
        .text(
          this.x + buttonSpacing * (i + 1),
          actionsY + BATTLE_LOG_ACTIONS_HEIGHT / 2,
          REPLAY_BUTTON_LABELS[i],
          {
            fontSize: "14px",
            color: REPLAY_BUTTON_DISABLED_COLOR,
            fontFamily: "monospace",
          },
        )
        .setOrigin(0.5)
        .setDepth(DEPTH_BATTLE_LOG + 1);
      this.replayButtons.push(button);
    }

    this.setupScrollInput(bodyY, bodyHeight);
  }

  private createCollapsedView(): void {
    const collapsedX = this.x + BATTLE_LOG_WIDTH - COLLAPSED_SIZE;

    this.collapsedBg = this.scene.add.graphics();
    this.collapsedBg.setDepth(DEPTH_BATTLE_LOG);
    this.collapsedBg.fillStyle(BATTLE_LOG_BG_COLOR, BATTLE_LOG_BG_ALPHA);
    this.collapsedBg.fillRoundedRect(collapsedX, this.y, COLLAPSED_SIZE, COLLAPSED_SIZE, 4);

    this.collapsedIcon = this.scene.add
      .text(collapsedX + COLLAPSED_SIZE / 2, this.y + COLLAPSED_SIZE / 2, "☰", {
        fontSize: "16px",
        color: "#cccccc",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(DEPTH_BATTLE_LOG + 1);

    this.collapsedHitArea = this.scene.add
      .rectangle(
        collapsedX + COLLAPSED_SIZE / 2,
        this.y + COLLAPSED_SIZE / 2,
        COLLAPSED_SIZE,
        COLLAPSED_SIZE,
        0x000000,
        0,
      )
      .setDepth(DEPTH_BATTLE_LOG + 2)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.toggle());
  }

  private setCollapsed(collapsed: boolean): void {
    this.collapsed = collapsed;

    this.background.setVisible(!collapsed);
    this.headerTitle.setVisible(!collapsed);
    this.headerBurger.setVisible(!collapsed);
    this.headerHitArea.setActive(!collapsed).setVisible(!collapsed);
    for (const text of this.lineTexts) text.setVisible(!collapsed);
    for (const dot of this.teamDots) dot.setVisible(!collapsed);
    this.replayBar.setVisible(!collapsed);
    for (const button of this.replayButtons) button.setVisible(!collapsed);
    this.scrollZone.setActive(!collapsed).setVisible(!collapsed);

    this.collapsedBg.setVisible(collapsed);
    this.collapsedIcon.setVisible(collapsed);
    this.collapsedHitArea.setActive(collapsed).setVisible(collapsed);

    if (!collapsed) this.renderLines();
  }

  private drawExpandedBackground(totalHeight: number): void {
    this.background.clear();
    this.background.fillStyle(BATTLE_LOG_BG_COLOR, BATTLE_LOG_BG_ALPHA);
    this.background.fillRoundedRect(this.x, this.y, BATTLE_LOG_WIDTH, totalHeight, 4);
  }

  private setupScrollInput(bodyY: number, bodyHeight: number): void {
    this.scrollZone = this.scene.add
      .rectangle(
        this.x + BATTLE_LOG_WIDTH / 2,
        bodyY + bodyHeight / 2,
        BATTLE_LOG_WIDTH,
        bodyHeight,
        0x000000,
        0,
      )
      .setDepth(DEPTH_BATTLE_LOG + 2)
      .setInteractive();

    this.scene.input.on(
      "wheel",
      (pointer: Phaser.Input.Pointer, _gameObjects: unknown[], _dx: number, dy: number) => {
        if (this.collapsed) return;
        const bounds = this.scrollZone.getBounds();
        if (!bounds.contains(pointer.x, pointer.y)) return;

        const maxOffset = Math.max(0, this.entries.length - BATTLE_LOG_VISIBLE_LINES);
        if (dy > 0) {
          this.scrollOffset = Math.min(this.scrollOffset + 1, maxOffset);
        } else if (dy < 0) {
          this.scrollOffset = Math.max(this.scrollOffset - 1, 0);
        }
        this.renderLines();
      },
    );
  }

  private scrollToBottom(): void {
    this.scrollOffset = Math.max(0, this.entries.length - BATTLE_LOG_VISIBLE_LINES);
  }

  private renderLines(): void {
    if (this.collapsed) return;

    const bodyY = this.y + BATTLE_LOG_HEADER_HEIGHT;
    for (let i = 0; i < BATTLE_LOG_VISIBLE_LINES; i++) {
      const entryIndex = this.scrollOffset + i;
      const entry = this.entries[entryIndex];
      const lineText = this.lineTexts[i];
      const dot = this.teamDots[i];
      const lineY = bodyY + i * BATTLE_LOG_LINE_HEIGHT + 2;

      dot.clear();

      if (entry) {
        lineText.setText(entry.message);
        lineText.setColor(entry.color);
        lineText.setVisible(true);

        if (entry.pokemonIds.length > 0 && this.getTeamColor) {
          const teamColor = this.getTeamColor(entry.pokemonIds[0]);
          dot.fillStyle(teamColor, 1);
          dot.fillCircle(
            this.x + BATTLE_LOG_PADDING + TEAM_DOT_SIZE / 2,
            lineY + BATTLE_LOG_LINE_HEIGHT / 2 - 1,
            TEAM_DOT_SIZE / 2,
          );
          dot.setVisible(true);
        } else {
          dot.setVisible(false);
        }

        if (entry.pokemonIds.length > 0) {
          lineText.setInteractive({ useHandCursor: true });
        } else {
          lineText.removeInteractive();
        }
      } else {
        lineText.setText("");
        lineText.setVisible(true);
        dot.setVisible(false);
      }
    }
  }

  private onLineClick(lineIndex: number): void {
    const entryIndex = this.scrollOffset + lineIndex;
    const entry = this.entries[entryIndex];
    if (entry && entry.pokemonIds.length > 0 && this.onPokemonClick) {
      this.onPokemonClick(entry.pokemonIds[0]);
    }
  }
}
