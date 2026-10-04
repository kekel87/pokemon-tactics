import { el } from "./dom-helpers.js";

/**
 * InfoTooltip (plan 225) — the bubble that says what a talent, a held item, a status, the weather or
 * a tile zone DOES. Retour de Frank (2026-09-30) : il voyait « Engrais » ou « Restes » sans pouvoir
 * apprendre ce que ça fait.
 *
 * Generic on purpose, and separate from the move tooltip: an element opts in by carrying its text in
 * `data-describe` (see `setDescription`), and the three ways in all read that same attribute — the
 * mouse hovers it, a finger taps it, and the keyboard / gamepad steps onto it in inspect mode. A
 * panel therefore never knows which device is reading it.
 */

/** Space between the bubble and the element it explains, in CSS pixels. */
const ANCHOR_GAP_PX = 6;

/**
 * Opt `target` in (or out, with no description): its tooltip shows `title` over `description`. A
 * blank description opts out rather than opening an empty bubble.
 */
export function setDescription(
  target: HTMLElement,
  title: string,
  description: string | undefined,
): void {
  if (description) {
    target.dataset.describe = description;
    target.dataset.describeTitle = title;
  } else {
    delete target.dataset.describe;
    delete target.dataset.describeTitle;
  }
}

/** The described elements of `root` actually on screen, in DOM order — the inspect-mode stops. */
export function describedWithin(root: HTMLElement): HTMLElement[] {
  if (root.hidden) {
    return [];
  }
  // The root itself counts: a HUD (weather, Vent Arrière) is described as a whole.
  const self = root.matches("[data-describe]") ? [root] : [];
  return [...self, ...root.querySelectorAll<HTMLElement>("[data-describe]")].filter(
    (element) => element.getClientRects().length > 0,
  );
}

export interface InfoTooltip {
  /** Explain `target` — it must carry a description (`setDescription`). */
  show(target: HTMLElement): void;
  hide(): void;
  /** The element currently explained, null while hidden. */
  current(): HTMLElement | null;
}

/**
 * @param host the positioned layer the bubble is placed in.
 * @param roots the areas whose described elements answer hover and tap; a tap anywhere else closes.
 * @param signal ends the listening — the document-level listener would otherwise outlive the screen.
 */
export function createInfoTooltip(
  host: HTMLElement,
  roots: readonly HTMLElement[],
  signal: AbortSignal,
): InfoTooltip {
  const root = el("div", "it-tooltip", "info-tooltip");
  root.hidden = true;
  root.setAttribute("role", "tooltip");
  const title = el("div", "it-title", "info-tooltip-title");
  const text = el("div", "it-text", "info-tooltip-text");
  root.append(title, text);
  host.append(root);

  let shown: HTMLElement | null = null;

  /** Above the target when it fits, below otherwise; centred on it and kept inside the host. */
  function place(target: HTMLElement): void {
    const hostRect = host.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const bubbleRect = root.getBoundingClientRect();
    const above = targetRect.top - hostRect.top - bubbleRect.height - ANCHOR_GAP_PX;
    const top = above >= 0 ? above : targetRect.bottom - hostRect.top + ANCHOR_GAP_PX;
    const centred = targetRect.left - hostRect.left + (targetRect.width - bubbleRect.width) / 2;
    const left = Math.max(0, Math.min(centred, hostRect.width - bubbleRect.width));
    root.style.translate = `${Math.round(left)}px ${Math.round(top)}px`;
  }

  function show(target: HTMLElement): void {
    shown?.classList.remove("it-anchor");
    shown = target;
    target.classList.add("it-anchor");
    title.textContent = target.dataset.describeTitle ?? "";
    text.textContent = target.dataset.describe ?? "";
    root.hidden = false;
    place(target);
  }

  function hide(): void {
    shown?.classList.remove("it-anchor");
    shown = null;
    root.hidden = true;
  }

  const describedAt = (eventTarget: EventTarget | null): HTMLElement | null =>
    eventTarget instanceof Element ? eventTarget.closest<HTMLElement>("[data-describe]") : null;

  for (const area of roots) {
    // Mouse only: a finger fires `pointerover` too, and the tap below already handles it.
    area.addEventListener(
      "pointerover",
      (event) => {
        const target = describedAt(event.target);
        // `pointerover` bubbles from every child: re-showing the same bubble would only re-layout.
        if (event.pointerType === "mouse" && target && target !== shown) {
          show(target);
        }
      },
      { signal },
    );
    area.addEventListener(
      "pointerout",
      (event) => {
        if (event.pointerType !== "mouse" || shown === null) {
          return;
        }
        if (!(event.relatedTarget instanceof Node) || !shown.contains(event.relatedTarget)) {
          hide();
        }
      },
      { signal },
    );
  }
  // No hover at the finger: a tap opens, a second tap on the same element or a tap elsewhere
  // closes, a tap on another element switches. Capture phase on the document, so a tap on the
  // board closes the bubble before the board reacts to it.
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType === "mouse") {
        return;
      }
      const target = describedAt(event.target);
      const inArea = target !== null && roots.some((area) => area.contains(target));
      if (inArea && target !== shown) {
        show(target);
      } else if (shown !== null) {
        hide();
      }
    },
    { signal, capture: true },
  );

  return { show, hide, current: () => shown };
}
