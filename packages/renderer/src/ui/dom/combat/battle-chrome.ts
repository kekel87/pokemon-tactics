import { TurnSystemKind } from "@pokemon-tactic/core";
import { getMoveName, getPokemonName } from "@pokemon-tactic/data";
import type {
  ActionMenuView,
  AttackSubmenuMoveView,
  AttackSubmenuView,
  BattleChrome,
  BattleInstruction,
  SelectedMoveView,
  TurnInfoView,
} from "../../../game/battle-orchestrator.js";
import type { InfoPanelData, TimelineView, WeatherView } from "../../../game/battle-views.js";
import { getLanguage, t } from "../../../i18n/index.js";
import type { TranslationKey } from "../../../i18n/types.js";
import { getTypeIconUrl } from "../../../team/asset-paths.js";
import { createInfoPanel } from "../info-panel.js";
import { createMoveTooltip } from "./move-tooltip.js";
import { createTurnTimeline } from "./turn-timeline.js";
import { createWeatherHud } from "./weather-hud.js";

const INSTRUCTION_KEY: Readonly<Record<BattleInstruction, TranslationKey>> = {
  selectTarget: "attack.selectTarget",
  confirm: "attack.confirm",
  selectRetreat: "attack.selectRetreat",
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

/** Battle instance id ("p1-pikachu") → definition id ("pikachu") for name/portrait lookup. */
function definitionIdOf(pokemonId: string): string {
  return pokemonId.replace(/^p\d+-/, "");
}

/** "player-2" → "battle.player2" label key. */
function playerLabel(playerId: string): string {
  const number = playerId.match(/player-(\d+)/)?.[1] ?? "1";
  return t(number === "2" ? "battle.player2" : "battle.player1");
}

export interface BattleChromeOptions {
  /** DOM layer over the canvas (game-stage screenLayer). */
  host: HTMLElement;
  /** Leave the combat (victory "back to menu"). */
  onExit: () => void;
  /** Restart the same combat (victory "replay" — internal re-mount, not an FSM transition). */
  onReplay: () => void;
}

/**
 * DOM battle chrome (plan 121 step 4b) — the screen-anchored half of the combat
 * UI (décision #487): turn banner, action menu + attack submenu (type icons, PP/
 * CT, Provoc/Entrave/Encore block tags), move tooltip on hover, instruction line,
 * info panel, weather HUD and victory dialog. Ports the Phaser `ActionMenu` /
 * `MoveTooltip`. World-anchored feedback (path tweens, floating text) is 4c.
 */
export function createBattleChrome(options: BattleChromeOptions): BattleChrome {
  const { host, onExit, onReplay } = options;
  const language = getLanguage();

  const root = el("div", "bc-root");
  // Top-centre stack: the turn banner with the weather HUD directly beneath it, so
  // the two never overlap (they were both top-centred and collided before).
  const top = el("div", "bc-top");
  const banner = el("div", "bc-turn");
  const weatherHud = createWeatherHud();
  top.append(banner, weatherHud.element);

  const bottom = el("div", "bc-bottom");
  const tooltip = createMoveTooltip();
  const menuColumn = el("div", "bc-menu-col");
  const instruction = el("div", "bc-instruction");
  instruction.hidden = true;
  const menu = el("div", "bc-menu");
  menuColumn.append(instruction, menu);
  bottom.append(tooltip.element, menuColumn);
  root.append(top, bottom);
  host.appendChild(root);

  // Left column (top→bottom): the turn timeline shrinks to leave room for the info
  // panel pinned at the bottom, so the timeline reacts to the panel instead of
  // overlapping it. All removed with the overlay on teardown (stage.dispose removes
  // the whole subtree).
  const infoPanel = createInfoPanel();
  const timeline = createTurnTimeline();
  const leftColumn = el("div", "bc-left-col");
  leftColumn.append(timeline.element, infoPanel.element);
  host.append(leftColumn);

  // Last round seen (for the victory message, which only gets the winner id).
  let lastRound = 1;

  function button(label: string, onClick: () => void, disabled = false): HTMLButtonElement {
    const node = el("button", "tb-btn bc-btn");
    node.type = "button";
    node.textContent = label;
    node.disabled = disabled;
    node.addEventListener("click", onClick);
    return node;
  }

  /** A move row in the attack submenu: type icon + name + PP (Round-Robin only). */
  function moveRow(
    move: AttackSubmenuMoveView,
    turnSystemKind: TurnSystemKind,
    onSelect: () => void,
  ): HTMLButtonElement {
    const enabled = move.currentPp > 0 && move.hasTargets;
    const row = el("button", "bc-move-item");
    row.type = "button";
    row.dataset.enabled = String(enabled);
    if (!enabled) {
      row.setAttribute("aria-disabled", "true");
    }
    if (move.blockedTag) {
      row.dataset.blocked = move.blockedTag;
    }

    const icon = el("img", "bc-move-type");
    icon.alt = move.definition.type;
    icon.loading = "lazy";
    icon.decoding = "async";
    icon.src = getTypeIconUrl(move.definition.type);

    const name = el("span", "bc-move-name");
    name.textContent = getMoveName(move.definition.id, language);
    row.append(icon, name);

    if (turnSystemKind !== TurnSystemKind.ChargeTime) {
      const pp = el("span", "bc-move-pp");
      pp.textContent = `${move.currentPp}/${move.definition.pp}`;
      row.append(pp);
    }

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
      lastRound = info.roundNumber;
      const name = getPokemonName(definitionIdOf(info.activePokemonId), language);
      banner.textContent = `${name} — ${t("battle.round", { round: info.roundNumber })}`;
    },

    showActionMenu: (view: ActionMenuView) => {
      tooltip.hide();
      instruction.hidden = true;
      const first = view.canUndoMove
        ? button(t("action.undoMove"), view.onUndoMove)
        : button(t("action.move"), view.onMove, !view.canMove);
      menu.replaceChildren(
        first,
        button(t("action.attack"), view.onAttack, !view.canAct),
        button(t("action.item"), () => undefined, true),
        button(t("action.wait"), view.onWait),
        button(t("action.status"), () => undefined, true),
      );
    },

    showAttackSubmenu: (view: AttackSubmenuView) => {
      tooltip.hide();
      instruction.hidden = true;
      const list = el("div", "bc-move-list");
      for (const move of view.moves) {
        list.append(moveRow(move, view.turnSystemKind, () => view.onSelect(move.definition.id)));
      }
      menu.replaceChildren(list, button(t("action.cancel"), view.onCancel));
    },

    showSelectedMove: (move: SelectedMoveView, key: BattleInstruction) => {
      tooltip.hide();
      const header = el("div", "bc-selected-move");
      const icon = el("img", "bc-move-type");
      icon.alt = move.definition.type;
      icon.loading = "lazy";
      icon.decoding = "async";
      icon.src = getTypeIconUrl(move.definition.type);
      const name = el("span", "bc-move-name");
      name.textContent = getMoveName(move.definition.id, language);
      header.append(icon, name);
      if (move.turnSystemKind !== TurnSystemKind.ChargeTime) {
        const pp = el("span", "bc-move-pp");
        pp.textContent = `${move.currentPp}/${move.definition.pp}`;
        header.append(pp);
      }
      menu.replaceChildren(header);
      instruction.hidden = false;
      instruction.textContent = t(INSTRUCTION_KEY[key]);
    },

    updateInstruction: (key: BattleInstruction) => {
      instruction.hidden = false;
      instruction.textContent = t(INSTRUCTION_KEY[key]);
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

    showVictory: (winnerId: string) => {
      const dialog = el("dialog", "bc-victory");
      const heading = document.createElement("h2");
      heading.textContent = playerLabel(winnerId);
      const message = el("p", "bc-victory-message");
      message.textContent = t("battle.wins", { player: playerLabel(winnerId), round: lastRound });
      const replay = button(t("battle.restart"), () => {
        dialog.close();
        onReplay();
      });
      const exit = button(t("battle.backToMenu"), () => {
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
