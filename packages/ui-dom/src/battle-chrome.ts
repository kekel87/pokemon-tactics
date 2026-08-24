import { CT_TEMPO_MAX } from "@pokemon-tactic/core";
import { getMoveName, getPokemonName, getTypeName } from "@pokemon-tactic/data";
import type {
  ActionMenuView,
  AttackSubmenuMoveView,
  AttackSubmenuView,
  BattleChrome,
  BattleInstruction,
  InfoPanelData,
  SelectedMoveView,
  TailwindView,
  TileInfoData,
  TimelineView,
  TurnInfoView,
  WeatherView,
} from "@pokemon-tactic/view-core";
import type { UiDomConfig } from "./config.js";
import { createControlLegend } from "./control-legend.js";
import { el } from "./dom-helpers.js";
import { createInfoPanel } from "./info-panel.js";
import { createInputPromptGlyph, INSTRUCTION_GLYPH } from "./input-prompt-glyph.js";
import { createMoveTooltip } from "./move-tooltip.js";
import { createTailwindHud } from "./tailwind-hud.js";
import { createTileInfoPanel } from "./tile-info-panel.js";
import { createTurnTimeline } from "./turn-timeline.js";
import { createWeatherHud } from "./weather-hud.js";

const INSTRUCTION_KEY: Readonly<Record<BattleInstruction, string>> = {
  selectTarget: "attack.selectTarget",
  aimDirection: "attack.aimDirection",
  confirm: "attack.confirm",
  selectRetreat: "attack.selectRetreat",
  selectMoveDestination: "move.selectDestination",
  selectDirection: "move.selectDirection",
};

/**
 * Battle instance id → definition id for name/portrait lookup. Handles both id shapes:
 * `p1-pikachu` (placement path) and `p1-m0-pikachu` (sandbox multi-member teams).
 */
