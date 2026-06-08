/**
 * Team Builder under the overlay contract — proof placeholder (Phase 5 Jalon 2c).
 *
 * Rebuilds the TeamEdit *layout* (topbar + slot row + two-column edit grid) by
 * reusing the production DOM sub-components (`SlotCardsRow`, `EditLeftPanel`,
 * `EditRightPanel`) and mounts it inside the `#game-stage` overlay. Its only job
 * is to prove the category-B contract holds for a *complex* panel: everything
 * scales with the stage via the cqw token overrides in `team-builder-overlay.css`.
 *
 * Placeholder, nothing wired: a fixed seeded team, read-only panels (edit
 * callbacks are no-ops), inert topbar. Clicking a slot just switches which
 * Pokemon the panels preview, so all six layouts can be checked. Real editing,
 * storage, navigation and the core→view-model wiring arrive with the scene
 * orchestrator at Jalon 4 (which also extracts a shared `TeamEditView` from the
 * Phaser `TeamEditScene`). Disposable like the rest of the harness (gone Jalon 5).
 */

import type { TeamSet, TeamSlot } from "@pokemon-tactic/core";
import { t } from "../i18n";
import { generateRandomTeam } from "../team/team-generator";
import { EditLeftPanel } from "../ui/team/EditLeftPanel";
import { EditRightPanel } from "../ui/team/EditRightPanel";
import { SlotCardsRow } from "../ui/team/SlotCardsRow";

export interface TeamEditHarness {
  readonly element: HTMLElement;
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

function topbarButton(label: string, variant?: "ghost" | "danger"): HTMLButtonElement {
  const button = el("button", "tb-btn");
  button.type = "button";
  button.textContent = label;
  if (variant) {
    button.dataset.variant = variant;
  }
  return button;
}

/** Deterministic PRNG (mulberry32) so the demo team is stable across reloads. */
function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mix = state;
    mix = Math.imul(mix ^ (mix >>> 15), mix | 1);
    mix ^= mix + Math.imul(mix ^ (mix >>> 7), mix | 61);
    return ((mix ^ (mix >>> 14)) >>> 0) / 4294967296;
  };
}

export function createTeamEditHarness(): TeamEditHarness {
  const team: TeamSet = generateRandomTeam({
    name: t("teamBuilder.untitledTeam"),
    rng: seededRng(0x5eed),
  });
  let activeSlotIndex = 0;
  // Placeholder: edits are inert until the Jalon 4 orchestrator wires them.
  const noop = (): undefined => undefined;

  const root = el("div", "tb-root");
  root.dataset.scene = "TeamEditScene";

  const topbar = el("div", "tb-topbar");
  const nameInput = el("input", "tb-topbar-name-input");
  nameInput.type = "text";
  nameInput.value = team.name;
  const countLabel = el("div", "tb-topbar-count");
  topbar.append(
    topbarButton(t("teamBuilder.back"), "ghost"),
    nameInput,
    countLabel,
    el("div", "tb-topbar-spacer"),
    topbarButton(t("teamBuilder.showdown")),
    topbarButton(t("teamBuilder.clearAll"), "danger"),
  );

  const slotsRow = new SlotCardsRow({
    onSlotClick: (index) => {
      activeSlotIndex = index;
      render();
    },
    onSlotClear: noop,
  });

  const leftPanel = new EditLeftPanel({
    onAbilityChange: noop,
    onItemChange: noop,
    onNatureChange: noop,
    onMoveChange: noop,
    onSetOpApply: noop,
    onGenderChange: noop,
  });
  const rightPanel = new EditRightPanel({ onSpChange: noop, onPresetApply: noop });

  const editGrid = el("div", "tb-edit-grid");
  editGrid.append(leftPanel.element, rightPanel.element);

  const content = el("div", "tb-content");
  content.append(slotsRow.element, editGrid);
  root.append(topbar, content);

  function render(): void {
    const slots: Array<TeamSlot | undefined> = [];
    for (let index = 0; index < 6; index++) {
      slots.push(team.slots[index]);
    }
    slotsRow.render(slots, activeSlotIndex);
    countLabel.textContent = t("teamBuilder.slotCount").replace(
      "{count}",
      String(team.slots.length),
    );
    const activeSlot = team.slots[activeSlotIndex];
    if (activeSlot !== undefined) {
      leftPanel.render(activeSlot);
      rightPanel.render(activeSlot);
    }
  }

  render();

  return {
    element: root,
    destroy: () => {
      leftPanel.destroy();
      root.remove();
    },
  };
}
