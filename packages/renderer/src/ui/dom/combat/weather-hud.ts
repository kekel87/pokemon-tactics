import type { WeatherView } from "../../../game/battle-views.js";
import { t } from "../../../i18n/index.js";
import type { TranslationKey } from "../../../i18n/types.js";

/**
 * WeatherHud — top-centre weather readout, DOM/CSS port of the Phaser
 * `ui/WeatherHud.ts` (plan 121 step 4b-1). Category-B chrome in the `.ui-screen`
 * overlay. Pure view: takes a `WeatherView` (or null to hide) and renders it.
 */

const WEATHER_ICON_URL: Record<WeatherView["kind"], string> = {
  sun: "/assets/ui/weather/weather-sun.png",
  rain: "/assets/ui/weather/weather-rain.png",
  sandstorm: "/assets/ui/weather/weather-sandstorm.png",
  snow: "/assets/ui/weather/weather-snow.png",
};

const WEATHER_LABEL_KEY: Record<WeatherView["kind"], TranslationKey> = {
  sun: "weather.sun",
  rain: "weather.rain",
  sandstorm: "weather.sandstorm",
  snow: "weather.snow",
};

export interface WeatherHud {
  readonly element: HTMLElement;
  update(view: WeatherView | null): void;
  destroy(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

export function createWeatherHud(): WeatherHud {
  const root = el("div", "wh-hud");
  root.hidden = true;

  const icon = el("img", "wh-icon");
  icon.alt = ""; // decorative: the label carries the weather name
  icon.decoding = "async";

  const text = el("div", "wh-text");
  const label = el("span", "wh-label");
  const turns = el("span", "wh-turns");
  text.append(label, turns);
  root.append(icon, text);

  return {
    element: root,
    update: (view: WeatherView | null) => {
      if (!view) {
        root.hidden = true;
        return;
      }
      icon.src = WEATHER_ICON_URL[view.kind];
      label.textContent = t(WEATHER_LABEL_KEY[view.kind]);
      turns.textContent = t("weather.turnsLeft", { turns: view.turnsRemaining });
      root.hidden = false;
    },
    destroy: () => root.remove(),
  };
}
