import Phaser from "phaser";
import {
  BACKGROUND_COLOR,
  BUTTON_BORDER_COLOR,
  BUTTON_COLOR,
  BUTTON_HOVER_COLOR,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  FONT_FAMILY,
  MAP_SELECT_DETAILS_BG_ALPHA,
  MAP_SELECT_DETAILS_BG_COLOR,
  MAP_SELECT_LEFT_PANEL_BG_COLOR,
  MAP_SELECT_LIST_ITEM_COLOR,
  MAP_SELECT_LIST_ITEM_HOVER_COLOR,
  MAP_SELECT_LIST_ITEM_SELECTED_COLOR,
  TEXT_COLOR_MUTED,
  TEXT_COLOR_PRIMARY,
  TEXT_COLOR_SECONDARY,
  TEXT_COLOR_TITLE,
} from "../constants";
import { getLanguage, t } from "../i18n";
import { type MapEntry, MAPS_REGISTRY } from "../maps/maps-registry";
import type { MapSelectPreviewScene } from "./MapSelectPreviewScene";

const LEFT_PANEL_WIDTH = 340;
const LEFT_PANEL_PADDING = 16;
const TITLE_Y = 28;
const LIST_TOP_Y = 88;
const LIST_ITEM_HEIGHT = 38;
const LIST_ITEM_GAP = 4;

const FOOTER_HEIGHT = 64;
const FOOTER_Y: number = CANVAS_HEIGHT - FOOTER_HEIGHT;
const BUTTON_WIDTH = 200;
const BUTTON_HEIGHT = 36;

const DETAILS_PANEL_X: number = LEFT_PANEL_WIDTH + 24;
const DETAILS_PANEL_Y = CANVAS_HEIGHT - FOOTER_HEIGHT - 132;
const DETAILS_PANEL_WIDTH: number = CANVAS_WIDTH - DETAILS_PANEL_X - 24;
const DETAILS_PANEL_HEIGHT = 116;


interface ListItemVisual {
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  entry: MapEntry;
}

export class MapSelectScene extends Phaser.Scene {
  private selectedIndex = 0;
  private listItems: ListItemVisual[] = [];
  private detailsName: Phaser.GameObjects.Text | null = null;
  private detailsMeta: Phaser.GameObjects.Text | null = null;
  private detailsDescription: Phaser.GameObjects.Text | null = null;
  private previewScene: MapSelectPreviewScene | null = null;

  constructor() {
    super("MapSelectScene");
  }

