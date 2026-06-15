/**
 * Internal DOM helpers shared by the ui-dom components (plan 125 polish). Keeps
 * the `document.createElement` boilerplate in one place instead of a per-file copy.
 */

/** Create an element, optionally assigning a class name. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  return node;
}
