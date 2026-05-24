import {
  DECORATIONS_ASSET_PATHS,
  DECORATIONS_TEXTURE_KEYS,
  HOVER_CURSOR_OPTIONS,
  STATUS_ICON_KEYS,
  TILESET_KEY,
  TYPE_NAMES,
} from "../constants";

export function preloadSharedUiAssets(scene: Phaser.Scene): void {
  scene.load.spritesheet("arrows", "assets/ui/arrows.png", {
    frameWidth: 32,
    frameHeight: 32,
  });

  for (const typeName of TYPE_NAMES) {
    scene.load.image(`type-${typeName}`, `assets/ui/types/${typeName}.png`);
  }

  scene.load.image("category-physical", "assets/ui/categories/physical.png");
  scene.load.image("category-special", "assets/ui/categories/special.png");
  scene.load.image("category-status", "assets/ui/categories/status.png");

  for (const option of HOVER_CURSOR_OPTIONS) {
    scene.load.image(option.key, `assets/ui/cursor/${option.key}.png`);
  }

  for (const key of STATUS_ICON_KEYS) {
    scene.load.image(`status-icon-${key}`, `assets/ui/statuses/icon-${key}.png`);
    scene.load.image(`status-label-${key}`, `assets/ui/statuses/label-${key}.png`);
  }

  for (const key of ["sun", "rain", "sandstorm", "snow"] as const) {
    scene.load.image(`weather-${key}`, `assets/ui/weather/weather-${key}.png`);
  }

  scene.load.spritesheet(TILESET_KEY, "assets/tilesets/terrain/tileset.png", {
    frameWidth: 32,
    frameHeight: 32,
  });

  for (const kind of Object.keys(DECORATIONS_TEXTURE_KEYS) as Array<
    keyof typeof DECORATIONS_TEXTURE_KEYS
  >) {
    scene.load.image(DECORATIONS_TEXTURE_KEYS[kind], DECORATIONS_ASSET_PATHS[kind]);
  }
}