  init(data: { mapUrl?: string }): void {
    if (data.mapUrl) {
      const index = MAPS_REGISTRY.findIndex((entry) => entry.url === data.mapUrl);
      if (index >= 0) {
        this.selectedIndex = index;
      }
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BACKGROUND_COLOR);

    this.add
      .rectangle(0, 0, LEFT_PANEL_WIDTH, CANVAS_HEIGHT, MAP_SELECT_LEFT_PANEL_BG_COLOR)
      .setOrigin(0, 0);

    this.add
      .text(LEFT_PANEL_WIDTH / 2, TITLE_Y, t("mapSelect.title"), {
        fontSize: "28px",
        fontFamily: FONT_FAMILY,
        color: TEXT_COLOR_TITLE,
      })
      .setOrigin(0.5, 0);

    this.buildList();
    this.buildDetailsPanel();
    this.buildFooter();

    this.scene.launch("MapSelectPreviewScene");
    const preview = this.scene.get("MapSelectPreviewScene") as MapSelectPreviewScene;
    this.previewScene = preview;

    preview.setLayout({
      x: LEFT_PANEL_WIDTH,
      y: 0,
      width: CANVAS_WIDTH - LEFT_PANEL_WIDTH,
      height: CANVAS_HEIGHT - FOOTER_HEIGHT - DETAILS_PANEL_HEIGHT - 24,
    });

    preview.events.once("previewReady", () => {
      this.loadSelectedMap();
    });
    if (preview.scene.isActive()) {
      this.loadSelectedMap();
    }

    this.refreshSelection();

    this.input.keyboard?.on("keydown-UP", () => this.moveSelection(-1));
    this.input.keyboard?.on("keydown-DOWN", () => this.moveSelection(1));
    this.input.keyboard?.on("keydown-ENTER", () => this.confirmSelection());
    this.input.keyboard?.on("keydown-ESC", () => this.goBack());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.stop("MapSelectPreviewScene");
    });
  }

  private buildList(): void {
    for (let i = 0; i < MAPS_REGISTRY.length; i++) {
      const entry = MAPS_REGISTRY[i];
      if (!entry) {
        continue;
      }
      const y = LIST_TOP_Y + i * (LIST_ITEM_HEIGHT + LIST_ITEM_GAP);
      const bg = this.add
        .rectangle(
          LEFT_PANEL_PADDING,
          y,
          LEFT_PANEL_WIDTH - 2 * LEFT_PANEL_PADDING,
          LIST_ITEM_HEIGHT,
          MAP_SELECT_LIST_ITEM_COLOR,
        )
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });

      const label = this.add
        .text(
          LEFT_PANEL_PADDING + 12,
          y + LIST_ITEM_HEIGHT / 2,
          entry.displayName[getLanguage()],
          {
            fontSize: "18px",
            fontFamily: FONT_FAMILY,
            color: TEXT_COLOR_PRIMARY,
          },
        )
        .setOrigin(0, 0.5);

      const indexCopy = i;
      bg.on("pointerover", () => {
        if (indexCopy !== this.selectedIndex) {
          bg.setFillStyle(MAP_SELECT_LIST_ITEM_HOVER_COLOR);
        }
      });
      bg.on("pointerout", () => {
        if (indexCopy !== this.selectedIndex) {
          bg.setFillStyle(MAP_SELECT_LIST_ITEM_COLOR);
        }
      });
      bg.on("pointerdown", () => {
        this.selectedIndex = indexCopy;
        this.refreshSelection();
        this.loadSelectedMap();
      });

      this.listItems.push({ bg, label, entry });
    }
  }

  private buildDetailsPanel(): void {
    this.add
      .rectangle(
        DETAILS_PANEL_X,
        DETAILS_PANEL_Y,
        DETAILS_PANEL_WIDTH,
        DETAILS_PANEL_HEIGHT,
        MAP_SELECT_DETAILS_BG_COLOR,
      )
      .setOrigin(0, 0)
      .setAlpha(MAP_SELECT_DETAILS_BG_ALPHA);

    this.detailsName = this.add
      .text(DETAILS_PANEL_X + 16, DETAILS_PANEL_Y + 12, "", {
        fontSize: "22px",
        fontFamily: FONT_FAMILY,
        color: TEXT_COLOR_TITLE,
      })
      .setOrigin(0, 0);

    this.detailsMeta = this.add
      .text(DETAILS_PANEL_X + 16, DETAILS_PANEL_Y + 44, "", {
        fontSize: "14px",
        fontFamily: FONT_FAMILY,
        color: TEXT_COLOR_MUTED,
      })
      .setOrigin(0, 0);

    this.detailsDescription = this.add
      .text(DETAILS_PANEL_X + 16, DETAILS_PANEL_Y + 68, "", {
        fontSize: "16px",
        fontFamily: FONT_FAMILY,
        color: TEXT_COLOR_SECONDARY,
        wordWrap: { width: DETAILS_PANEL_WIDTH - 32 },
      })
      .setOrigin(0, 0);
  }

  private buildFooter(): void {
    const backX = LEFT_PANEL_WIDTH / 2;
    const backY = FOOTER_Y + FOOTER_HEIGHT / 2;
    const confirmX = (LEFT_PANEL_WIDTH + CANVAS_WIDTH) / 2;

    this.buildFooterButton(backX, backY, t("mapSelect.back"), () => this.goBack());
    this.buildFooterButton(confirmX, backY, t("mapSelect.confirm"), () => this.confirmSelection());
  }

  private buildFooterButton(x: number, y: number, label: string, onClick: () => void): void {
    const bg = this.add
      .rectangle(x, y, BUTTON_WIDTH, BUTTON_HEIGHT, BUTTON_COLOR)
      .setStrokeStyle(2, BUTTON_BORDER_COLOR)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(x, y, label, {
        fontSize: "20px",
        fontFamily: FONT_FAMILY,
        color: TEXT_COLOR_PRIMARY,
      })
      .setOrigin(0.5, 0.5);

    bg.on("pointerover", () => bg.setFillStyle(BUTTON_HOVER_COLOR));
    bg.on("pointerout", () => bg.setFillStyle(BUTTON_COLOR));
    bg.on("pointerdown", onClick);
  }

  private moveSelection(delta: number): void {
    const next = (this.selectedIndex + delta + MAPS_REGISTRY.length) % MAPS_REGISTRY.length;
    if (next === this.selectedIndex) {
      return;
    }
    this.selectedIndex = next;
    this.refreshSelection();
    this.loadSelectedMap();
  }

  private refreshSelection(): void {
    for (let i = 0; i < this.listItems.length; i++) {
      const item = this.listItems[i];
      if (!item) {
        continue;
      }
      const isSelected = i === this.selectedIndex;
      item.bg.setFillStyle(
        isSelected ? MAP_SELECT_LIST_ITEM_SELECTED_COLOR : MAP_SELECT_LIST_ITEM_COLOR,
      );
    }

    const entry = MAPS_REGISTRY[this.selectedIndex];
    if (!entry) {
      return;
    }
    const lang = getLanguage();
    this.detailsName?.setText(entry.displayName[lang]);
    const tagsText = entry.tags.length > 0 ? `  ·  ${entry.tags.join(", ")}` : "";
    this.detailsMeta?.setText(`${entry.size}${tagsText}`);
    this.detailsDescription?.setText(entry.description[lang]);
  }

  private loadSelectedMap(): void {
    const entry = MAPS_REGISTRY[this.selectedIndex];
    if (!entry || !this.previewScene) {
      return;
    }
    void this.previewScene.loadMap(entry.url);
  }

  private confirmSelection(): void {
    const entry = MAPS_REGISTRY[this.selectedIndex];
    if (!entry) {
      return;
    }
    this.scene.start("TeamSelectScene", { mapUrl: entry.url });
  }

  private goBack(): void {
    this.scene.start("BattleModeScene");
  }
}
