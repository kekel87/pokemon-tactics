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
    }
  };

  const observer = new ResizeObserver(() => {
    if (observed) {
      measure(observed);
    }
  });

  return {
    firstCell: () => {
      // The chrome mounts after the scene, so the lookup is retried until it lands — then never
      // again, because from that point the observer keeps the measurement fresh.
      if (!observed) {
        // First child of the timeline is the active slot, which shrink-wraps the portrait — unlike
        // the timeline itself, whose scrolling list reserves a scrollbar gutter and reads wider.
        const found = stage.querySelector('[data-testid="timeline"]')?.firstElementChild;
        if (found) {
          observed = found;
          observer.observe(found);
          measure(found);
        }
      }
      return cell;
    },
    dispose: () => observer.disconnect(),
  };
}
