import {
  BATTLE_TEXT_DRIFT_Y,
  BATTLE_TEXT_DURATION_MS,
  BATTLE_TEXT_FONT_SIZE,
  BATTLE_TEXT_STROKE_COLOR,
  BATTLE_TEXT_STROKE_WIDTH,
  DEPTH_BATTLE_TEXT,
  FONT_FAMILY,
} from "../constants";

export interface BattleTextOptions {
  color?: string;
  fontSize?: number;
  duration?: number;
  offsetY?: number;
}

export function showBattleText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  options: BattleTextOptions = {},
): Phaser.GameObjects.Text {
  const {
    color = "#ffffff",
    fontSize = BATTLE_TEXT_FONT_SIZE,
    duration = BATTLE_TEXT_DURATION_MS,
    offsetY = 0,
  } = options;

  const textObject = scene.add.text(x, y + offsetY, text, {
    fontFamily: FONT_FAMILY,
    fontSize: `${fontSize}px`,
    color,
    stroke: BATTLE_TEXT_STROKE_COLOR,
    strokeThickness: BATTLE_TEXT_STROKE_WIDTH,
    fontStyle: "bold",
  });
  textObject.setOrigin(0.5, 0.5);
  textObject.setDepth(DEPTH_BATTLE_TEXT);

  scene.tweens.add({
    targets: textObject,
    y: y + offsetY + BATTLE_TEXT_DRIFT_Y,
    alpha: 0,
    duration,
    ease: "Cubic.easeOut",
    onComplete: () => {
      textObject.destroy();
    },
  });

  return textObject;
}
