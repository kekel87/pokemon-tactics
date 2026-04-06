import { type PokemonInstance, StatName, StatusType } from "@pokemon-tactic/core";
import { getPokemonName } from "@pokemon-tactic/data";
import {
  DEPTH_INFO_PANEL,
  getTeamColorByPlayerId,
  HP_BAR_BG_ALPHA,
  HP_BAR_BG_COLOR,
  HP_BAR_BORDER_COLOR,
  HP_BAR_HEIGHT,
  HP_COLOR_HIGH,
  HP_COLOR_LOW,
  HP_COLOR_MEDIUM,
  HP_THRESHOLD_HIGH,
  HP_THRESHOLD_LOW,
  INFO_PANEL_ALPHA,
  INFO_PANEL_CORNER_RADIUS,
  INFO_PANEL_HEIGHT,
  INFO_PANEL_WIDTH,
  INFO_PANEL_X,
  INFO_PANEL_Y,
  PORTRAIT_SIZE,
  STAT_BADGE_BUFF_BG,
  STAT_BADGE_CORNER_RADIUS,
  STAT_BADGE_DEBUFF_BG,
  STAT_BADGE_HEIGHT,
  STAT_BADGE_PADDING_X,
  STAT_BADGE_SPACING,
  STAT_BADGE_VOLATILE_BG,
  STATUS_ASSET_KEY,
  UI_BORDER_ALPHA,
  UI_BORDER_COLOR,
  UI_BORDER_WIDTH,
} from "../constants";
import { getLanguage, t } from "../i18n";
import { getPortraitKey } from "../sprites/SpriteLoader";

const PORTRAIT_MARGIN: number = 8;
const TEXT_OFFSET_X: number = PORTRAIT_MARGIN + PORTRAIT_SIZE + 8;
const HP_BAR_OFFSET_Y: number = 40;
const HP_BAR_MARGIN_RIGHT: number = 12;
const HP_BAR_PANEL_WIDTH: number = INFO_PANEL_WIDTH - TEXT_OFFSET_X - HP_BAR_MARGIN_RIGHT;
const STAT_CHANGES_OFFSET_Y: number = 68;
const VOLATILE_LABELS: Partial<Record<string, TranslationKey>> = {
  [StatusType.Confused]: "status.confused",
  [StatusType.Seeded]: "status.seeded",
  [StatusType.Trapped]: "status.trapped",
};

import type { TranslationKey } from "../i18n";

const STAT_TRANSLATION_KEYS: Record<string, TranslationKey> = {
  [StatName.Attack]: "stat.atk",
  [StatName.Defense]: "stat.def",
  [StatName.SpAttack]: "stat.spA",
  [StatName.SpDefense]: "stat.spD",
  [StatName.Speed]: "stat.spd",
  [StatName.Accuracy]: "stat.acc",
  [StatName.Evasion]: "stat.eva",
};

export class InfoPanel {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly hpBarBackground: Phaser.GameObjects.Graphics;
  private readonly hpBarFill: Phaser.GameObjects.Graphics;
  private readonly statBadgeContainer: Phaser.GameObjects.Container;
  private portrait: Phaser.GameObjects.Image | null = null;
  private currentPortraitKey: string = "";
  private statusLabel: Phaser.GameObjects.Image | null = null;
  private currentStatusKey: string = "";

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

    this.statBadgeContainer = scene.add.container(TEXT_OFFSET_X, STAT_CHANGES_OFFSET_Y);

