import type { MapDefinition } from "@pokemon-tactic/core";
import Phaser from "phaser";
import {
  ARROW_PAN_SPEED,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  getTeamColorByPlayerId,
  TILE_HEIGHT,
  TILE_WIDTH,
  TILESET_KEY,
  ZOOM_DEFAULT_INDEX,
  ZOOM_LEVELS,
  ZOOM_TWEEN_DURATION_MS,
} from "../constants";
import { IsometricGrid } from "../grid/IsometricGrid";
import type { LoadedTiledMap } from "../maps/load-tiled-map";
import { loadTiledMap } from "../maps/load-tiled-map";
import type { MapPreviewUIScene } from "./MapPreviewUIScene";

export class MapPreviewScene extends Phaser.Scene {
  private isometricGrid: IsometricGrid | null = null;
  private zoomIndex = ZOOM_DEFAULT_INDEX;
  private arrowKeysDown = new Set<string>();
  private mapUrl: string | null = null;
  private currentMap: MapDefinition | null = null;
  private formatIndex = 0;
  private uiScene: MapPreviewUIScene | null = null;

  constructor() {
    super("MapPreviewScene");
  }

  init(data: { mapUrl?: string }): void {
    this.mapUrl = data.mapUrl ?? null;
  }

  preload(): void {
    this.load.spritesheet(TILESET_KEY, "assets/tilesets/terrain/tileset.png", {
      frameWidth: 32,
      frameHeight: 32,
    });
  }

  create(): void {
    const tilesetTexture = this.textures.get(TILESET_KEY);
    if (tilesetTexture) {
      tilesetTexture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    this.cameras.main.setZoom(ZOOM_LEVELS[this.zoomIndex]);

    this.events.on("cycleFormat", () => this.cycleFormat());
    this.setupKeyboard();

    this.events.once("uiReady", () => {
      this.uiScene = this.scene.get("MapPreviewUIScene") as MapPreviewUIScene;
      void this.loadMap();
    });

    this.scene.launch("MapPreviewUIScene");
  }

  private async loadMap(): Promise<void> {
    if (!this.mapUrl) {
      this.uiScene?.setError("No map URL provided. Use ?map=<path>");
      return;
    }

    try {
      const loaded = await loadTiledMap(this.mapUrl);
      this.renderMap(loaded);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.uiScene?.setError(message);
      console.error("Map load error:", error);
    }
  }

  private renderMap(loaded: LoadedTiledMap): void {
    const { map, elevationLayers, heightData, slopeData, firstgid } = loaded;
    this.currentMap = map;
    this.formatIndex = 0;

    this.uiScene?.setMapInfo(map.name, map.width, map.height);

    this.isometricGrid = new IsometricGrid(this, map.width, map.height);
    this.isometricGrid.drawGridFromTileData(elevationLayers, firstgid, heightData, slopeData);

    this.renderCurrentFormat();
    this.setupCameraBounds(map.width, map.height);
    this.centerCameraOnMap(map.width, map.height);
    this.setupInput();
  }

  private renderCurrentFormat(): void {
    if (!this.isometricGrid || !this.currentMap || this.currentMap.formats.length === 0) {
      return;
    }

    this.isometricGrid.clearHighlights();

    const format = this.currentMap.formats[this.formatIndex];
    if (!format) {
      return;
    }

    for (let zoneIndex = 0; zoneIndex < format.spawnZones.length; zoneIndex++) {
      const zone = format.spawnZones[zoneIndex];
      if (!zone) {
        continue;
      }
      const color = getTeamColorByPlayerId(`player-${zoneIndex + 1}`);
      this.isometricGrid.highlightTilesWithColor(zone.positions, color, 0.5);
    }

    this.uiScene?.setFormatInfo(
      format.teamCount,
      format.maxPokemonPerTeam,
      this.formatIndex,
      this.currentMap.formats.length,
    );
  }

  private cycleFormat(): void {
    if (!this.currentMap || this.currentMap.formats.length <= 1) {
      return;
    }
    this.formatIndex = (this.formatIndex + 1) % this.currentMap.formats.length;
    this.renderCurrentFormat();
  }

  private setupCameraBounds(gridWidth: number, gridHeight: number): void {
    const offsetX = CANVAS_WIDTH / 2;
    const isoTotalWidth = ((gridWidth + gridHeight) * TILE_WIDTH) / 2;
    const isoTotalHeight = ((gridWidth + gridHeight) * TILE_HEIGHT) / 2;
    const offsetY = CANVAS_HEIGHT / 2 - isoTotalHeight / 2;

    const marginX = Math.max(isoTotalWidth / 2, CANVAS_WIDTH);
    const marginY = Math.max(isoTotalHeight / 2, CANVAS_HEIGHT);

    this.cameras.main.setBounds(
      offsetX - isoTotalWidth / 2 - marginX,
      offsetY - marginY,
      isoTotalWidth + marginX * 2,
      isoTotalHeight + marginY * 2,
    );
  }

  private centerCameraOnMap(gridWidth: number, gridHeight: number): void {
    if (!this.isometricGrid) {
      return;
    }
    const center = this.isometricGrid.gridToScreen(
      Math.floor(gridWidth / 2),
      Math.floor(gridHeight / 2),
    );
    this.cameras.main.centerOn(center.x, center.y);
  }

  private setupKeyboard(): void {
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (event.key === "r" || event.key === "R") {
        this.scene.restart({ mapUrl: this.mapUrl });
      }
      if (event.key === "t" || event.key === "T") {
        this.cycleFormat();
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        this.arrowKeysDown.add(event.key);
      }
    });

    this.input.keyboard?.on("keyup", (event: KeyboardEvent) => {
      this.arrowKeysDown.delete(event.key);
    });
  }

  private setupInput(): void {
    this.input.on(
      "wheel",
      (_pointer: Phaser.Input.Pointer, _dx: number, _dy: number, dz: number) => {
        const newIndex = dz > 0 ? this.zoomIndex - 1 : this.zoomIndex + 1;
        if (newIndex >= 0 && newIndex < ZOOM_LEVELS.length) {
          this.zoomIndex = newIndex;
          this.tweens.add({
            targets: this.cameras.main,
            zoom: ZOOM_LEVELS[this.zoomIndex],
            duration: ZOOM_TWEEN_DURATION_MS,
            ease: "Sine.easeOut",
          });
        }
      },
    );

    if (this.isometricGrid) {
      const grid = this.isometricGrid;
      this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
        const gridPos = grid.screenToGrid(pointer.worldX, pointer.worldY);
        if (gridPos) {
          grid.showCursor(gridPos.x, gridPos.y);
          const height = grid.getTileHeight(gridPos.x, gridPos.y);
          this.uiScene?.setCursorInfo(gridPos.x, gridPos.y, height);
        } else {
          this.uiScene?.clearCursorInfo();
        }
      });
    }
  }

  update(): void {
    const camera = this.cameras.main;

    if (this.arrowKeysDown.has("ArrowUp")) {
      camera.scrollY -= ARROW_PAN_SPEED;
    }
    if (this.arrowKeysDown.has("ArrowDown")) {
      camera.scrollY += ARROW_PAN_SPEED;
    }
    if (this.arrowKeysDown.has("ArrowLeft")) {
      camera.scrollX -= ARROW_PAN_SPEED;
    }
    if (this.arrowKeysDown.has("ArrowRight")) {
      camera.scrollX += ARROW_PAN_SPEED;
    }
  }
}
