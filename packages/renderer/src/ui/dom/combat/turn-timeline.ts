import type { TimelineEntryView, TimelineView } from "../../../game/battle-views.js";
import { getPortraitUrl } from "../../../team/team-builder-data.js";

/**
 * TurnTimeline — DOM/CSS port of the Phaser `ui/TurnTimeline.ts` (plan 121 step
 * 4b-3). Vertical strip on the left: the active Pokémon pinned on top, then the
 * upcoming order (predicted Charge-Time sequence, or the round order in
 * Round-Robin with a next-round separator). Scrolls natively (overflow). Pure
 * view: takes a `TimelineView` and renders it.
 *
 * Deferred to 4b-5: the move-CT preview highlight/scroll shown while picking a
 * target (Phaser's `scrollToHighlight`), which depends on the selected move.
 */

export interface TurnTimeline {
  readonly element: HTMLElement;
  update(view: TimelineView): void;
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

function entryElement(entry: TimelineEntryView, showCtBars: boolean): HTMLElement {
  const node = el("li", "tt-entry");
  node.dataset.team = String(entry.team);
  if (entry.isActive) {
    node.dataset.active = "true";
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

  const portrait = el("img", "tt-portrait");
  portrait.alt = "";
  portrait.loading = "lazy";
  portrait.decoding = "async";
  portrait.src = getPortraitUrl(entry.definitionId);
  node.append(portrait);

  return node;
}

export function createTurnTimeline(): TurnTimeline {
  const root = el("div", "tt-timeline");
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
        if (entry.separatorRound !== null) {
          const separator = el("li", "tt-separator");
          separator.textContent = String(entry.separatorRound);
          fragment.append(separator);
        }
        if (entry.isActive) {
          activeSlot.append(entryElement(entry, view.showCtBars));
        } else {
          fragment.append(entryElement(entry, view.showCtBars));
        }
      }
      list.append(fragment);
    },
    destroy: () => root.remove(),
  };
}
