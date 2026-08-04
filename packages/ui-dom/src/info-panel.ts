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
import { createChip } from "./chip.js";
import { el } from "./dom-helpers.js";
import { createTypeChip } from "./type-chip.js";

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

/**
 * @param testId root `data-testid`. The chrome mounts this component TWICE (left panel + cursor
 * card, plan 175); the two roots must be distinguishable or every e2e locator matches both. Inner
 * testids stay identical on purpose — a test scopes them under the root it means.
 */
export function createInfoPanel(testId = "info-panel"): InfoPanel {
  const panel = el("div", "ip-panel", testId);
  panel.dataset.team = "1";
  panel.hidden = true;

  const portrait = el("img", "ip-portrait", "info-panel-portrait");
  portrait.alt = ""; // decorative: name is read from text
  portrait.decoding = "async";
  portrait.loading = "lazy";

  // Beside the portrait (row 1): identity + type chips.
  const headerCol = el("div", "ip-headercol");

  const header = el("div", "ip-header");
  const nameEl = el("span", "ip-name", "info-panel-name");
  const genderEl = el("span", "ip-gender");
  const levelEl = el("span", "ip-level", "info-panel-level");
  header.append(nameEl, genderEl, levelEl);

  // Type chips (both allies + enemies — types are public). The target counter rides on this row,
  // right-aligned under the level (human 2026-07-25).
  const typesEl = el("ul", "ip-types", "info-panel-types");
  headerCol.append(header, typesEl);

  // HP bar exposes role="progressbar" (+ aria-valuenow/max) → e2e locates it by role, no testid.
  const hpBar = el("div", "ip-hpbar");
  hpBar.setAttribute("role", "progressbar");
  hpBar.setAttribute("aria-valuemin", "0");
  const hpFill = el("div", "ip-hpfill");
  // Confirm-phase forecast (plan 175): the loss a minimum roll guarantees, then the extra a maximum
  // roll would take. Inert (hidden) on the left panel, which never carries a preview.
  const ghostCertain = el("div", "ip-ghost-certain");
  const ghostRoll = el("div", "ip-ghost-roll");
  ghostCertain.hidden = true;
  ghostRoll.hidden = true;
  hpBar.append(hpFill, ghostCertain, ghostRoll);

  // HP line: "142 / 180 (79%)" on the left, talent pushed to the right (ally only) — same row.
  // Percentage is a smaller sibling span so it reads as secondary to the exact HP numbers.
  const hpRow = el("div", "ip-hprow");
  const hpText = el("span", "ip-hptext", "info-panel-hp");
  const hpNumbers = el("span", "ip-hpnumbers");
  const hpPct = el("span", "ip-hppct");
  hpText.append(hpNumbers, hpPct);
  const talentEl = el("span", "ip-talent", "info-panel-talent");
  hpRow.append(hpText, talentEl);

  // Held item line: official item icon + localised name; hidden when holding nothing.
  const itemEl = el("span", "ip-item", "info-panel-item");
  const itemIcon = el("img", "ip-item-icon");
  itemIcon.alt = ""; // decorative: the item name is read from the sibling text
  itemIcon.decoding = "async";
  const itemName = el("span", "ip-item-name");
  itemEl.append(itemIcon, itemName);

  // Ally-only (plan 174): battle-stats block. Hidden for enemies.
  const statsEl = el("div", "ip-stats", "info-panel-stats");

  const badges = el("ul", "ip-badges");

  // Full-width column under the portrait row: HP + item + stats reclaim the space next to the
  // portrait (feedback plan 174). Portrait/header sit on row 1; content + badges span both columns.
  // Preview extras (plan 175), all inert on the left panel: target cycling in the header, the
  // friendly-fire banner, and the predicted HP left.
  // Target counter — no chevrons (human 2026-07-25): cycling is driven by hovering another target
  // of the footprint, or Tab / Shift+Tab. Rides the type-chip row, right-aligned under the level.
  const targetCounter = el("li", "ip-counter", "combat-preview-counter");
  targetCounter.hidden = true;

  const remainingEl = el("div", "ip-remaining", "combat-preview-remaining");
  remainingEl.hidden = true;
  const verdictEl = el("div", "ip-verdict", "combat-preview-verdict");
  verdictEl.hidden = true;

  // Attack block (plan 175): a section of the ATTACKER's own panel while a confirm is open. A
  // separate fused arrow card was tried first and rejected — this keeps one card, one border.
  const attackEl = el("div", "ip-attack", "combat-preview-attack");
  attackEl.hidden = true;
  const attackMove = el("div", "ip-attack-move");
  const attackTypeIcon = el("img", "ip-attack-type");
  attackTypeIcon.alt = "";
  attackTypeIcon.decoding = "async";
  const attackMoveName = el("span", "ip-attack-name", "combat-preview-move");
  attackMove.append(attackTypeIcon, attackMoveName);

  const attackDamageRow = el("div", "ip-attack-damagerow");
  const attackDamage = el("span", "ip-attack-damage", "combat-preview-damage");
  const attackDamageUnit = el("span", "ip-attack-unit");
  const attackStats = el("span", "ip-attack-stats");
  const attackAccuracy = el("span", "ip-attack-stat", "combat-preview-accuracy");
  const attackCrit = el("span", "ip-attack-stat", "combat-preview-crit");
  attackStats.append(attackAccuracy, attackCrit);
  attackDamageRow.append(attackDamage, attackDamageUnit, attackStats);

  // Charge Time on its OWN row (plan 178): squeezed as a third value next to Préc./Crit. it overflowed
  // the block and read as noise — the human missed the Pression surcharge entirely. The surcharge is
  // a separate span so it can be coloured as the penalty it is.
  const attackCt = el("div", "ip-attack-ct", "combat-preview-ct");
  const attackCtValue = el("span");
  const attackCtSurcharge = el("span", "ip-attack-ct-surcharge");
  attackCt.append(attackCtValue, attackCtSurcharge);

  const attackModifiers = el("div", "ip-attack-chips", "combat-preview-modifiers");
  const attackEffect = el("div", "ip-attack-chips", "combat-preview-effect");
  attackEl.append(attackMove, attackDamageRow, attackCt, attackModifiers, attackEffect);

  const content = el("div", "ip-content");
  content.append(hpBar, hpRow, remainingEl, verdictEl, itemEl, statsEl);
  // The attack block is a THIRD grid column, not a row inside the content: during a confirm the
  // panel stretches rightwards and ends in an arrow tip, carrying the block in that extension
  // (human 2026-07-25) — same readout as the old standalone card, now part of the panel.
  panel.append(portrait, headerCol, content, badges, attackEl);

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
    hpNumbers.textContent = `${data.hpCurrent} / ${data.hpMax}`;
    hpPct.textContent = ` (${Math.round(ratio * 100)}%)`;
    hpBar.setAttribute("aria-valuemax", String(data.hpMax));
    hpBar.setAttribute("aria-valuenow", String(data.hpCurrent));

    const attack = data.attack;
    attackEl.hidden = attack === undefined;
    // Drives the panel's stretched, arrow-tipped shape (CSS): the block is an extension of this
    // card, not a card of its own.
    panel.dataset.attack = attack ? "1" : "";
    if (attack) {
      attackTypeIcon.src = attack.moveTypeIconUrl;
      attackMoveName.textContent = attack.moveName;
      attackDamage.textContent = attack.damageValue;
      attackDamage.dataset.outcome = attack.outcome;
      attackDamageUnit.textContent = attack.damageUnitLabel;
      attackAccuracy.textContent = attack.accuracyText;
      attackCrit.textContent = attack.critText;
      attackCtValue.textContent = attack.ctText;
      attackCtSurcharge.textContent = attack.ctSurchargeText;
      attackModifiers.replaceChildren(...attack.modifierChips.map((c) => createChip(c, "ip")));
      attackModifiers.hidden = attack.modifierChips.length === 0;
      if (attack.effectChip) {
        attackEffect.replaceChildren(createChip(attack.effectChip, "ip"));
        attackEffect.hidden = false;
      } else {
        attackEffect.replaceChildren();
        attackEffect.hidden = true;
      }
    }

    const preview = data.preview;
    panel.dataset.outcome = preview?.outcome ?? "";
    if (preview?.damage && data.hpMax > 0) {
      // Both overlays hug the right edge of the current HP and grow leftwards.
      const certain = Math.min(preview.damage.min, data.hpCurrent) / data.hpMax;
      const rolled = Math.min(preview.damage.max, data.hpCurrent) / data.hpMax;
      ghostCertain.hidden = false;
      ghostRoll.hidden = rolled <= certain;
      ghostCertain.style.width = `${certain * 100}%`;
      ghostCertain.style.left = `${(ratio - certain) * 100}%`;
      ghostRoll.style.width = `${(rolled - certain) * 100}%`;
      ghostRoll.style.left = `${(ratio - rolled) * 100}%`;
    } else {
      ghostCertain.hidden = true;
      ghostRoll.hidden = true;
    }

    const multiTarget = (preview?.totalTargets ?? 0) > 1;
    targetCounter.hidden = !multiTarget;
    targetCounter.textContent = multiTarget
      ? `${(preview?.focusIndex ?? 0) + 1}/${preview?.totalTargets}`
      : "";

    remainingEl.textContent = preview?.remainingLabel ?? "";
    remainingEl.hidden = !preview?.remainingLabel;
    verdictEl.textContent = preview?.verdictLabel ?? "";
    verdictEl.hidden = !preview?.verdictLabel;

    // Talent shares the HP row (ally only), pushed to the right.
    if (data.ability) {
      talentEl.textContent = data.ability;
      talentEl.hidden = false;
    } else {
      talentEl.textContent = "";
      talentEl.hidden = true;
    }

    typesEl.replaceChildren();
    if (data.types.length > 0) {
      const typeFragment = document.createDocumentFragment();
      for (const type of data.types) {
        typeFragment.append(
          createTypeChip(type.id, type.label, { tag: "li", iconUrl: type.iconUrl }),
        );
      }
      typesEl.append(typeFragment);
    }
    typesEl.append(targetCounter);
    typesEl.hidden = data.types.length === 0 && targetCounter.hidden;

    statsEl.replaceChildren();
    if (data.stats && data.stats.length > 0) {
      const statFragment = document.createDocumentFragment();
      for (const stat of data.stats) {
        const row = el("div", "ip-stat");

        // Label coloured by the nature's boosted (blue) / lowered (red) stat.
        const label = el("span", "ip-stat-label");
        label.textContent = stat.label;
        if (stat.natureEffect) {
          label.dataset.nature = stat.natureEffect;
        }

        const value = el("span", "ip-stat-value");
        value.textContent = String(stat.value);

        // Fixed grid columns (crans / arrow / modified) → the "→" always lands at the same x across
        // rows, even when a row has no crans or no modified value. Empty cells still reserve width.
        const crans = el("span", "ip-stat-crans");
        if (stat.stage !== 0) {
          crans.textContent = `${Math.abs(stat.stage)}${stat.stage > 0 ? "↑" : "↓"}`;
          crans.classList.add(stat.stage > 0 ? "ip-stat-buff" : "ip-stat-debuff");
        }

        const arrow = el("span", "ip-stat-arrow");
        const modified = el("span", "ip-stat-modified");
        // Effective value (crans + status) — shown whenever it differs from the base stat.
        if (stat.modified !== stat.value) {
          arrow.textContent = "→";
          modified.textContent = String(stat.modified);
          modified.classList.add(stat.modified > stat.value ? "ip-stat-buff" : "ip-stat-debuff");
        }

        row.append(label, value, crans, arrow, modified);
        statFragment.append(row);
      }
      statsEl.append(statFragment);
      statsEl.hidden = false;
    } else {
      statsEl.hidden = true;
    }

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
