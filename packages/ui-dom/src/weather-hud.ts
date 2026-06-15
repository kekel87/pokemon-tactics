import type { WeatherView } from "@pokemon-tactic/view-core";
import type { UiDomConfig } from "./config.js";
import { el } from "./dom-helpers.js";

/**
 * WeatherHud — top-centre weather readout, DOM/CSS port of the Phaser
 * `ui/WeatherHud.ts` (plan 121 step 4b-1). Category-B chrome in the `.ui-screen`
 * overlay. Pure view: takes a `WeatherView` (or null to hide) and renders it.
 */

const WEATHER_LABEL_KEY: Record<WeatherView["kind"], string> = {
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

export function createWeatherHud(config: UiDomConfig): WeatherHud {
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
      icon.src = config.getWeatherIconUrl(view.kind);
      label.textContent = config.translate(WEATHER_LABEL_KEY[view.kind]);
      turns.textContent = config.translate("weather.turnsLeft", { turns: view.turnsRemaining });
      root.hidden = false;
    },
    destroy: () => root.remove(),
  };
}
