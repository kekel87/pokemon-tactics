import { CT_TEMPO_MAX } from "@pokemon-tactic/core";
import { getMoveName, getPokemonName } from "@pokemon-tactic/data";
import type {
  ActionMenuView,
  AttackSubmenuMoveView,
  AttackSubmenuView,
  BattleChrome,
  BattleInstruction,
  InfoPanelData,
  SelectedMoveView,
  TimelineView,
  TurnInfoView,
  WeatherView,
} from "@pokemon-tactic/view-core";
import type { UiDomConfig } from "./config.js";
import { el } from "./dom-helpers.js";
import { createInfoPanel } from "./info-panel.js";
import { createMoveTooltip } from "./move-tooltip.js";
import { createTurnTimeline } from "./turn-timeline.js";
import { createWeatherHud } from "./weather-hud.js";

const INSTRUCTION_KEY: Readonly<Record<BattleInstruction, string>> = {
  selectTarget: "attack.selectTarget",
  confirm: "attack.confirm",
  selectRetreat: "attack.selectRetreat",
};

/** Battle instance id ("p1-pikachu") → definition id ("pikachu") for name/portrait lookup. */
function definitionIdOf(pokemonId: string): string {
  return pokemonId.replace(/^p\d+-/, "");
}

/** "player-2" → "battle.player2" label key. */
function playerLabel(playerId: string, config: UiDomConfig): string {
  const number = playerId.match(/player-(\d+)/)?.[1] ?? "1";
  return config.translate(number === "2" ? "battle.player2" : "battle.player1");
}

export interface BattleChromeOptions {
  /** DOM layer over the canvas (game-stage screenLayer). */
  host: HTMLElement;
  /** Leave the combat (victory "back to menu"). */
  onExit: () => void;
  /** Restart the same combat (victory "replay" — internal re-mount, not an FSM transition). */
  onReplay: () => void;
  /** Host-injected i18n / asset-path deps (plan 125 Phase 4). */
  config: UiDomConfig;
}

/**
 * DOM battle chrome (plan 121 step 4b) — the screen-anchored half of the combat
 * UI (décision #487): turn banner, action menu + attack submenu (type icons, PP/
 * CT, Provoc/Entrave/Encore block tags), move tooltip on hover, instruction line,
 * info panel, weather HUD and victory dialog. World-anchored feedback (path
 * tweens, floating text) is 4c.
 */
