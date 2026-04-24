import type { MoveDefinition } from "@pokemon-tactic/core";
import { TurnSystemKind } from "@pokemon-tactic/core";
import { getMoveName } from "@pokemon-tactic/data";
import {
  ACTION_MENU_BG_ALPHA,
  ACTION_MENU_BG_COLOR,
  ACTION_MENU_BOTTOM_Y,
  ACTION_MENU_CORNER_RADIUS,
  ACTION_MENU_DISABLED_ALPHA,
  ACTION_MENU_HOVER_ALPHA,
  ACTION_MENU_HOVER_COLOR,
  ACTION_MENU_ITEM_HEIGHT,
  ACTION_MENU_WIDTH,
  ACTION_MENU_X,
  DEPTH_ACTION_MENU,
  FONT_FAMILY,
  UI_BORDER_ALPHA,
  UI_BORDER_COLOR,
  UI_BORDER_WIDTH,
} from "../constants";
import { getLanguage, t } from "../i18n";
import type { MoveTooltip } from "./MoveTooltip";

interface ActionMenuCallbacks {
  onMove: () => void;
  onUndoMove: () => void;
  onAttack: () => void;
  onWait: () => void;
}

interface ActionMenuOptions {
  canMove: boolean;
  canUndoMove: boolean;
  canAct: boolean;
  callbacks: ActionMenuCallbacks;
}

interface AttackSubmenuOptions {
  moves: Array<{ definition: MoveDefinition; currentPp: number; hasTargets: boolean }>;
  onSelect: (moveId: string) => void;
  onCancel: () => void;
  turnSystemKind: TurnSystemKind;
}

export class ActionMenu {
  private readonly scene: Phaser.Scene;
  private objects: Phaser.GameObjects.GameObject[] = [];
  private tooltip: MoveTooltip | null = null;
  private instructionText: Phaser.GameObjects.Text | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  setTooltip(tooltip: MoveTooltip): void {
    this.tooltip = tooltip;
  }

  show(options: ActionMenuOptions): void {
    this.clearItems();

    const moveEntry = options.canUndoMove
      ? { label: t("action.undoMove"), enabled: true, callback: options.callbacks.onUndoMove }
      : { label: t("action.move"), enabled: options.canMove, callback: options.callbacks.onMove };

    const entries = [
      moveEntry,
      { label: t("action.attack"), enabled: options.canAct, callback: options.callbacks.onAttack },
      {
        label: t("action.item"),
        enabled: false,
        callback: () => undefined,
      },
      { label: t("action.wait"), enabled: true, callback: options.callbacks.onWait },
      {
        label: t("action.status"),
        enabled: false,
        callback: () => undefined,
      },
    ];

    this.buildMenu(entries);
  }

  showAttackSubmenu(options: AttackSubmenuOptions): void {
    this.clearItems();

    const totalEntries = options.moves.length + 1;
    const totalHeight = totalEntries * ACTION_MENU_ITEM_HEIGHT;
    const menuTopY = ACTION_MENU_BOTTOM_Y - totalHeight;

    const background = this.scene.add.graphics();
    background.fillStyle(ACTION_MENU_BG_COLOR, ACTION_MENU_BG_ALPHA);
    background.fillRoundedRect(
      ACTION_MENU_X,
      menuTopY,
      ACTION_MENU_WIDTH,
      totalHeight,
      ACTION_MENU_CORNER_RADIUS,
    );
    background.lineStyle(UI_BORDER_WIDTH, UI_BORDER_COLOR, UI_BORDER_ALPHA);
    background.strokeRoundedRect(
      ACTION_MENU_X,
      menuTopY,
      ACTION_MENU_WIDTH,
      totalHeight,
      ACTION_MENU_CORNER_RADIUS,
    );
    background.setDepth(DEPTH_ACTION_MENU);
    this.objects.push(background);

    for (let i = 0; i < options.moves.length; i++) {
      const move = options.moves[i];
      if (!move) {
        continue;
      }
      const itemY = menuTopY + i * ACTION_MENU_ITEM_HEIGHT;
      this.createMoveItem(move, itemY, options.onSelect, options.turnSystemKind);
    }

    const cancelY = menuTopY + options.moves.length * ACTION_MENU_ITEM_HEIGHT;
    this.createMenuItem(
      { label: t("action.cancel"), enabled: true, callback: options.onCancel },
      cancelY,
    );
  }

