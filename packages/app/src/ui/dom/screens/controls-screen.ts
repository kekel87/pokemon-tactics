import type { Navigate, Screen } from "../../../app/screen-manager";
import { t } from "../../../i18n";
import type { TranslationKey } from "../../../i18n/types";
import {
  acceptsGamepadBinding,
  BINDING_SLOTS,
  type BindingCell,
  type CapturedInput,
  GAMEPAD_AXIS_ACTIONS,
  GAMEPAD_GESTURE_ACTIONS,
  getBindings,
  isFixedAction,
  type KeyBinding,
  type RemappableAction,
} from "../../../input/bindings-store";
import { SCROLL_MODIFIER_BUTTON } from "../../../input/gamepad-source";
import { InputSource } from "../../../input/input-source";
import { getInputSystem } from "../../../input/input-system";
import { keyCharacter } from "../../../input/key-legend";
import { LogicalAction } from "../../../input/logical-action";
import { getSettings, updateSettings } from "../../../settings";
import { bindScreenInput, el, menuButton } from "./elements";

/**
 * Écran de contrôles (plan 186).
 *
 * Deux rôles pour un seul écran : réassigner, et **lister**. La majorité des joueurs ne changeront
 * rien — ils viennent voir ce que le jeu accepte, ce que rien n'annonçait jusqu'ici en dehors de la
 * légende caméra du plan 185. D'où les lignes non remappables affichées plutôt que masquées.
 *
 * **Une seule table à trois colonnes** — Principal, Secondaire, Manette (retour humain 2026-08-25).
 * Deux onglets par appareil demandaient au joueur de deviner où regarder et laissaient les deux
 * grilles dériver l'une de l'autre ; ici l'alignement est structurel.
 */

interface ControlGroup {
  readonly titleKey: TranslationKey;
  readonly actions: readonly RemappableAction[];
}

/**
 * Sections dans l'ordre où on en a besoin (retours humains 2026-08-25) :
 *   - « Prévisualisation AoE » est à part : ses deux touches ne choisissent pas la CIBLE d'une
 *     attaque, elles choisissent lequel des Pokemon touchés par une zone affiche ses dégâts ;
 *   - Zoom est fondu dans Caméra, qui est le sujet ;
 *   - « Ordre de jeu » et « Journal de combat » se séparent : le premier se lit à chaque tour, le
 *     second se consulte après coup, et ils n'ont plus les mêmes touches par défaut.
 */
const GROUPS: readonly ControlGroup[] = [
  {
    titleKey: "controls.group.cursor",
    actions: [
      LogicalAction.CursorUp,
      LogicalAction.CursorDown,
      LogicalAction.CursorLeft,
      LogicalAction.CursorRight,
      LogicalAction.Confirm,
      LogicalAction.Cancel,
    ],
  },
  {
    // Section à part (retour humain 2026-08-25) : ces deux touches ne choisissent pas la cible d'une
    // attaque, elles choisissent lequel des Pokemon touchés par une zone affiche ses dégâts.
    titleKey: "controls.group.aoePreview",
    actions: [LogicalAction.CycleTargetNext, LogicalAction.CycleTargetPrevious],
  },
  {
    titleKey: "controls.group.camera",
    actions: [
      LogicalAction.RotateCameraLeft,
      LogicalAction.RotateCameraRight,
      LogicalAction.ZoomIn,
      LogicalAction.ZoomOut,
      LogicalAction.ZoomLevel1,
      LogicalAction.ZoomLevel2,
      LogicalAction.ZoomLevel3,
    ],
  },
  {
    titleKey: "controls.group.turnOrder",
    actions: [LogicalAction.ScrollTimelineUp, LogicalAction.ScrollTimelineDown],
  },
  {
    titleKey: "controls.group.battleLog",
    actions: [
      LogicalAction.ToggleBattleLog,
      LogicalAction.ScrollLogUp,
      LogicalAction.ScrollLogDown,
    ],
  },
];

/** Noms de boutons en *mapping standard* W3C — du matériel, pas de la traduction. */
const PAD_BUTTON_NAMES: Readonly<Record<number, string>> = {
  0: "A",
  1: "B",
  2: "X",
  3: "Y",
  4: "LB",
  5: "RB",
  6: "LT",
  7: "RT",
  8: "Select",
  9: "Start",
  10: "L3",
  11: "R3",
  12: "↑",
  13: "↓",
  14: "←",
  15: "→",
  16: "Guide",
};