    this.container = scene.add.container(INFO_PANEL_X, INFO_PANEL_Y, [
      this.background,
      this.nameText,
      this.hpBarBackground,
      this.hpBarFill,
      this.hpText,
      this.statBadgeContainer,
    ]);
    this.container.setDepth(DEPTH_INFO_PANEL);
    this.container.setVisible(false);
  }

  update(pokemon: PokemonInstance, playerId: string): void {
    this.container.setVisible(true);

    const teamColor = getTeamColorByPlayerId(playerId);
    this.drawBackground(teamColor);

    const name = getPokemonName(pokemon.definitionId, getLanguage());
    this.nameText.setText(`${name}  Lv.${pokemon.level}`);

    this.updatePortrait(pokemon.definitionId);

    const hpRatio = pokemon.currentHp / pokemon.maxHp;
    this.drawHpBar(hpRatio);

    this.hpText.setText(`${pokemon.currentHp} / ${pokemon.maxHp}`);

    this.updateStatusLabel(pokemon);
    this.updateBadges(pokemon);
  }

  private updateStatusLabel(pokemon: PokemonInstance): void {
    const statusType = pokemon.statusEffects[0]?.type;
    const assetKey = statusType ? STATUS_ASSET_KEY[statusType] : undefined;
    const newKey = assetKey ? `status-label-${assetKey}` : "";

    if (newKey === this.currentStatusKey) {
      return;
    }
    this.currentStatusKey = newKey;

    if (this.statusLabel) {
      this.statusLabel.destroy();
      this.statusLabel = null;
    }

    if (!newKey) {
      return;
    }

    const texture = this.scene.textures.get(newKey);
    if (texture.key === "__MISSING") {
      return;
    }

    const targetHeight = 14;
    this.statusLabel = this.scene.add.image(0, 0, newKey);
    const scale = targetHeight / this.statusLabel.height;
    this.statusLabel.setScale(scale);
    const scaledWidth = this.statusLabel.width * scale;
    this.statusLabel.setPosition(
      INFO_PANEL_WIDTH - HP_BAR_MARGIN_RIGHT - scaledWidth / 2,
      HP_BAR_OFFSET_Y + HP_BAR_HEIGHT + 4 + targetHeight / 2,
    );
    this.container.add(this.statusLabel);
  }

  private updateBadges(pokemon: PokemonInstance): void {
    this.statBadgeContainer.removeAll(true);

    let offsetX = 0;

    for (const [stat, translationKey] of Object.entries(STAT_TRANSLATION_KEYS)) {
      const stages = pokemon.statStages[stat as keyof typeof pokemon.statStages];
      if (stages === undefined || stages === 0) {
        continue;
      }

      const label = t(translationKey);
      const sign = stages > 0 ? "+" : "";
      const badgeText = `${label} ${sign}${stages}`;
      const bgColor = stages > 0 ? STAT_BADGE_BUFF_BG : STAT_BADGE_DEBUFF_BG;

      offsetX = this.addBadge(badgeText, bgColor, offsetX);
    }

    for (const volatile of pokemon.volatileStatuses) {
      const translationKey = VOLATILE_LABELS[volatile.type];
      if (!translationKey) {
        continue;
      }
      offsetX = this.addBadge(t(translationKey), STAT_BADGE_VOLATILE_BG, offsetX);
    }
  }

  private addBadge(label: string, bgColor: number, offsetX: number): number {
    const text = this.scene.add.text(0, 0, label, {
      fontSize: "9px",
      color: "#ffffff",
      fontFamily: "monospace",
      fontStyle: "bold",
    });

    const badgeWidth = text.width + STAT_BADGE_PADDING_X * 2;
    const bg = this.scene.add.graphics();
    bg.fillStyle(bgColor, 0.9);
    bg.fillRoundedRect(offsetX, 0, badgeWidth, STAT_BADGE_HEIGHT, STAT_BADGE_CORNER_RADIUS);

    text.setPosition(offsetX + STAT_BADGE_PADDING_X, (STAT_BADGE_HEIGHT - text.height) / 2);

    this.statBadgeContainer.add(bg);
    this.statBadgeContainer.add(text);

    return offsetX + badgeWidth + STAT_BADGE_SPACING;
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

  private getHpColor(ratio: number): number {
    if (ratio > HP_THRESHOLD_HIGH) {
      return HP_COLOR_HIGH;
    }
    if (ratio > HP_THRESHOLD_LOW) {
      return HP_COLOR_MEDIUM;
    }
    return HP_COLOR_LOW;
  }

  private drawHpBar(hpRatio: number): void {
    const radius = 2;

    this.hpBarBackground.clear();
    this.hpBarBackground.fillStyle(HP_BAR_BG_COLOR, HP_BAR_BG_ALPHA);
    this.hpBarBackground.fillRoundedRect(
      TEXT_OFFSET_X,
      HP_BAR_OFFSET_Y,
      HP_BAR_PANEL_WIDTH,
      HP_BAR_HEIGHT,
      radius,
    );
    this.hpBarBackground.lineStyle(1, HP_BAR_BORDER_COLOR, 1);
    this.hpBarBackground.strokeRoundedRect(
      TEXT_OFFSET_X,
      HP_BAR_OFFSET_Y,
      HP_BAR_PANEL_WIDTH,
      HP_BAR_HEIGHT,
      radius,
    );

    this.hpBarFill.clear();
    const fillWidth = (HP_BAR_PANEL_WIDTH - 2) * hpRatio;
    if (fillWidth > 0) {
      const hpColor = this.getHpColor(hpRatio);
      this.hpBarFill.fillStyle(hpColor, 1);
      this.hpBarFill.fillRoundedRect(
        TEXT_OFFSET_X + 1,
        HP_BAR_OFFSET_Y + 1,
        fillWidth,
        HP_BAR_HEIGHT - 2,
        radius,
      );
    }
  }
}