  showSelectedMove(
    move: { definition: MoveDefinition; currentPp: number },
    instruction: string,
    turnSystemKind: TurnSystemKind,
  ): void {
    this.clearItems();

    const headerHeight = ACTION_MENU_ITEM_HEIGHT;
    const moveHeight = ACTION_MENU_ITEM_HEIGHT;
    const totalHeight = headerHeight + moveHeight;
    const menuTopY = ACTION_MENU_BOTTOM_Y - totalHeight;

    const background = this.scene.add.graphics();
    background.fillStyle(ACTION_MENU_BG_COLOR, ACTION_MENU_BG_ALPHA);
    background.fillRoundedRect(
      ACTION_MENU_X,
      menuTopY,
      ACTION_MENU_WIDTH,
      totalHeight,
      ACTION_MENU_CORNER_RADIUS,
    );
    background.lineStyle(UI_BORDER_WIDTH, UI_BORDER_COLOR, UI_BORDER_ALPHA);
    background.strokeRoundedRect(
      ACTION_MENU_X,
      menuTopY,
      ACTION_MENU_WIDTH,
      totalHeight,
      ACTION_MENU_CORNER_RADIUS,
    );
    background.setDepth(DEPTH_ACTION_MENU);
    this.objects.push(background);

    this.instructionText = this.scene.add
      .text(ACTION_MENU_X + ACTION_MENU_WIDTH / 2, menuTopY + headerHeight / 2, instruction, {
        fontSize: "18px",
        color: "#ffdd44",
        fontFamily: FONT_FAMILY,
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH_ACTION_MENU + 2);
    this.objects.push(this.instructionText);

    const moveY = menuTopY + headerHeight;
    const centerY = moveY + moveHeight / 2;

    const typeIcon = this.scene.add
      .image(ACTION_MENU_X + 8, centerY, `type-${move.definition.type}`)
      .setOrigin(0, 0.5)
      .setDisplaySize(20, 20)
      .setDepth(DEPTH_ACTION_MENU + 2);
    this.objects.push(typeIcon);

    const nameText = this.scene.add
      .text(ACTION_MENU_X + 34, centerY, getMoveName(move.definition.id, getLanguage()), {
        fontSize: "20px",
        color: "#ffffff",
        fontFamily: FONT_FAMILY,
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH_ACTION_MENU + 2);
    this.objects.push(nameText);

    if (turnSystemKind !== TurnSystemKind.ChargeTime) {
      const ppText = this.scene.add
        .text(
          ACTION_MENU_X + ACTION_MENU_WIDTH - 8,
          centerY,
          `${move.currentPp}/${move.definition.pp}`,
          {
            fontSize: "18px",
            color: "#aaaaaa",
            fontFamily: FONT_FAMILY,
          },
        )
        .setOrigin(1, 0.5)
        .setDepth(DEPTH_ACTION_MENU + 2);
      this.objects.push(ppText);
    }
  }

  updateInstruction(instruction: string): void {
    if (this.instructionText) {
      this.instructionText.setText(instruction);
    }
  }

  hide(): void {
    this.clearItems();
  }

  destroy(): void {
    this.clearItems();
  }

  private buildMenu(
    entries: Array<{ label: string; enabled: boolean; callback: () => void; color?: number }>,
  ): void {
    const totalHeight = entries.length * ACTION_MENU_ITEM_HEIGHT;
    const menuTopY = ACTION_MENU_BOTTOM_Y - totalHeight;

    const background = this.scene.add.graphics();
    background.fillStyle(ACTION_MENU_BG_COLOR, ACTION_MENU_BG_ALPHA);
    background.fillRoundedRect(
      ACTION_MENU_X,
      menuTopY,
      ACTION_MENU_WIDTH,
      totalHeight,
      ACTION_MENU_CORNER_RADIUS,
    );
    background.lineStyle(UI_BORDER_WIDTH, UI_BORDER_COLOR, UI_BORDER_ALPHA);
    background.strokeRoundedRect(
      ACTION_MENU_X,
      menuTopY,
      ACTION_MENU_WIDTH,
      totalHeight,
      ACTION_MENU_CORNER_RADIUS,
    );
    background.setDepth(DEPTH_ACTION_MENU);
    this.objects.push(background);

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry) {
        continue;
      }

      const itemY = menuTopY + i * ACTION_MENU_ITEM_HEIGHT;
      this.createMenuItem(entry, itemY);
    }
  }