/** Positions dont le nom se traduit ; ailleurs on dessine le caractère de la touche. */
const NAMED_KEYS: readonly string[] = [
  "Space",
  "Enter",
  "Escape",
  "Tab",
  "PageUp",
  "PageDown",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
];

const padButtonName = (index: number): string => PAD_BUTTON_NAMES[index] ?? String(index);

/**
 * Le défilement des panneaux se fait au **maintien** d'un bouton + une direction : ce n'est ni un
 * bouton seul ni un axe seul, donc rien à remapper — mais tout à annoncer, puisque rien ne le disait
 * jusqu'ici (retour humain 2026-08-25).
 */
const PAD_GESTURE_DIRECTION: Readonly<Record<string, string>> = {
  [LogicalAction.ScrollLogUp]: "↑",
  [LogicalAction.ScrollLogDown]: "↓",
  [LogicalAction.ScrollTimelineUp]: "←",
  [LogicalAction.ScrollTimelineDown]: "→",
};

const actionLabel = (action: RemappableAction): string =>
  t(`controls.action.${action}` as TranslationKey);

/** Ce qu'on écrit dans une case clavier. Du texte, pas une tuile : aucune contrainte de feuille. */
function keyText(binding: KeyBinding): string {
  let label = NAMED_KEYS.includes(binding.code)
    ? t(`controls.key.${binding.code}` as TranslationKey)
    : keyCharacter(binding.code);
  if (label === "" && binding.code.startsWith("Numpad")) {
    label = t("controls.key.numpad", { value: binding.code.slice("Numpad".length) });
  }
  if (label === "") {
    label = binding.code;
  }
  return binding.shift ? t("controls.modifier.shift", { key: label }) : label;
}

