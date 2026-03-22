import type { MoveDefinition } from "@pokemon-tactic/core";
import {
  ACTION_MENU_BG_ALPHA,
  ACTION_MENU_BG_COLOR,
  ACTION_MENU_CORNER_RADIUS,
  ACTION_MENU_DISABLED_ALPHA,
  ACTION_MENU_HOVER_ALPHA,
  ACTION_MENU_HOVER_COLOR,
  ACTION_MENU_ITEM_HEIGHT,
  ACTION_MENU_WIDTH,
  ACTION_MENU_X,
  ACTION_MENU_Y,
  DEPTH_ACTION_MENU,
  TYPE_COLORS,
  UI_BORDER_ALPHA,
  UI_BORDER_COLOR,
  UI_BORDER_WIDTH,
} from "../constants";

interface ActionMenuCallbacks {
  onMove: () => void;
  onAttack: () => void;
  onWait: () => void;
}

interface ActionMenuOptions {
  canMove: boolean;
  canAct: boolean;
  callbacks: ActionMenuCallbacks;
}

interface AttackSubmenuOptions {
  moves: Array<{ definition: MoveDefinition; currentPp: number; hasTargets: boolean }>;
  onSelect: (moveId: string) => void;
  onCancel: () => void;
}

export class ActionMenu {
  private readonly scene: Phaser.Scene;
  private objects: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(options: ActionMenuOptions): void {
    this.clearItems();

    const entries = [
      { label: "Deplacement", enabled: options.canMove, callback: options.callbacks.onMove },
      { label: "Attaque", enabled: options.canAct, callback: options.callbacks.onAttack },
      { label: "Objet", enabled: false, callback: (): void => {} },
      { label: "Attendre", enabled: true, callback: options.callbacks.onWait },
      { label: "Status", enabled: false, callback: (): void => {} },
    ];

    this.buildMenu(entries);
  }

  showAttackSubmenu(options: AttackSubmenuOptions): void {
    this.clearItems();

    const entries: Array<{
      label: string;
      enabled: boolean;
      callback: () => void;
      color?: number;
    }> = options.moves.map((move) => ({
      label: `${move.definition.name}  ${move.currentPp}/${move.definition.pp}`,
      enabled: move.currentPp > 0 && move.hasTargets,
      callback: () => options.onSelect(move.definition.id),
      color: TYPE_COLORS[move.definition.type] ?? 0x888888,
    }));

    entries.push({
      label: "Annuler",
      enabled: true,
      callback: options.onCancel,
    });

    this.buildMenu(entries);
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

    const background = this.scene.add.graphics();
    background.fillStyle(ACTION_MENU_BG_COLOR, ACTION_MENU_BG_ALPHA);
    background.fillRoundedRect(
      ACTION_MENU_X,
      ACTION_MENU_Y,
      ACTION_MENU_WIDTH,
      totalHeight,
      ACTION_MENU_CORNER_RADIUS,
    );
    background.lineStyle(UI_BORDER_WIDTH, UI_BORDER_COLOR, UI_BORDER_ALPHA);
    background.strokeRoundedRect(
      ACTION_MENU_X,
      ACTION_MENU_Y,
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

      const itemY = ACTION_MENU_Y + i * ACTION_MENU_ITEM_HEIGHT;
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
        fontSize: "13px",
        color: textColor,
        fontFamily: "monospace",
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

  private clearItems(): void {
    for (const obj of this.objects) {
      obj.destroy();
    }
    this.objects = [];
  }
}