  private createMenuItem(
    entry: { label: string; enabled: boolean; callback: () => void; color?: number },
    y: number,
  ): void {
    const alpha = entry.enabled ? 1 : ACTION_MENU_DISABLED_ALPHA;
    const textColor = entry.color ? `#${entry.color.toString(16).padStart(6, "0")}` : "#ffffff";

    const text = this.scene.add
      .text(ACTION_MENU_X + 12, y + ACTION_MENU_ITEM_HEIGHT / 2, entry.label, {
        fontSize: "20px",
        color: textColor,
        fontFamily: FONT_FAMILY,
      })
      .setOrigin(0, 0.5)
      .setAlpha(alpha)
      .setDepth(DEPTH_ACTION_MENU + 2);
    this.objects.push(text);

    const hoverBg = this.scene.add.graphics();
    hoverBg.setDepth(DEPTH_ACTION_MENU + 1);
    hoverBg.setVisible(false);
    this.objects.push(hoverBg);

    const zone = this.scene.add.zone(
      ACTION_MENU_X + ACTION_MENU_WIDTH / 2,
      y + ACTION_MENU_ITEM_HEIGHT / 2,
      ACTION_MENU_WIDTH,
      ACTION_MENU_ITEM_HEIGHT,
    );
    zone.setDepth(DEPTH_ACTION_MENU + 3);
    zone.setInteractive({ useHandCursor: entry.enabled });
    this.objects.push(zone);

    if (entry.enabled) {
      zone.on("pointerover", () => {
        hoverBg.clear();
        hoverBg.fillStyle(ACTION_MENU_HOVER_COLOR, ACTION_MENU_HOVER_ALPHA);
        hoverBg.fillRect(ACTION_MENU_X, y, ACTION_MENU_WIDTH, ACTION_MENU_ITEM_HEIGHT);
        hoverBg.setVisible(true);
      });

      zone.on("pointerout", () => {
        hoverBg.setVisible(false);
      });

      zone.on("pointerdown", () => {
        entry.callback();
      });
    }
  }

  private createMoveItem(
    move: { definition: MoveDefinition; currentPp: number; hasTargets: boolean },
    y: number,
    onSelect: (moveId: string) => void,
    turnSystemKind: TurnSystemKind,
  ): void {
    const enabled = move.currentPp > 0 && move.hasTargets;
    const alpha = enabled ? 1 : ACTION_MENU_DISABLED_ALPHA;
    const centerY = y + ACTION_MENU_ITEM_HEIGHT / 2;

    const typeIcon = this.scene.add
      .image(ACTION_MENU_X + 8, centerY, `type-${move.definition.type}`)
      .setOrigin(0, 0.5)
      .setDisplaySize(20, 20)
      .setAlpha(alpha)
      .setDepth(DEPTH_ACTION_MENU + 2);
    this.objects.push(typeIcon);

    const iconWidth = 20;
    const nameX = ACTION_MENU_X + 8 + iconWidth + 6;
    const ppWidth = 45;
    const maxNameWidth = ACTION_MENU_WIDTH - 8 - iconWidth - 6 - ppWidth - 8;

    const nameText = this.scene.add
      .text(nameX, centerY, getMoveName(move.definition.id, getLanguage()), {
        fontSize: "20px",
        color: "#ffffff",
        fontFamily: FONT_FAMILY,
        maxLines: 1,
      })
      .setOrigin(0, 0.5)
      .setAlpha(alpha)
      .setDepth(DEPTH_ACTION_MENU + 2);

    if (nameText.width > maxNameWidth) {
      nameText.setCrop(0, 0, maxNameWidth, nameText.height);
    }

    this.objects.push(nameText);

    if (turnSystemKind !== TurnSystemKind.ChargeTime) {
      const ppText = this.scene.add
        .text(
          ACTION_MENU_X + ACTION_MENU_WIDTH - 8,
          centerY,
          `${move.currentPp}/${move.definition.pp}`,
          {
            fontSize: "18px",
            color: "#aaaaaa",
            fontFamily: FONT_FAMILY,
          },
        )
        .setOrigin(1, 0.5)
        .setAlpha(alpha)
        .setDepth(DEPTH_ACTION_MENU + 2);
      this.objects.push(ppText);
    }

    const hoverBg = this.scene.add.graphics();
    hoverBg.setDepth(DEPTH_ACTION_MENU + 1);
    hoverBg.setVisible(false);
    this.objects.push(hoverBg);

    const zone = this.scene.add.zone(
      ACTION_MENU_X + ACTION_MENU_WIDTH / 2,
      centerY,
      ACTION_MENU_WIDTH,
      ACTION_MENU_ITEM_HEIGHT,
    );
    zone.setDepth(DEPTH_ACTION_MENU + 3);
    zone.setInteractive({ useHandCursor: enabled });
    this.objects.push(zone);

    if (enabled) {
      zone.on("pointerover", () => {
        hoverBg.clear();
        hoverBg.fillStyle(ACTION_MENU_HOVER_COLOR, ACTION_MENU_HOVER_ALPHA);
        hoverBg.fillRect(ACTION_MENU_X, y, ACTION_MENU_WIDTH, ACTION_MENU_ITEM_HEIGHT);
        hoverBg.setVisible(true);
        this.tooltip?.show(move.definition, ACTION_MENU_X, y);
      });

      zone.on("pointerout", () => {
        hoverBg.setVisible(false);
        this.tooltip?.hide();
      });

      zone.on("pointerdown", () => {
        this.tooltip?.hide();
        onSelect(move.definition.id);
      });
    }
  }

  private clearItems(): void {
    this.tooltip?.hide();
    for (const obj of this.objects) {
      obj.destroy();
    }
    this.objects = [];
    this.instructionText = null;
  }
}
