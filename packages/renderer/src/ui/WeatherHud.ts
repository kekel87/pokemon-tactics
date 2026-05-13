import { type BattleState, Weather } from "@pokemon-tactic/core";
import {
  CANVAS_WIDTH,
  DEPTH_WEATHER_HUD,
  FONT_FAMILY,
  WEATHER_HUD_BG_ALPHA,
  WEATHER_HUD_BG_COLOR,
  WEATHER_HUD_HEIGHT,
  WEATHER_HUD_ICON_SIZE,
  WEATHER_HUD_PADDING,
  WEATHER_HUD_WIDTH,
  WEATHER_HUD_Y,
} from "../constants";
import { t } from "../i18n";
import type { TranslationKey } from "../i18n/types";

const WEATHER_ICON_KEYS: Record<Exclude<Weather, "none">, string> = {
  sun: "weather-sun",
  rain: "weather-rain",
  sandstorm: "weather-sandstorm",
  snow: "weather-snow",
};

const WEATHER_LABEL_KEYS: Record<Exclude<Weather, "none">, TranslationKey> = {
  sun: "weather.sun",
  rain: "weather.rain",
  sandstorm: "weather.sandstorm",
  snow: "weather.snow",
};

export class WeatherHud {
  private readonly container: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private readonly turnsText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const centerX = CANVAS_WIDTH / 2;
    this.container = scene.add.container(centerX, WEATHER_HUD_Y);
    this.container.setDepth(DEPTH_WEATHER_HUD);
    this.container.setScrollFactor(0);

    this.bg = scene.add.rectangle(
      0,
      0,
      WEATHER_HUD_WIDTH,
      WEATHER_HUD_HEIGHT,
      WEATHER_HUD_BG_COLOR,
      WEATHER_HUD_BG_ALPHA,
    );
    this.bg.setOrigin(0.5, 0);

    const iconX = -WEATHER_HUD_WIDTH / 2 + WEATHER_HUD_PADDING;
    const iconY = WEATHER_HUD_PADDING;
    this.icon = scene.add.image(iconX, iconY, WEATHER_ICON_KEYS.sun);
    this.icon.setOrigin(0, 0);
    this.icon.setDisplaySize(WEATHER_HUD_ICON_SIZE, WEATHER_HUD_ICON_SIZE);

    const textX = iconX + WEATHER_HUD_ICON_SIZE + 8;
    this.label = scene.add.text(textX, WEATHER_HUD_PADDING, "", {
      fontSize: "14px",
      color: "#ffffff",
      fontFamily: FONT_FAMILY,
    });

    this.turnsText = scene.add.text(textX, WEATHER_HUD_PADDING + 18, "", {
      fontSize: "12px",
      color: "#cccccc",
      fontFamily: FONT_FAMILY,
    });

    this.container.add([this.bg, this.icon, this.label, this.turnsText]);
    this.container.setVisible(false);
  }

  update(state: BattleState): void {
    if (state.weather === Weather.None) {
      this.container.setVisible(false);
      return;
    }
    const key = state.weather as Exclude<Weather, "none">;
    this.icon.setTexture(WEATHER_ICON_KEYS[key]);
    this.label.setText(t(WEATHER_LABEL_KEYS[key]));
    this.turnsText.setText(t("weather.turnsLeft", { turns: state.weatherTurnsRemaining }));
    this.container.setVisible(true);
  }

  destroy(): void {
    this.container.destroy();
  }
}
