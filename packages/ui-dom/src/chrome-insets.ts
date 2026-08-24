/*
 * Measures the first cell of the turn timeline (plan 183).
 *
 * The compass is a scene mesh, so it is placed by pixel arithmetic while everything around it is DOM
 * laid out by flex. Left to its own constants it drifted: it sat behind the timeline, then floated in
 * the void, then moved whenever its size changed. The fix is to stop guessing — it takes its size AND
 * its anchor from the timeline's first portrait, so the two are level and equally sized at any stage
 * size, with no breakpoint and no magic multiplier.
 *
 * Lives in ui-dom because it is a DOM measurement; the renderer only ever receives numbers.
 */

/**
 * Gap between the timeline's right edge and whatever the renderer pins beside it (CSS px).
 *
 * Exported because the control legend (plan 185) leaves the SAME gap under the compass, in CSS: one
 * constant for both, so the DOM gap and the mesh gap cannot drift apart.
 */
export const CHROME_CLEARANCE_PX = 6;

/** Geometry of the timeline's first portrait, in CSS px relative to the stage box. */
export interface TimelineFirstCell {
  /** Right edge — what the renderer pins its own left edge against (clearance included). */
  readonly rightPx: number;
  /** Top edge — what the renderer lines its own top edge up with. */
  readonly topPx: number;
  /** Side of the (square) portrait: the on-screen size the renderer should match. */
  readonly sizePx: number;
}

export interface ChromeInsetProbe {
  /** Null until the chrome mounts (the scene is built first) or if the timeline is hidden. */
  firstCell(): TimelineFirstCell | null;
  /**
   * Called whenever the measurement changes. What the DOM consumers need and the renderer does not:
   * the renderer re-reads `firstCell()` every rendered frame anyway, while a DOM element must be
   * told to move — and being told beats polling in a `requestAnimationFrame` loop of its own.
   */
  subscribe(listener: (cell: TimelineFirstCell) => void): () => void;
  dispose(): void;
}

/**
 * Watch the timeline's first portrait and cache its geometry. Cached rather than measured on demand:
 * the caller reads this every rendered frame, and a `getBoundingClientRect` per frame would force a
 * layout each time.
 */
export function createChromeInsetProbe(stage: HTMLElement): ChromeInsetProbe {
  let cell: TimelineFirstCell | null = null;
  let observed: Element | null = null;
  const listeners = new Set<(cell: TimelineFirstCell) => void>();

  const measure = (element: Element): void => {
    const stageBox = stage.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    // Zero mid-mount (or while hidden): keep the last good value rather than snapping the compass
    // to a corner for a frame.
    if (box.width > 0 && box.height > 0) {
      cell = {
        rightPx: box.right - stageBox.left + CHROME_CLEARANCE_PX,
        topPx: box.top - stageBox.top,
        sizePx: box.height,
      };
      for (const listener of listeners) {
        listener(cell);
      }
    }
  };

  const observer = new ResizeObserver(() => {
    if (observed) {
      measure(observed);
    }
  });

  /**
   * Find the element to watch, if it is there yet. The chrome mounts after the scene, so this is
   * retried until it lands — then never again, the observer keeping the measurement fresh from then
   * on. First child of the timeline is the active slot, which shrink-wraps the portrait; the timeline
   * itself reserves a scrollbar gutter for its list and reads wider.
   */
  const ensureObserved = (): void => {
    if (observed) {
      return;
    }
    const found = stage.querySelector('[data-testid="timeline"]')?.firstElementChild;
    if (found) {
      observed = found;
      observer.observe(found);
      measure(found);
    }
  };

  let pollHandle: number | null = null;
  /**
   * Retry the lookup until a measurement lands. Only for the SUBSCRIBERS: the renderer calls
   * `firstCell()` every rendered frame and so retries on its own, while a DOM consumer would
   * otherwise wait forever for a first value (the timeline is appended after the legend, and reads
   * 0×0 until it is in the document).
   */
  const poll = (): void => {
    pollHandle = null;
    ensureObserved();
    if (cell === null) {
      pollHandle = requestAnimationFrame(poll);
    }
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      if (cell) {
        listener(cell);
      } else if (pollHandle === null) {
        poll();
      }
      return () => listeners.delete(listener);
    },
    firstCell: () => {
      ensureObserved();
      return cell;
    },
    dispose: () => {
      if (pollHandle !== null) {
        cancelAnimationFrame(pollHandle);
      }
      listeners.clear();
      observer.disconnect();
    },
  };
}
