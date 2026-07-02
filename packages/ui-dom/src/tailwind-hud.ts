import type { TailwindView } from "@pokemon-tactic/view-core";
import type { UiDomConfig } from "./config.js";
import { el } from "./dom-helpers.js";

/**
 * TailwindHud — top-centre Vent Arrière (tailwind) readout. Shows a single arrow that points the
 * wind's world direction, rotated to match the isometric view (and re-rotated as the camera orbits)
 * so the direction reads visually — no cardinal text needed. Reads the wind from a `TailwindView`
 * and the live camera azimuth pushed by the host.
 */

/** Base screen angle (deg, arrow-up = 0, clockwise) of each world direction at the default view. */
const DIRECTION_BASE_DEG: Record<TailwindView["direction"], number> = {
  north: 0,
  east: 90,
  south: 180,
  west: 270,
};

/** 2D arrow tilted to sit on the isometric ground plane. */
const ISO_TILT_DEG = 45;

export interface TailwindHud {
  readonly element: HTMLElement;
  update(view: TailwindView | null): void;
  setAzimuth(azimuth: number): void;
  destroy(): void;
}

export function createTailwindHud(config: UiDomConfig): TailwindHud {
  const root = el("div", "wh-hud", "tailwind-hud");
  root.hidden = true;

  const arrow = el("span", "tw-arrow");
  arrow.textContent = "↑";
  const text = el("div", "wh-text");
  const label = el("span", "wh-label", "tailwind-label");
  const turns = el("span", "wh-turns", "tailwind-turns");
  text.append(label, turns);
  root.append(arrow, text);

  let current: TailwindView | null = null;
  let azimuthDeg = 0;
  let baseAzimuthDeg: number | null = null;

  const applyRotation = (): void => {
    if (!current) {
      return;
    }
    const deg = DIRECTION_BASE_DEG[current.direction] + ISO_TILT_DEG + azimuthDeg;
    arrow.style.transform = `rotate(${deg}deg)`;
  };

  return {
    element: root,
    update: (view: TailwindView | null) => {
      current = view;
      if (!view) {
        root.hidden = true;
        return;
      }
      label.textContent = config.translate("tailwind.label");
      turns.textContent = config.translate("weather.turnsLeft", { turns: view.turnsRemaining });
      applyRotation();
      root.hidden = false;
    },
    setAzimuth: (azimuth: number) => {
      const deg = (azimuth * 180) / Math.PI;
      if (baseAzimuthDeg === null) {
        baseAzimuthDeg = deg;
      }
      azimuthDeg = deg - baseAzimuthDeg;
      applyRotation();
    },
    destroy: () => root.remove(),
  };
}
