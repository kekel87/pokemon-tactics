import type { BattleEvent } from "@pokemon-tactic/core";
import type { BattleFeedback } from "@pokemon-tactic/view-core";
import {
  type BattleLogContext,
  type BattleLogEntry,
  formatBattleEvent,
} from "./BattleLogFormatter.js";
import type { UiDomConfig } from "./config.js";
import { el } from "./dom-helpers.js";

/**
 * BattleLog — DOM/CSS battle log panel (plan 121 step
 * 4b-4). Collapsible panel, top-right, that formats each battle event through
 * the shared `formatBattleEvent` and appends a coloured line (team dot on the
 * first referenced Pokémon). Implements the orchestrator's `BattleFeedback`
 * port (`report`), replacing the 4a no-op. Native scroll, `aria-live` polite.
 */

/** Cap the DOM line count. */
const MAX_LOG_ENTRIES = 50;

/**
 * Replay transport controls (first / rewind / play / forward / last).
 * Disabled for now — placeholders for the future battle replay feature.
 */
const REPLAY_BUTTONS: readonly { label: string; aria: string }[] = [
  { label: "|◁", aria: "Début" },
  { label: "◁◁", aria: "Reculer" },
  { label: "▷", aria: "Lecture" },
  { label: "▷▷", aria: "Avancer" },
  { label: "▷|", aria: "Fin" },
];

export interface BattleLogOptions {
  /** Name/language resolvers for `formatBattleEvent`. */
  context: BattleLogContext;
  /** Instance id → 1-based team index (for the line's team-colour dot), or null. */
  teamOf: (pokemonId: string) => number | null;
  /** Localise the panel title (host-injected, plan 125 Phase 4). */
  translate: UiDomConfig["translate"];
}

export interface BattleLog extends BattleFeedback {
  readonly element: HTMLElement;
  destroy(): void;
}

export function createBattleLog(options: BattleLogOptions): BattleLog {
  const { context, teamOf, translate } = options;

  const root = el("div", "bl-panel", "battle-log");
  root.dataset.collapsed = "true";

  const header = el("button", "bl-header", "battle-log-toggle");
  header.type = "button";
  const title = el("span", "bl-title", "battle-log-title");
  title.textContent = translate("log.title");
  const burger = el("span", "bl-burger");
  burger.textContent = "☰";
  burger.setAttribute("aria-hidden", "true");
  header.append(title, burger);

  const list = el("ol", "bl-list");
  list.setAttribute("aria-live", "polite");

  // Replay transport bar (disabled placeholders — future replay feature).
  const actions = el("div", "bl-actions");
  for (const { label, aria } of REPLAY_BUTTONS) {
    const button = el("button", "bl-replay-btn");
    button.type = "button";
    button.textContent = label;
    button.disabled = true;
    button.setAttribute("aria-label", aria);
    actions.append(button);
  }

  root.append(header, list, actions);

  const setCollapsed = (collapsed: boolean): void => {
    root.dataset.collapsed = String(collapsed);
    header.setAttribute("aria-expanded", String(!collapsed));
  };
  setCollapsed(true);
  header.addEventListener("click", () => setCollapsed(root.dataset.collapsed !== "true"));

  function appendEntry(entry: BattleLogEntry): void {
    const item = el("li", "bl-entry");
    // Runtime color from the formatter (data-driven per entry) — no CSS equivalent.
    item.style.color = entry.color;

    const firstPokemonId = entry.pokemonIds[0];
    const team = firstPokemonId ? teamOf(firstPokemonId) : null;
    if (team !== null) {
      const dot = el("span", "bl-dot");
      dot.dataset.team = String(team);
      item.append(dot);
    }

    const text = el("span", "bl-text", "battle-log-entry");
    text.textContent = entry.message;
    item.append(text);

    list.append(item);
    while (list.childElementCount > MAX_LOG_ENTRIES) {
      list.firstElementChild?.remove();
    }
    list.scrollTop = list.scrollHeight;
  }

  return {
    element: root,
    report: (event: BattleEvent) => {
      const result = formatBattleEvent(event, context);
      if (!result) {
        return;
      }
      if (Array.isArray(result)) {
        for (const entry of result) {
          appendEntry(entry);
        }
      } else {
        appendEntry(result);
      }
    },
    destroy: () => root.remove(),
  };
}
