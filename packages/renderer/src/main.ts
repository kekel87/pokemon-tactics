import Phaser from "phaser";
import { BACKGROUND_COLOR, CANVAS_HEIGHT, CANVAS_WIDTH } from "./constants";
import { initLanguage } from "./i18n";
import { sandboxBootConfig } from "./sandbox-boot";
import { BattleModeScene } from "./scenes/BattleModeScene";
import { BattleScene } from "./scenes/BattleScene";
import { BattleUIScene } from "./scenes/BattleUIScene";
import { CreditsScene } from "./scenes/CreditsScene";
import { MainMenuScene } from "./scenes/MainMenuScene";
import { MapPreviewScene } from "./scenes/MapPreviewScene";
import { MapPreviewUIScene } from "./scenes/MapPreviewUIScene";
import { MapSelectPreviewScene } from "./scenes/MapSelectPreviewScene";
import { MapSelectScene } from "./scenes/MapSelectScene";
import { SettingsScene } from "./scenes/SettingsScene";
import { TeamSelectScene } from "./scenes/TeamSelectScene";
import { initSettings } from "./settings";

initLanguage();
initSettings();

const mapPreviewUrl = new URLSearchParams(window.location.search).get("map");

function getScenes(): Phaser.Types.Scenes.SceneType[] {
  if (mapPreviewUrl) {
    return [MapPreviewScene, MapPreviewUIScene];
  }
  if (sandboxBootConfig.enabled) {
    return [TeamSelectScene, BattleScene, BattleUIScene];
  }
  return [
    MainMenuScene,
    BattleModeScene,
    SettingsScene,
    CreditsScene,
    MapSelectScene,
    MapSelectPreviewScene,
    TeamSelectScene,
    BattleScene,
    BattleUIScene,
  ];
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  backgroundColor: BACKGROUND_COLOR,
  roundPixels: true,
  parent: "game-container",
  scene: getScenes(),
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

const game = new Phaser.Game(config);

if (mapPreviewUrl) {
  game.scene.start("MapPreviewScene", { mapUrl: mapPreviewUrl });
}