export function createControlsScreen(navigate: Navigate): Screen<"controls"> {
  const bindings = getBindings();
  let root: HTMLElement | null = null;
  let unbindScreenInput: (() => void) | null = null;
  let cancelCapture: (() => void) | null = null;
  let capturing: { action: RemappableAction; cell: BindingCell } | null = null;
  let message: HTMLElement | null = null;
  let captureBar: HTMLElement | null = null;
  let stickToggle: HTMLButtonElement | null = null;
  const cells = new Map<string, HTMLButtonElement>();

  // Retour vers RÉGLAGES, d'où l'on vient — pas vers le menu principal : un écran atteint depuis un
  // autre doit y ramener, sinon `Échap` éjecte le joueur de deux niveaux d'un coup.
  const goBack = (): void => navigate("settings", undefined);
  const cellId = (action: RemappableAction, cell: BindingCell): string => `${action}#${cell}`;

  /**
   * Un slot vide n'a pas toujours le même sens (décision 15) : la plupart des actions n'ont jamais
   * eu de secondaire, et les peindre en rouge donnerait un écran couvert d'alertes au premier
   * lancement. Seule une case **vidée par un échange** alerte.
   */
  const refreshCell = (action: RemappableAction, cell: BindingCell): void => {
    const button = cells.get(cellId(action, cell));
    if (!button) {
      return;
    }
    if (capturing?.action === action && capturing.cell === cell) {
      button.textContent = t("controls.capture.pending");
      button.dataset.state = "capturing";
      return;
    }

    if (cell === "pad") {
      // À la manette, le curseur est un axe (croix + stick) et les crans de zoom absolus n'existent
      // pas : ces lignes annoncent au lieu de proposer.
      if (GAMEPAD_AXIS_ACTIONS.includes(action)) {
        button.textContent = t("controls.padAxis");
        button.dataset.state = "fixed";
        button.disabled = true;
        return;
      }
      if (GAMEPAD_GESTURE_ACTIONS.includes(action)) {
        button.textContent = `${padButtonName(SCROLL_MODIFIER_BUTTON)} + ${PAD_GESTURE_DIRECTION[action] ?? ""}`;
        button.dataset.state = "fixed";
        button.disabled = true;
        return;
      }
      if (!acceptsGamepadBinding(action)) {
        const fixedButton = bindings.gamepadButton(action);
        button.textContent =
          fixedButton === null ? t("controls.empty") : padButtonName(fixedButton);
        button.dataset.state = "fixed";
        button.disabled = true;
        return;
      }
      const index = bindings.gamepadButton(action);
      button.disabled = false;
      button.textContent = index === null ? t("controls.empty") : padButtonName(index);
      button.dataset.state =
        index === null
          ? bindings.isDisplaced(action, cell)
            ? "displaced"
            : "empty"
          : bindings.isCustomised(action, cell)
            ? "custom"
            : "bound";
      return;
    }

    const binding = bindings.keyBinding(action, cell);
    if (isFixedAction(action)) {
      button.textContent = binding === null ? "" : keyText(binding);
      button.dataset.state = "fixed";
      button.disabled = true;
      return;
    }
    button.disabled = false;
    button.textContent = binding === null ? t("controls.empty") : keyText(binding);
    button.dataset.state =
      binding === null
        ? bindings.isDisplaced(action, cell)
          ? "displaced"
          : "empty"
        : bindings.isCustomised(action, cell)
          ? "custom"
          : "bound";
  };

  const eachCell = (visit: (action: RemappableAction, cell: BindingCell) => void): void => {
    for (const group of GROUPS) {
      for (const action of group.actions) {
        for (const slot of BINDING_SLOTS) {
          visit(action, slot);
        }
        visit(action, "pad");
      }
    }
  };

  const refreshAll = (): void => eachCell(refreshCell);

  const showMessage = (text: string): void => {
    if (message) {
      message.textContent = text;
    }
  };

  const endCapture = (): void => {
    const previous = capturing;
    capturing = null;
    cancelCapture = null;
    captureBar?.toggleAttribute("hidden", true);
    if (previous) {
      refreshCell(previous.action, previous.cell);
    }
  };

  const startCapture = (action: RemappableAction, cell: BindingCell): void => {
    const system = getInputSystem();
    if (!system || isFixedAction(action)) {
      return;
    }
    cancelCapture?.();
    capturing = { action, cell };
    showMessage("");
    if (captureBar) {
      captureBar.toggleAttribute("hidden", false);
      captureBar.dataset.device = cell === "pad" ? "pad" : "key";
    }
    refreshCell(action, cell);

    const sink = (captured: CapturedInput | null): void => {
      if (captured === null) {
        endCapture();
        return;
      }
      const result = bindings.assign(action, cell, captured);
      if (result.status === "wrong-device") {
        // Un bouton pressé dans une case clavier (ou l'inverse) : on ne va pas écrire en douce dans
        // la colonne d'à côté. La capture reste ouverte, le joueur presse ce qu'il visait.
        cancelCapture = system.beginCapture(sink);
        return;
      }
      const captureKey =
        captured.kind === "key" ? keyText(captured) : padButtonName(captured.index);
      endCapture();
      if (result.status === "assigned" && result.displaced) {
        showMessage(
          t("controls.swapped", {
            key: captureKey,
            action: actionLabel(result.displaced.action),
          }),
        );
      }
      refreshAll();
    };
    cancelCapture = system.beginCapture(sink);
  };

  const buildCell = (action: RemappableAction, cell: BindingCell): HTMLButtonElement => {
    const button = el("button", "ct-cell");
    button.type = "button";
    button.dataset.testid = `control-${action}-${cell}`;
    if (cell !== "pad") {
      // Une manette ne peut pas écrire dans une colonne clavier : elle ne s'y arrête donc pas
      // (retour humain 2026-08-25). Au clavier, ces cases restent parfaitement navigables.
      button.dataset.navSkip = InputSource.Gamepad;
    }
    button.addEventListener("click", () => startCapture(action, cell));
    cells.set(cellId(action, cell), button);
    return button;
  };

  /**
   * Le stick droit n'est pas un binding mais une préférence : il panote déjà, la seule question est
   * son SENS. `panCamera` parle le langage d'un glissé (on tire le plateau) et un stick celui d'un
   * regard (je pousse à droite, je regarde à droite) — les deux sont opposés, et le bon défaut
   * dépend du joueur (retour humain 2026-08-25).
   */
  const buildStickRow = (): HTMLElement => {
    const row = el("div", "ct-grid ct-grid-toggle");
    const label = el("span", "ct-action");
    label.textContent = t("controls.invertRightStick");
    const spacer = el("span", "ct-cell-void");
    const spacerSecondary = el("span", "ct-cell-void");
    stickToggle = menuButton(
      getSettings().invertRightStick ? t("settings.on") : t("settings.off"),
      () => {
        updateSettings({ invertRightStick: !getSettings().invertRightStick });
        if (stickToggle) {
          stickToggle.textContent = getSettings().invertRightStick
            ? t("settings.on")
            : t("settings.off");
        }
      },
    );
    stickToggle.classList.add("ct-cell", "ct-cell-toggle");
    stickToggle.dataset.testid = "control-invert-right-stick";
    row.append(label, spacer, spacerSecondary, stickToggle);
    return row;
  };

  const buildGroup = (group: ControlGroup): HTMLElement => {
    const section = el("section", "ct-group");
    const heading = el("h2", "ct-group-title");
    heading.textContent = t(group.titleKey);

    const reset = menuButton(t("controls.resetSection"), () => {
      cancelCapture?.();
      bindings.resetActions(group.actions);
      showMessage("");
      refreshAll();
    });
    reset.classList.add("ct-reset");

    const head = el("div", "ct-group-head");
    head.append(heading, reset);

    const grid = el("div", "ct-grid");
    for (const action of group.actions) {
      const label = el("span", "ct-action");
      label.textContent = actionLabel(action);
      grid.append(label);
      for (const slot of BINDING_SLOTS) {
        grid.append(buildCell(action, slot));
      }
      grid.append(buildCell(action, "pad"));
    }
    section.append(head, grid);
    if (group.titleKey === "controls.group.camera") {
      section.append(buildStickRow());
    }
    return section;
  };

  const render = (host: HTMLElement): void => {
    root?.remove();
    cells.clear();
    root = el("div", "mn-screen ct-screen");

    const title = el("h1", "mn-title");
    title.textContent = t("controls.title");

    const columns = el("div", "ct-grid ct-columns");
    const head = (key: TranslationKey): HTMLElement => {
      const cell = el("span", "ct-column-head");
      cell.textContent = t(key);
      return cell;
    };
    columns.append(
      el("span", "ct-column-head"),
      head("controls.column.primary"),
      head("controls.column.secondary"),
      head("controls.column.gamepad"),
    );

    const groups = el("div", "ct-groups");
    groups.append(...GROUPS.map(buildGroup));

    message = el("p", "ct-message", "controls-message");
    message.setAttribute("role", "status");

    // Le bouton « Annuler » est la SEULE sortie de capture d'un joueur sans clavier ni manette
    // (décision 16) : sans lui, un doigt curieux reste bloqué sur « Appuyez sur une touche ».
    captureBar = el("div", "ct-capture", "controls-capture");
    const captureText = el("span", "ct-capture-text");
    captureText.textContent = t("controls.capture.key");
    const capturePadText = el("span", "ct-capture-text ct-capture-text-pad");
    capturePadText.textContent = t("controls.capture.pad");
    const captureCancel = menuButton(t("controls.capture.cancel"), () => cancelCapture?.());
    captureCancel.classList.add("ct-capture-cancel");
    captureCancel.dataset.testid = "controls-capture-cancel";
    captureBar.append(captureText, capturePadText, captureCancel);
    captureBar.toggleAttribute("hidden", true);

    const footer = el("div", "ct-footer");
    const resetAll = menuButton(t("controls.resetAll"), () => {
      cancelCapture?.();
      bindings.reset();
      // L'inversion du stick est affichée dans cette table : « Tout réinitialiser » doit la rendre
      // aussi, même si elle vit dans `pt-settings` et non dans `pt-bindings` (revue 2026-08-25).
      updateSettings({ invertRightStick: false });
      if (stickToggle) {
        stickToggle.textContent = t("settings.off");
      }
      showMessage("");
      refreshAll();
    });
    resetAll.dataset.testid = "controls-reset-all";
    const back = menuButton(t("controls.back"), goBack);
    footer.append(resetAll, back);

    root.append(title, columns, groups, message, captureBar, footer);
    host.append(root);
    refreshAll();
  };

  return {
    mount(host) {
      render(host);
      unbindScreenInput = bindScreenInput(goBack);
    },
    dispose() {
      cancelCapture?.();
      cancelCapture = null;
      unbindScreenInput?.();
      unbindScreenInput = null;
      root?.remove();
      root = null;
      message = null;
      captureBar = null;
      stickToggle = null;
      cells.clear();
    },
  };
}
