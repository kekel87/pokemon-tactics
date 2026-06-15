/**
 * Internal DOM helpers shared by the ui-dom components (plan 125 polish). Keeps
 * the `document.createElement` boilerplate in one place instead of a per-file copy.
 */

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
