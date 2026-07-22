/**
 * InfoPanel — combat info readout, DOM/CSS info panel
 * (Phase 5 Jalon 2b). Category-B chrome: lives in the `.ui-screen` overlay
 * layer, anchored to the stage corner, scaled by container-query units so it
 * tracks the *game* size, not the browser. See plan 119 §4-B.
 *
 * Pure view component: takes an `InfoPanelData` view-model and renders it. The
 * core→view-model adapter (PokemonInstance/BattleState → data) lands when combat
 * is wired at Jalon 4, keeping this decoupled from `@pokemon-tactic/core`.
 */

import type { InfoPanelData } from "@pokemon-tactic/render-ports";
import { el } from "./dom-helpers.js";

// Data view-model types live in the renderer contract package (plan 125);
// re-exported for callers importing them from here.
export type {
  InfoPanelBadge,
  InfoPanelBadgeVariant,
  InfoPanelData,
} from "@pokemon-tactic/render-ports";

export interface InfoPanel {
  readonly element: HTMLElement;
  update(data: InfoPanelData): void;
  show(): void;
  hide(): void;
  destroy(): void;
}

const GENDER_SYMBOL: Record<"male" | "female", string> = {
  male: "♂", // ♂
  female: "♀", // ♀
};

export function createInfoPanel(): InfoPanel {
  const panel = el("div", "ip-panel", "info-panel");
  panel.dataset.team = "1";
  panel.hidden = true;

  const portrait = el("img", "ip-portrait", "info-panel-portrait");
  portrait.alt = ""; // decorative: name is read from text
  portrait.decoding = "async";
  portrait.loading = "lazy";

  const body = el("div", "ip-body");

  const header = el("div", "ip-header");
  const nameEl = el("span", "ip-name", "info-panel-name");
  const genderEl = el("span", "ip-gender");
  const levelEl = el("span", "ip-level", "info-panel-level");
  header.append(nameEl, genderEl, levelEl);

  // HP bar exposes role="progressbar" (+ aria-valuenow/max) → e2e locates it by role, no testid.
  const hpBar = el("div", "ip-hpbar");
  hpBar.setAttribute("role", "progressbar");
  hpBar.setAttribute("aria-valuemin", "0");
  const hpFill = el("div", "ip-hpfill");
  hpBar.append(hpFill);

  const hpText = el("span", "ip-hptext", "info-panel-hp");

  // Held item line: official item icon + localised name; hidden when holding nothing.
  const itemEl = el("span", "ip-item", "info-panel-item");
  const itemIcon = el("img", "ip-item-icon");
  itemIcon.alt = ""; // decorative: the item name is read from the sibling text
  itemIcon.decoding = "async";
  const itemName = el("span", "ip-item-name");
  itemEl.append(itemIcon, itemName);

  const badges = el("ul", "ip-badges");

  // Portrait + body sit side by side (row 1); badges span full width (row 2),
  // so they get the whole panel width, not just the column beside the portrait.
  body.append(header, hpBar, hpText, itemEl);
  panel.append(portrait, body, badges);

  function update(data: InfoPanelData): void {
    panel.hidden = false;
    panel.dataset.team = String(data.team);

    nameEl.textContent = data.name;
    levelEl.textContent = `Lv.${data.level}`;
    if (data.gender) {
      genderEl.textContent = GENDER_SYMBOL[data.gender];
      genderEl.dataset.gender = data.gender;
      genderEl.hidden = false;
    } else {
      genderEl.hidden = true;
    }

    if (data.portraitUrl) {
      portrait.src = data.portraitUrl;
      portrait.hidden = false;
    } else {
      portrait.hidden = true;
    }

    const ratio = data.hpMax > 0 ? Math.max(0, Math.min(1, data.hpCurrent / data.hpMax)) : 0;
    // Runtime ratio → CSS var (no static-CSS equivalent); width derives from it.
    hpFill.style.setProperty("--ip-hp", String(ratio));
    hpText.textContent = `${data.hpCurrent} / ${data.hpMax}`;
    hpBar.setAttribute("aria-valuemax", String(data.hpMax));
    hpBar.setAttribute("aria-valuenow", String(data.hpCurrent));

    if (data.heldItem) {
      itemName.textContent = data.heldItem;
      if (data.itemIconUrl) {
        itemIcon.src = data.itemIconUrl;
        itemIcon.hidden = false;
      } else {
        itemIcon.removeAttribute("src");
        itemIcon.hidden = true;
      }
      itemEl.hidden = false;
    } else {
      itemName.textContent = "";
      itemIcon.removeAttribute("src");
      itemEl.hidden = true;
    }

    badges.replaceChildren();
    const fragment = document.createDocumentFragment();
    for (const badge of data.badges) {
      const item = el("li", "ip-badge");
      item.dataset.variant = badge.variant;
      item.textContent = badge.label;
      fragment.append(item);
    }
    badges.append(fragment);
  }

  return {
    element: panel,
    update,
    show: () => {
      panel.hidden = false;
    },
    hide: () => {
      panel.hidden = true;
    },
    destroy: () => {
      panel.remove();
    },
  };
}
