import Phaser from "phaser";
import { BACKGROUND_COLOR, CANVAS_HEIGHT, CANVAS_WIDTH } from "./constants";
import { initLanguage } from "./i18n";
import { initSandboxStudioDom, sandboxBootConfig } from "./sandbox-boot";
import { BattleModeScene } from "./scenes/BattleModeScene";
import { BattleScene } from "./scenes/BattleScene";
import { BattleUIScene } from "./scenes/BattleUIScene";
import { CreditsScene } from "./scenes/CreditsScene";
import { LoadingScene } from "./scenes/LoadingScene";
import { MainMenuScene } from "./scenes/MainMenuScene";
import { MapPreviewScene } from "./scenes/MapPreviewScene";
import { MapPreviewUIScene } from "./scenes/MapPreviewUIScene";
import { MapSelectPreviewScene } from "./scenes/MapSelectPreviewScene";
import { MapSelectScene } from "./scenes/MapSelectScene";
import { MyTeamsScene } from "./scenes/MyTeamsScene";
import { SettingsScene } from "./scenes/SettingsScene";
import { TeamEditScene } from "./scenes/TeamEditScene";
import { TeamSelectScene } from "./scenes/TeamSelectScene";
import { initSettings } from "./settings";
import "./styles/index.css";

initLanguage();
initSettings();

// Kick off the custom font fetch explicitly so it lands in document.fonts
// before any Phaser scene tries to draw text in canvas (which doesn't
// trigger CSS font-loading on its own). FontFace API replaces the old
// <link rel="preload"> approach that warned in Firefox for canvas-only
// usage (plan 097 — recommended pattern for Phaser web games).
if (document.fonts) {
  void document.fonts.load('1em "PokemonEmeraldPro"');
}

if (sandboxBootConfig.enabled) {
  initSandboxStudioDom();
}

const mapPreviewUrl = new URLSearchParams(window.location.search).get("map");

function getScenes(): Phaser.Types.Scenes.SceneType[] {
  if (mapPreviewUrl) {
    return [MapPreviewScene, MapPreviewUIScene];
  }
  if (sandboxBootConfig.enabled) {
    return [LoadingScene, TeamSelectScene, BattleScene, BattleUIScene];
  }
  return [
    LoadingScene,
    MainMenuScene,
    BattleModeScene,
    SettingsScene,
    CreditsScene,
    MapSelectScene,
    MapSelectPreviewScene,
    TeamSelectScene,
    MyTeamsScene,
    TeamEditScene,
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
