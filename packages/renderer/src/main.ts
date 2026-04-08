import Phaser from "phaser";
import { BACKGROUND_COLOR, CANVAS_HEIGHT, CANVAS_WIDTH } from "./constants";
import { initLanguage } from "./i18n";
import { sandboxBootConfig } from "./sandbox-boot";
import { BattleModeScene } from "./scenes/BattleModeScene";
import { BattleScene } from "./scenes/BattleScene";
import { BattleUIScene } from "./scenes/BattleUIScene";
import { CreditsScene } from "./scenes/CreditsScene";
import { MainMenuScene } from "./scenes/MainMenuScene";
import { SettingsScene } from "./scenes/SettingsScene";
import { TeamSelectScene } from "./scenes/TeamSelectScene";
import { initSettings } from "./settings";

initLanguage();
initSettings();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  backgroundColor: BACKGROUND_COLOR,
  roundPixels: true,
  parent: "game-container",
  scene: sandboxBootConfig.enabled
    ? [TeamSelectScene, BattleScene, BattleUIScene]
    : [
        MainMenuScene,
        BattleModeScene,
        SettingsScene,
        CreditsScene,
        TeamSelectScene,
        BattleScene,
        BattleUIScene,
      ],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