function definitionIdOf(pokemonId: string): string {
  return pokemonId.replace(/^p\d+-(?:m\d+-)?/, "");
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
  /**
   * Should a freshly-rebuilt menu take the focus? (plan 184) The app answers from the active input
   * source: yes on keyboard / gamepad — every phase calls `replaceChildren`, which drops the focus to
   * `<body>`, so navigation would restart from nothing at each step of a turn — but no at the
   * pointer, where a focus ring appearing under an idle mouse reads as a bug.
   */
  shouldAutoFocusMenu?: () => boolean;
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
  const shouldAutoFocusMenu = options.shouldAutoFocusMenu ?? ((): boolean => false);
  const language = config.getLanguage();

  const root = el("div", "bc-root");
  // Top-centre stack: the turn banner with the weather HUD directly beneath it, so
  // the two never overlap (they were both top-centred and collided before).
  const top = el("div", "bc-top");
  const banner = el("div", "bc-turn", "combat-turn");
  const weatherHud = createWeatherHud(config);
  const tailwindHud = createTailwindHud(config);
  top.append(banner, weatherHud.element, tailwindHud.element);

  const bottom = el("div", "bc-bottom");
  const tooltip = createMoveTooltip(config);
  const menuColumn = el("div", "bc-menu-col");
  // The pill is the ROW, not the text node: the glyph sits inside it while `combat-instruction`
  // stays a text-only element, so the ~13 e2e `toHaveText` assertions on it keep matching.
  const instructionRow = el("div", "bc-instruction-row");
  instructionRow.hidden = true;
  const instructionGlyph = createInputPromptGlyph(config);
  const instruction = el("div", "bc-instruction", "combat-instruction");
  instructionRow.append(instructionGlyph.element, instruction);
  const menu = el("div", "bc-menu", "action-menu");
  menuColumn.append(instructionRow, menu);
  bottom.append(tooltip.element, menuColumn);
  root.append(top, bottom);
  host.appendChild(root);

  /** Focusable entries of the menu as shown, in DOM order (disabled ones are not focus stops). */
  function menuControls(): HTMLElement[] {
    return [...menu.querySelectorAll<HTMLElement>("button:not(:disabled)")];
  }

  /**
   * Re-focus after a rebuild of a NAVIGABLE menu (the action menu, the attack list). Those two call
   * `menu.replaceChildren(...)`, which drops the focus to `<body>` — harmless with a mouse, but it
   * means keyboard and gamepad navigation restarts from nothing on every step of a turn.
   *
   * ⚠️ Deliberately NOT called by the board phases (`showSelectedMove`,
   * `showCancellableInstruction`): there the arrows drive the BOARD, and focusing the lone
   * « Annuler » promised an action Space was not going to take (retour humain 2026-08-21). Gating it
   * on the input context instead would have been fragile — the chrome is rendered BEFORE the phase
   * switches (`battle-orchestrator.ts` sets `inputState` after calling `showSelectedMove`), so the
   * context still read `menu` at that instant. The rule is structural: focus follows the arrows.
   */
  function restoreMenuFocus(): void {
    if (!shouldAutoFocusMenu()) {
      return;
    }
    menuControls()[0]?.focus();
  }

  /** Text + expected gesture always move together — one call per instruction change. */
  function showInstruction(key: BattleInstruction): void {
    instructionRow.hidden = false;
    instruction.textContent = config.translate(INSTRUCTION_KEY[key]);
    instructionGlyph.update(INSTRUCTION_GLYPH[key]);
  }

  // Left column (top→bottom): the turn timeline shrinks to leave room for the info
  // panel pinned at the bottom, so the timeline reacts to the panel instead of
  // overlapping it. All removed with the overlay on teardown (stage.dispose removes
  // the whole subtree).
  const infoPanel = createInfoPanel();
  // Second, narrower panel (plan 177) to the right of the Pokémon panel: terrain + tile modifiers.
  // Both sit in a bottom-pinned row so the tile panel stretches to the InfoPanel's height.
  const tileInfoPanel = createTileInfoPanel();
  // Combat preview (plan 175): two more cards sharing the tile panel's slot — while an attack is
  // being confirmed the arrow + target cards take over and the tile panel steps aside, forming the
  // FFT triptych [attacker InfoPanel] ▷ [attack] ▷ [target]. Never both at once.
  // Cursor card: the SAME component as the left panel (human 2026-07-25), showing whatever the
  // cursor is over — and, during a confirm, the focused target with its forecast layered in.
  const cursorPanel = createInfoPanel("cursor-panel");
  const infoPanelRow = el("div", "bc-infopanel-row");
  infoPanelRow.append(infoPanel.element, tileInfoPanel.element, cursorPanel.element);
  const timeline = createTurnTimeline(config);
  // Camera legend (plan 185): an absolute child of the timeline's stable active slot, because the
  // compass is pinned to that slot's right edge — so "under the compass" needs no measurement.
  // Absolute is load-bearing: a static child would grow the slot's box, which the compass measures.
  timeline.activeSlotAnchor.append(createControlLegend(config).element);
  const leftColumn = el("div", "bc-left-col");
  leftColumn.append(timeline.element, infoPanelRow);
  host.append(leftColumn);

  function button(label: string, onClick: () => void, disabled = false): HTMLButtonElement {
    const node = el("button", "tb-btn bc-btn");
    node.type = "button";
    node.textContent = label;
    node.disabled = disabled;
    node.addEventListener("click", onClick);
    return node;
  }

  /**
   * « Annuler », prefixed with the key that does the same thing (plan 184, retour humain
   * 2026-08-21). Échap and B cancel too, and nothing said so — while a focus ring on this very button
   * was reading as "Space will cancel". A glyph states the binding instead of a highlight implying
   * the wrong one. CSS shows it only for the source in use.
   */
  function cancelButton(onClick: () => void): HTMLButtonElement {
    const node = button(config.translate("action.cancel"), onClick);
    const glyph = el("span", "bc-btn-key");
    glyph.setAttribute("aria-hidden", "true");
    glyph.style.setProperty("--bc-glyph-sheet", `url("${config.getInputPromptSheetUrl()}")`);
    node.prepend(glyph);
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
    icon.alt = getTypeName(move.definition.type, language);
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
      const open = (): void => tooltip.show(move);
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
      instructionRow.hidden = true;
      // « Annuler le déplacement » va EN DERNIER, sous « Attendre » (retour humain 2026-08-21) :
      // placé en tête, il occupait le premier arrêt de focus — donc celui qu'un Espace ou un A
      // atteint sans viser — et le joueur annulait son déplacement sans le vouloir. La première
      // entrée reste « Déplacement », grisée quand on a déjà bougé, pour que l'ordre du menu ne
      // change pas d'un tour à l'autre.
      menu.replaceChildren(
        button(config.translate("action.move"), view.onMove, !view.canMove),
        button(config.translate("action.attack"), view.onAttack, !view.canAct),
        button(config.translate("action.item"), () => undefined, true),
        button(config.translate("action.wait"), view.onWait),
        button(config.translate("action.status"), () => undefined, true),
        ...(view.canUndoMove ? [button(config.translate("action.undoMove"), view.onUndoMove)] : []),
      );
      restoreMenuFocus();
    },

    showAttackSubmenu: (view: AttackSubmenuView) => {
      tooltip.hide();
      instructionRow.hidden = true;
      const list = el("div", "bc-move-list");
      for (const move of view.moves) {
        list.append(moveRow(move, () => view.onSelect(move.definition.id)));
      }
      menu.replaceChildren(list, cancelButton(view.onCancel));
      restoreMenuFocus();
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
        icon.alt = getTypeName(move.definition.type, language);
        icon.loading = "lazy";
        icon.decoding = "async";
        icon.src = config.getTypeIconUrl(move.definition.type);
        name.textContent = getMoveName(move.definition.id, language);
        header.append(icon, name);
      }
      // Cancel sits under the locked-in move, mirroring the attack submenu's own button (plan 183):
      // Escape is the only other way out and does not exist on a touch screen.
      menu.replaceChildren(header, cancelButton(move.onCancel));
      showInstruction(key);
    },

    showCancellableInstruction: (key: BattleInstruction, onCancel: () => void) => {
      tooltip.hide();
      menu.replaceChildren(cancelButton(onCancel));
      showInstruction(key);
    },

    updateInstruction: (key: BattleInstruction) => {
      showInstruction(key);
    },

    hideMenus: () => {
      tooltip.hide();
      menu.replaceChildren();
      instructionRow.hidden = true;
    },

    updateInfoPanel: (view: InfoPanelData | null) => {
      if (view) {
        infoPanel.update(view);
      } else {
        infoPanel.hide();
      }
    },

    updateTileInfo: (view: TileInfoData | null) => {
      if (view) {
        tileInfoPanel.update(view);
      } else {
        tileInfoPanel.hide();
      }
    },

    updateCursorPanel: (view: InfoPanelData | null) => {
      if (view) {
        cursorPanel.update(view);
      } else {
        cursorPanel.hide();
      }
    },

    updateWeather: (view: WeatherView | null) => weatherHud.update(view),
    updateTailwind: (view: TailwindView | null) => tailwindHud.update(view),
    updateCameraAzimuth: (azimuth: number) => tailwindHud.setAzimuth(azimuth),

    updateTimeline: (view: TimelineView) => timeline.update(view),

    focusMenuStep: (delta) => {
      const controls = menuControls();
      if (controls.length === 0) {
        return;
      }
      const index = controls.indexOf(document.activeElement as HTMLElement);
      // Nothing focused yet (first arrow press of the turn): enter the menu at its top when
      // stepping down, at its bottom when stepping up.
      const next =
        index === -1
          ? delta > 0
            ? 0
            : controls.length - 1
          : (index + delta + controls.length) % controls.length;
      controls[next]?.focus();
    },
    isMenuFocused: () =>
      document.activeElement !== null && menu.contains(document.activeElement as Node),
    activateFocusedMenuItem: () => {
      const focused = menuControls().find((control) => control === document.activeElement);
      if (!focused) {
        return false;
      }
      focused.click();
      return true;
    },
    scrollTimeline: (delta) => timeline.scrollByStep(delta),

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
