import type { MoveDefinition } from "@pokemon-tactic/core";
import { Category, TargetingKind } from "@pokemon-tactic/core";
import {
  ACTION_MENU_BOTTOM_Y,
  ACTION_MENU_CORNER_RADIUS,
  DEPTH_TOOLTIP,
  TOOLTIP_BG_ALPHA,
  TOOLTIP_BG_COLOR,
  TOOLTIP_CELL_GAP,
  TOOLTIP_CELL_SIZE,
  TOOLTIP_WIDTH,
  UI_BORDER_ALPHA,
  UI_BORDER_COLOR,
  UI_BORDER_WIDTH,
} from "../constants";
import { buildPatternPreview, PatternCell } from "./pattern-preview";

const CELL_COLORS: Record<PatternCell, number> = {
  [PatternCell.Target]: 0xff6644,
  [PatternCell.Dash]: 0xffdd44,
  [PatternCell.Caster]: 0xffdd44,
  [PatternCell.Empty]: 0x333333,
};

const CATEGORY_TEXTURE: Record<Category, string> = {
  [Category.Physical]: "category-physical",
  [Category.Special]: "category-special",
  [Category.Status]: "category-status",
};

const PATTERN_NAMES: Record<string, string> = {
  [TargetingKind.Single]: "Cible",
  [TargetingKind.Self]: "Soi",
  [TargetingKind.Line]: "Ligne",
  [TargetingKind.Cone]: "Cône",
  [TargetingKind.Slash]: "Slash",
  [TargetingKind.Cross]: "Croix",
  [TargetingKind.Zone]: "Zone",
  [TargetingKind.Dash]: "Dash",
  [TargetingKind.Blast]: "Bombe",
};

export class MoveTooltip {
  private readonly scene: Phaser.Scene;
  private objects: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(move: MoveDefinition, menuX: number, menuItemY: number): void {
    this.hide();

    const preview = buildPatternPreview(move.targeting);
    const cellStep = TOOLTIP_CELL_SIZE + TOOLTIP_CELL_GAP;
    const gridHeight = preview.length * cellStep;
    const gridWidth = (preview[0]?.length ?? 0) * cellStep;

    const padding = 10;
    const lineHeight = 16;
    const textLines = 3;
    const totalHeight = padding + textLines * lineHeight + 4 + gridHeight + padding;

    const x = menuX - TOOLTIP_WIDTH - 8;
    const y = Math.min(menuItemY, ACTION_MENU_BOTTOM_Y - totalHeight);

    const background = this.scene.add.graphics();
    background.fillStyle(TOOLTIP_BG_COLOR, TOOLTIP_BG_ALPHA);
    background.fillRoundedRect(x, y, TOOLTIP_WIDTH, totalHeight, ACTION_MENU_CORNER_RADIUS);
    background.lineStyle(UI_BORDER_WIDTH, UI_BORDER_COLOR, UI_BORDER_ALPHA);
    background.strokeRoundedRect(x, y, TOOLTIP_WIDTH, totalHeight, ACTION_MENU_CORNER_RADIUS);
    background.setDepth(DEPTH_TOOLTIP);
    this.objects.push(background);

    const contentX = x + padding;
    let contentY = y + padding;

    const categoryIcon = this.scene.add
      .image(contentX, contentY + 6, CATEGORY_TEXTURE[move.category])
      .setOrigin(0, 0.5)
      .setDisplaySize(20, 16)
      .setDepth(DEPTH_TOOLTIP + 1);
    this.objects.push(categoryIcon);
    contentY += lineHeight;

    const powerLabel = move.power > 0 ? `${move.power}` : "—";
    const accuracyLabel = move.accuracy > 0 ? `${move.accuracy}` : "—";
    this.addText(contentX, contentY, `Puis: ${powerLabel}  Préc: ${accuracyLabel}`);
    contentY += lineHeight;

    const patternName = PATTERN_NAMES[move.targeting.kind] ?? move.targeting.kind;
    const rangeLabel = this.getRangeLabel(move);
    const thirdLine = rangeLabel ? `${patternName}  Portée: ${rangeLabel}` : patternName;
    this.addText(contentX, contentY, thirdLine);
    contentY += lineHeight + 4;

    const gridX = contentX + Math.floor((TOOLTIP_WIDTH - 2 * padding - gridWidth) / 2);
    this.drawPatternGrid(preview, gridX, contentY);
  }

  hide(): void {
    for (const obj of this.objects) {
      obj.destroy();
    }
    this.objects = [];
  }

  private getRangeLabel(move: MoveDefinition): string | null {
    const targeting = move.targeting;
    switch (targeting.kind) {
      case TargetingKind.Single:
        return targeting.range.max > 1 ? `${targeting.range.min}-${targeting.range.max}` : null;
      case TargetingKind.Blast:
        return `${targeting.range.min}-${targeting.range.max}`;
      case TargetingKind.Self:
      case TargetingKind.Line:
      case TargetingKind.Cone:
      case TargetingKind.Dash:
      case TargetingKind.Slash:
      case TargetingKind.Cross:
      case TargetingKind.Zone:
        return null;
    }
  }

  private addText(x: number, y: number, content: string): void {
    const text = this.scene.add
      .text(x, y, content, {
        fontSize: "11px",
        color: "#cccccc",
        fontFamily: "monospace",
      })
      .setDepth(DEPTH_TOOLTIP + 1);
    this.objects.push(text);
  }

  private drawPatternGrid(preview: PatternCell[][], gridX: number, gridY: number): void {
    const cellStep = TOOLTIP_CELL_SIZE + TOOLTIP_CELL_GAP;
    const graphics = this.scene.add.graphics();
    graphics.setDepth(DEPTH_TOOLTIP + 1);

    for (let row = 0; row < preview.length; row++) {
      const rowData = preview[row]!;
      for (let col = 0; col < rowData.length; col++) {
        const cell = rowData[col]!;
        const cellX = gridX + col * cellStep;
        const cellY = gridY + row * cellStep;

        graphics.fillStyle(CELL_COLORS[cell], 1);
        graphics.fillRect(cellX, cellY, TOOLTIP_CELL_SIZE, TOOLTIP_CELL_SIZE);
      }
    }

    this.objects.push(graphics);
  }
}