export function createBattleChrome(options: BattleChromeOptions): BattleChrome {
  const { host, onExit, onReplay, config } = options;
  const language = config.getLanguage();

  const root = el("div", "bc-root");
  // Top-centre stack: the turn banner with the weather HUD directly beneath it, so
  // the two never overlap (they were both top-centred and collided before).
  const top = el("div", "bc-top");
  const banner = el("div", "bc-turn", "combat-turn");
  const weatherHud = createWeatherHud(config);
  top.append(banner, weatherHud.element);

  const bottom = el("div", "bc-bottom");
  const tooltip = createMoveTooltip(config);
  const menuColumn = el("div", "bc-menu-col");
  const instruction = el("div", "bc-instruction", "combat-instruction");
  instruction.hidden = true;
  const menu = el("div", "bc-menu", "action-menu");
  menuColumn.append(instruction, menu);
  bottom.append(tooltip.element, menuColumn);
  root.append(top, bottom);
  host.appendChild(root);

  // Left column (top→bottom): the turn timeline shrinks to leave room for the info
  // panel pinned at the bottom, so the timeline reacts to the panel instead of
  // overlapping it. All removed with the overlay on teardown (stage.dispose removes
  // the whole subtree).
  const infoPanel = createInfoPanel();
  const timeline = createTurnTimeline(config);
  const leftColumn = el("div", "bc-left-col");
  leftColumn.append(timeline.element, infoPanel.element);
  host.append(leftColumn);

  function button(label: string, onClick: () => void, disabled = false): HTMLButtonElement {
    const node = el("button", "tb-btn bc-btn");
    node.type = "button";
    node.textContent = label;
    node.disabled = disabled;
    node.addEventListener("click", onClick);
    return node;
  }

  /** A move row in the attack submenu: type icon + name. */
  function moveRow(move: AttackSubmenuMoveView, onSelect: () => void): HTMLButtonElement {
    const enabled = move.hasTargets;
    const row = el("button", "bc-move-item", "move-item");
    row.type = "button";
    row.dataset.enabled = String(enabled);
    if (!enabled) {
      row.setAttribute("aria-disabled", "true");
    }
    if (move.blockedTag) {
      row.dataset.blocked = move.blockedTag;
    }

    const icon = el("img", "bc-move-type", "move-type-icon");
    icon.alt = move.definition.type;
    icon.loading = "lazy";
    icon.decoding = "async";
    icon.src = config.getTypeIconUrl(move.definition.type);

    const name = el("span", "bc-move-name", "move-name");
    name.textContent = getMoveName(move.definition.id, language);

    // Charge Time "tempo": filled pips = how heavy this move's CT cost is (heavier → act again later).
    const tempo = el("span", "bc-move-tempo", "move-tempo");
    tempo.dataset.tempo = String(move.costTempo);
    tempo.textContent =
      "●".repeat(move.costTempo) + "○".repeat(Math.max(0, CT_TEMPO_MAX - move.costTempo));
    tempo.setAttribute("role", "img");
    tempo.setAttribute("aria-label", `Tempo ${move.costTempo}/${CT_TEMPO_MAX}`);
    row.append(icon, name, tempo);

    // Tooltip on hover/focus — shown for usable moves AND blocked ones (to explain why).
    if (enabled || move.blockedTag !== undefined) {
      const open = (): void => tooltip.show(move.definition, move.blockedTag);
      row.addEventListener("pointerenter", open);
      row.addEventListener("focus", open);
      row.addEventListener("pointerleave", () => tooltip.hide());
      row.addEventListener("blur", () => tooltip.hide());
    }
    if (enabled) {
      row.addEventListener("click", () => {
        tooltip.hide();
        onSelect();
      });
    }
    return row;
  }

  return {
    updateTurnInfo: (info: TurnInfoView) => {
      const name = getPokemonName(definitionIdOf(info.activePokemonId), language);
      banner.textContent = name;
    },

    showActionMenu: (view: ActionMenuView) => {
      tooltip.hide();
      instruction.hidden = true;
      const first = view.canUndoMove
        ? button(config.translate("action.undoMove"), view.onUndoMove)
        : button(config.translate("action.move"), view.onMove, !view.canMove);
      menu.replaceChildren(
        first,
        button(config.translate("action.attack"), view.onAttack, !view.canAct),
        button(config.translate("action.item"), () => undefined, true),
        button(config.translate("action.wait"), view.onWait),
        button(config.translate("action.status"), () => undefined, true),
      );
    },

    showAttackSubmenu: (view: AttackSubmenuView) => {
      tooltip.hide();
      instruction.hidden = true;
      const list = el("div", "bc-move-list");
      for (const move of view.moves) {
        list.append(moveRow(move, () => view.onSelect(move.definition.id)));
      }
      menu.replaceChildren(list, button(config.translate("action.cancel"), view.onCancel));
    },

    showSelectedMove: (move: SelectedMoveView, key: BattleInstruction) => {
      tooltip.hide();
      const header = el("div", "bc-selected-move");
      const name = el("span", "bc-move-name");
      // Move-copy (plan 144): a masked called move hides its identity — "???" and no type icon.
      if (move.masked === true) {
        name.textContent = "???";
        header.append(name);
      } else {
        const icon = el("img", "bc-move-type");
        icon.alt = move.definition.type;
        icon.loading = "lazy";
        icon.decoding = "async";
        icon.src = config.getTypeIconUrl(move.definition.type);
        name.textContent = getMoveName(move.definition.id, language);
        header.append(icon, name);
      }
      menu.replaceChildren(header);
      instruction.hidden = false;
      instruction.textContent = config.translate(INSTRUCTION_KEY[key]);
    },

    updateInstruction: (key: BattleInstruction) => {
      instruction.hidden = false;
      instruction.textContent = config.translate(INSTRUCTION_KEY[key]);
    },

    hideMenus: () => {
      tooltip.hide();
      menu.replaceChildren();
      instruction.hidden = true;
    },

    updateInfoPanel: (view: InfoPanelData | null) => {
      if (view) {
        infoPanel.update(view);
      } else {
        infoPanel.hide();
      }
    },

    updateWeather: (view: WeatherView | null) => weatherHud.update(view),

    updateTimeline: (view: TimelineView) => timeline.update(view),

    showVictory: (winnerId: string | null) => {
      const dialog = el("dialog", "bc-victory");
      const heading = document.createElement("h2");
      heading.textContent =
        winnerId === null ? config.translate("battle.draw") : playerLabel(winnerId, config);
      const message = el("p", "bc-victory-message");
      message.textContent =
        winnerId === null
          ? config.translate("battle.drawMessage")
          : config.translate("battle.wins", {
              player: playerLabel(winnerId, config),
            });
      const replay = button(config.translate("battle.restart"), () => {
        dialog.close();
        onReplay();
      });
      const exit = button(config.translate("battle.backToMenu"), () => {
        dialog.close();
        onExit();
      });
      const actions = el("div", "bc-victory-actions");
      actions.append(replay, exit);
      dialog.append(heading, message, actions);
      root.appendChild(dialog);
      dialog.showModal();
    },
  };
}
