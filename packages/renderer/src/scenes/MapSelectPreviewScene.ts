import Phaser from "phaser";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DECORATIONS_ASSET_PATHS,
  DECORATIONS_TEXTURE_KEYS,
  MAP_SELECT_PREVIEW_BG_COLOR,
  TILE_HEIGHT,
  TILE_WIDTH,
  TILESET_KEY,
} from "../constants";
import { DecorationsLayer } from "../grid/DecorationsLayer";
import { IsometricGrid } from "../grid/IsometricGrid";
import { loadTiledMap } from "../maps/load-tiled-map";

const PREVIEW_VIEWPORT_PADDING = 0.85;

export interface MapSelectPreviewLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class MapSelectPreviewScene extends Phaser.Scene {
  private isometricGrid: IsometricGrid | null = null;
  private decorationsLayer: DecorationsLayer | null = null;
  private currentUrl: string | null = null;
  private layout: MapSelectPreviewLayout = {
    x: 0,
    y: 0,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  };

  constructor() {
    super("MapSelectPreviewScene");
  }

  preload(): void {
    this.load.spritesheet(TILESET_KEY, "assets/tilesets/terrain/tileset.png", {
      frameWidth: 32,
      frameHeight: 32,
    });

    for (const kind of Object.keys(DECORATIONS_TEXTURE_KEYS) as Array<
      keyof typeof DECORATIONS_TEXTURE_KEYS
    >) {
      this.load.image(DECORATIONS_TEXTURE_KEYS[kind], DECORATIONS_ASSET_PATHS[kind]);
    }
  }

  create(): void {
    const tilesetTexture = this.textures.get(TILESET_KEY);
    if (tilesetTexture) {
      tilesetTexture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    for (const textureKey of Object.values(DECORATIONS_TEXTURE_KEYS)) {
      if (this.textures.exists(textureKey)) {
        this.textures.get(textureKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }

    this.cameras.main.setViewport(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
    );
    this.cameras.main.setBackgroundColor(MAP_SELECT_PREVIEW_BG_COLOR);

    this.events.emit("previewReady");
  }

  setLayout(layout: MapSelectPreviewLayout): void {
    this.layout = layout;
    if (!this.cameras.main) {
      return;
    }
    this.cameras.main.setViewport(layout.x, layout.y, layout.width, layout.height);
    if (this.isometricGrid) {
      this.applyCameraFit(this.isometricGrid.gridWidth, this.isometricGrid.gridHeight);
    }
  }

  async loadMap(url: string): Promise<void> {
    if (this.currentUrl === url) {
      return;
    }
    this.currentUrl = url;

    this.clearCurrentMap();

    try {
      const loaded = await loadTiledMap(url);
      if (this.currentUrl !== url) {
        return;
      }

      const { map, elevationLayers, heightData, slopeData, terrainData, firstgid } = loaded;

      this.isometricGrid = new IsometricGrid(this, map.width, map.height);
      this.isometricGrid.drawGridFromTileData(
        elevationLayers,
        firstgid,
        heightData,
        slopeData,
        terrainData,
      );

      this.decorationsLayer = new DecorationsLayer(this, this.isometricGrid);
      this.decorationsLayer.render(map, loaded.decorationObjects);

      this.applyCameraFit(map.width, map.height);
    } catch {
      this.clearCurrentMap();
    }
  }

  private clearCurrentMap(): void {
    this.children.removeAll(true);
    this.isometricGrid = null;
    this.decorationsLayer = null;
  }

  private applyCameraFit(gridWidth: number, gridHeight: number): void {
    const isoTotalWidth = ((gridWidth + gridHeight) * TILE_WIDTH) / 2;
    const isoTotalHeight = ((gridWidth + gridHeight) * TILE_HEIGHT) / 2;

    const zoomX = this.layout.width / isoTotalWidth;
    const zoomY = this.layout.height / isoTotalHeight;
    const zoom = Math.min(zoomX, zoomY) * PREVIEW_VIEWPORT_PADDING;

    const centerX = CANVAS_WIDTH / 2 + ((gridWidth - gridHeight) * TILE_WIDTH) / 4;
    const centerY = CANVAS_HEIGHT / 2;

    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(centerX, centerY);
  }
}
