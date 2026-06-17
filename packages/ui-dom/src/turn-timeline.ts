import type { TimelineEntryView, TimelineView } from "@pokemon-tactic/view-core";
import type { UiDomConfig } from "./config.js";
import { el } from "./dom-helpers.js";

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
  update(view: TimelineView): void;
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
  portrait.src = config.getPortraitUrl(entry.definitionId);
  node.append(portrait);

  return node;
}

export function createTurnTimeline(config: UiDomConfig): TurnTimeline {
  const root = el("div", "tt-timeline", "timeline");
  root.hidden = true;
  const activeSlot = el("div", "tt-active");
  const list = el("ol", "tt-list");
  root.append(activeSlot, list);

  return {
    element: root,
    update: (view: TimelineView) => {
      root.dataset.ct = String(view.showCtBars);
      activeSlot.replaceChildren();
      list.replaceChildren();

      if (view.entries.length === 0) {
        root.hidden = true;
        return;
      }
      root.hidden = false;

      const fragment = document.createDocumentFragment();
      for (const entry of view.entries) {
        if (entry.isActive) {
          activeSlot.append(entryElement(entry, view.showCtBars, config));
        } else {
          fragment.append(entryElement(entry, view.showCtBars, config));
        }
      }
      list.append(fragment);
    },
    destroy: () => root.remove(),
  };
}
