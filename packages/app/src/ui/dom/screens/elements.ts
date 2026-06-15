/**
 * Shared DOM helpers for FSM menu screens (plan 120 step 2).
 * Screens are plain full-viewport DOM (no Babylon canvas); buttons reuse the
 * `.tb-btn` component with the `.mn-btn` size override (menu-screens.css).
 */

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

export function menuButton(label: string, action?: () => void): HTMLButtonElement {
  const button = el("button", "tb-btn mn-btn");
  button.type = "button";
  button.textContent = label;
  if (action) {
    button.addEventListener("click", action);
  } else {
    button.disabled = true;
  }
  return button;
}

/**
 * Binds Escape to a back action; returns the unbind to call from dispose().
 * Ignored while a modal dialog is open — Escape must only close the dialog.
 */
export function bindEscape(action: () => void): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && document.querySelector("dialog[open]") === null) {
      action();
    }
  };
  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}
