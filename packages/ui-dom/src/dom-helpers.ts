/**
 * Internal DOM helpers shared by the ui-dom components (plan 125 polish). Keeps
 * the `document.createElement` boilerplate in one place instead of a per-file copy.
 */

/**
 * Fraction of a scroll container's height one keyboard / gamepad scroll step covers (plan 184).
 * Less than a full page so the reader keeps a couple of lines of context across a step.
 */
const SCROLL_STEP_RATIO = 0.6;

/**
 * Scroll a container by one step (plan 184). The battle log and the CT timeline only scrolled by
 * wheel and drag, and neither is focusable — so without this a keyboard or gamepad player never saw
 * past the first screenful of either.
 */
export function scrollByStep(container: HTMLElement, delta: 1 | -1): void {
  container.scrollBy({ top: delta * container.clientHeight * SCROLL_STEP_RATIO });
}

/** Create an element, optionally assigning a class name and a `data-testid` (e2e locator hook —
 *  the resilient, role-agnostic handle Playwright recommends when no semantic role/text fits). */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  testId?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (testId) {
    node.dataset.testid = testId;
  }
  return node;
}
