import type { TimelineEntryView, TimelineView } from "@pokemon-tactic/view-core";
import type { UiDomConfig } from "./config.js";
import { el, scrollByStep } from "./dom-helpers.js";

/**
 * TurnTimeline — DOM/CSS turn timeline (plan 121 step
 * 4b-3). Vertical strip on the left: the active Pokémon pinned on top, then the
 * upcoming order (predicted Charge-Time sequence, or the round order in
 * Round-Robin with a next-round separator). Scrolls natively (overflow). Pure
 * view: takes a `TimelineView` and renders it.
 *
 * Deferred to 4b-5: the move-CT preview highlight/scroll shown while picking a
 * target (`scrollToHighlight`), which depends on the selected move.
 */

export interface TurnTimeline {
  readonly element: HTMLElement;
  /**
   * Stable box around the active slot — never emptied by `update`, and the element the compass
   * measures (`chrome-insets.ts`). What the chrome anchors the control legend to (plan 185): the
   * compass is pinned to this box's right edge, so "under the compass" is expressible in CSS alone.
   */
  readonly activeSlotAnchor: HTMLElement;
  update(view: TimelineView): void;
  /** Step the predicted-order list (keyboard / gamepad, plan 184 — it only scrolled by wheel). */
  scrollByStep(delta: 1 | -1): void;
  destroy(): void;
}

function entryElement(
  entry: TimelineEntryView,
  showCtBars: boolean,
  config: UiDomConfig,
): HTMLElement {
  const node = el("li", "tt-entry", "timeline-entry");
  node.dataset.team = String(entry.team);
  if (entry.isActive) {
    node.dataset.active = "true";
  }
  if (entry.isSelf) {
    // Move-cost preview: highlight where the deciding mon slots back in after acting.
    node.dataset.self = "true";
  }
  if (entry.dimmed) {
    node.dataset.dimmed = "true";
  }

  if (showCtBars && entry.ctRatio !== null) {
    const bar = el("div", "tt-ctbar");
    const fill = el("div", "tt-ctfill");
    // Runtime ratio → CSS var (no static-CSS equivalent); height derives from it.
    fill.style.setProperty("--tt-ct", String(entry.ctRatio));
    bar.append(fill);
    node.append(bar);
  }

  const portrait = el("img", "tt-portrait", "timeline-portrait");
  portrait.alt = "";
  portrait.loading = "lazy";
  portrait.decoding = "async";
  // Species id as a stable data attribute: portraits are now cropped data URLs from the
  // bundle sheet (plan 135), so the src no longer carries the id. Tests + any consumer that
  // needs to identify a timeline slot key off this, not the URL.
  portrait.dataset.pokemonId = entry.definitionId;
  portrait.src = config.getPortraitUrl(entry.definitionId);
  node.append(portrait);

  return node;
}

export function createTurnTimeline(config: UiDomConfig): TurnTimeline {
  const root = el("div", "tt-timeline", "timeline");
  root.hidden = true;
  // Two boxes, not one: `activeSlot` is the STABLE host (it is what `chrome-insets` observes and
  // what the control legend hangs off), while `activePortrait` is the part rebuilt every turn.
  // Before plan 185 the rebuild happened on `activeSlot` itself, so any extra child of it was
  // destroyed at the first turn.
  const activeSlot = el("div", "tt-active");
  const activePortrait = el("div", "tt-active-portrait");
  activeSlot.append(activePortrait);
  const list = el("ol", "tt-list");
  root.append(activeSlot, list);

  return {
    element: root,
    activeSlotAnchor: activeSlot,
    update: (view: TimelineView) => {
      root.dataset.ct = String(view.showCtBars);
      activePortrait.replaceChildren();
      list.replaceChildren();

      if (view.entries.length === 0) {
        root.hidden = true;
        return;
      }
      root.hidden = false;

      const fragment = document.createDocumentFragment();
      for (const entry of view.entries) {
        if (entry.isActive) {
          activePortrait.append(entryElement(entry, view.showCtBars, config));
        } else {
          fragment.append(entryElement(entry, view.showCtBars, config));
        }
      }
      list.append(fragment);
    },
    scrollByStep: (delta) => scrollByStep(list, delta),
    destroy: () => root.remove(),
  };
}
