import type { MapFormat, PlayerController } from "@pokemon-tactic/core";
import { buildTelemetryTeams } from "../../../analytics/team-telemetry";
import { countScreen, TelemetryScreen } from "../../../analytics/telemetry";
import type { Navigate, Screen } from "../../../app/screen-manager";
import { t } from "../../../i18n";
import { loadTiledMap } from "../../../maps/load-tiled-map";
import {
  buildFormatKey,
  createFormatPickerElement,
  type FormatOption,
  formatLabel,
} from "../../team-select/FormatPicker";
import {
  createPlayersColumnElement,
  type PlayerColumnEntry,
} from "../../team-select/PlayersColumn";
import {
  assignTeamToSlot,
  buildInitialSlots,
  buildTeamSelections,
  playerLabel,
  playerShortLabel,
  type SlotState,
  setSlotController,
  teamColorToHex,
} from "../../team-select/slot-state";
import { openTeamPickerModal } from "../../team-select/TeamPickerModal";
import { renderPreservingFocus } from "../preserve-focus";
import { bindScreenInput, el } from "./elements";

/**
 * DOM port of TeamSelectScene (plan 120 step 4), refondu au plan 188.
 *
 * Un camp par carte, en une seule colonne : le format est une rangée de segments toujours lue
 * (décision #830), le contrôle un segment à deux états visibles (#831), et l'équipe se choisit dans
 * une modale ouverte par la carte (#832) — ce qui supprime la notion de « camp actif », un second
 * curseur qui pouvait contredire le focus à l'écran.
 *
 * Lancer confie tout le `CombatSetup` à l'écran de combat, qui déroule la phase de placement.
 */
export function createTeamSelectScreen(navigate: Navigate): Screen<"team-select"> {
  let root: HTMLElement | null = null;
  let unbindScreenInput: (() => void) | null = null;
  let mapUrl = "";
  let mapName = "";
  /**
   * Formats de la carte, SANS leur libellé : celui-ci dépend de la langue et se relit au rendu
   * (`buildHeader`). Le stocker le figerait dans la locale d'entrée d'écran — c'est précisément le
   * bug corrigé côté `formatLabel`, et le champ n'aurait aucun lecteur.
   */
  let formatOptions: Omit<FormatOption, "label">[] = [];
  let formatKey = "";
  let slots: SlotState[] = [];
  let autoPlacement = true;

  const goBack = (): void => navigate("map-select", undefined);

  const currentFormat = (): MapFormat => {
    const option = formatOptions.find((candidate) => candidate.key === formatKey);
    if (!option) {
      throw new Error(`Unknown format key: ${formatKey}`);
    }
    return option.format;
  };

  const isLaunchable = (): boolean => slots.every((slot) => slot.assignedTeam !== null);

  const onLaunch = (): void => {
    if (!isLaunchable()) {
      return;
    }
    const teams = buildTeamSelections(slots);
    if (teams === null) {
      return;
    }
    navigate("combat", {
      mapUrl,
      setup: { teams, formatKey, autoPlacement, telemetryTeams: buildTelemetryTeams(slots) },
    });
  };

  const setController = (slotIndex: number, controller: PlayerController): void => {
    const slot = slots[slotIndex];
    if (slot && setSlotController(slot, controller)) {
      render();
    }
  };

  const chooseTeam = (slotIndex: number): void => {
    openTeamPickerModal({
      slotIndex,
      playerLabel: playerLabel(slotIndex),
      assignedTeamIdsBySlot: slots.map((slot) => slot.assignedTeamId),
      onPick: (teamId) => assignTeam(slotIndex, teamId),
    });
  };

  const assignTeam = (slotIndex: number, teamId: string | null): void => {
    const slot = slots[slotIndex];
    if (!slot || !assignTeamToSlot(slot, slotIndex, teamId)) {
      return;
    }
    render();
    focusNextUnassigned(slotIndex);
  };

  /**
   * Après une assignation RÉUSSIE, le focus va au premier camp encore vide (décision #834).
   *
   * Écart assumé à la convention `<dialog>` (« le focus revient au déclencheur ») : #832 a supprimé
   * l'avance automatique de camp que faisait l'ancienne liste centrale, et sans compensation
   * configurer 12 camps à la main doublerait le nombre de gestes. La convention vise la modale
   * refermée sans rien faire — ici l'action a abouti et a déplacé le travail d'un cran. Une sortie
   * par `Échap`, par B ou par la croix ne passe pas ici, donc rend bien le focus au déclencheur.
   */
  const focusNextUnassigned = (fromSlotIndex: number): void => {
    const nextIndex = slots.findIndex(
      (slot, index) => index > fromSlotIndex && slot.assignedTeam === null,
    );
    const targetIndex = nextIndex === -1 ? fromSlotIndex : nextIndex;
    root
      ?.querySelector<HTMLElement>(
        `[data-testid="player-team-button"][data-slot-index="${targetIndex}"]`,
      )
      ?.focus();
  };

  const onFormatChange = (key: string): void => {
    if (key !== formatKey) {
      formatKey = key;
      slots = buildInitialSlots(currentFormat());
      render();
    }
  };

  const buildHeader = (): HTMLElement => {
    const header = el("header", "ts-header");

    const back = el("button", "tb-btn");
    back.type = "button";
    back.dataset.variant = "ghost";
    back.textContent = t("teamSelect.actions.back");
    back.addEventListener("click", goBack);

    const title = el("h2", "ts-header-title");
    title.textContent = `${t("teamSelect.title")} — ${mapName}`;

    const picker = createFormatPickerElement(
      // Le libellé est assemblé ici, jamais stocké : il dépend de la langue courante. Garde de
      // code, pas un cas de recette — aucun écran de préparation ne porte de bascule de langue
      // aujourd'hui (elle vit au menu principal, dans les Réglages et dans le menu de combat).
      formatOptions.map((option) => ({ ...option, label: formatLabel(option.format) })),
      formatKey,
      t("teamSelect.format.label"),
      { onChange: onFormatChange },
    );

    header.append(back, title, picker);
    return header;
  };

  const buildPlayerEntry = (slotIndex: number, slot: SlotState): PlayerColumnEntry => ({
    props: {
      slotIndex,
      playerLabel: playerLabel(slotIndex),
      shortLabel: playerShortLabel(slotIndex),
      colorHex: teamColorToHex(slotIndex),
      controller: slot.controller,
      assignedTeam: slot.assignedTeam,
      ephemeral: slot.ephemeral,
      labels: {
        controllerHuman: t("teamSelect.controller.human"),
        controllerAi: t("teamSelect.controller.ai"),
        chooseTeam: t("teamSelect.players.choose"),
      },
    },
    callbacks: {
      onChooseTeam: () => chooseTeam(slotIndex),
      onSetController: (controller) => setController(slotIndex, controller),
    },
  });

  /** Les cartes de camp — `PlayersColumn` décide seul d'une ou deux colonnes selon leur nombre. */
  const buildMain = (): HTMLElement => {
    const main = el("main", "ts-main");
    const entries = slots.map((slot, index) => buildPlayerEntry(index, slot));
    main.append(createPlayersColumnElement(entries));
    return main;
  };

  const buildFooter = (): HTMLElement => {
    const footer = el("footer", "ts-footer");

    const autoLabel = el("label", "ts-footer-toggle");
    const autoInput = document.createElement("input");
    autoInput.type = "checkbox";
    autoInput.checked = autoPlacement;
    autoInput.addEventListener("change", () => {
      autoPlacement = autoInput.checked;
    });
    const autoText = document.createElement("span");
    autoText.textContent = t("teamSelect.autoPlacement.label");
    autoLabel.append(autoInput, autoText);

    const spacer = el("div", "ts-footer-spacer");

    const launch = el("button", "tb-btn");
    launch.type = "button";
    launch.dataset.variant = "primary";
    launch.textContent = t("teamSelect.actions.launch");
    launch.disabled = !isLaunchable();
    launch.addEventListener("click", onLaunch);

    footer.append(autoLabel, spacer, launch);
    return footer;
  };

  const render = (): void => {
    if (!root) {
      return;
    }
    // Le re-rendu reconstruit tout le sous-arbre, ce qui éjecterait le focus vers `<body>` à chaque
    // appui sur un segment (`.claude/rules/html.md`). Le helper partagé retrouve le contrôle par son
    // adresse logique — il a d'abord été écrit ici, puis extrait quand le retour humain a montré que
    // le problème était général au Team Builder.
    const host = root;
    renderPreservingFocus(host, () => {
      host.replaceChildren(buildHeader(), buildMain(), buildFooter());
    });
  };

  return {
    async mount(host, params) {
      countScreen(TelemetryScreen.TeamSelect);
      mapUrl = params.mapUrl;
      const loaded = await loadTiledMap(mapUrl);
      mapName = loaded.map.name;
      formatOptions = loaded.map.formats.map((format) => ({
        key: buildFormatKey(format),
        format,
      }));
      const firstOption = formatOptions[0];
      if (!firstOption) {
        throw new Error(`Map "${mapUrl}" has no formats`);
      }
      formatKey = firstOption.key;
      slots = buildInitialSlots(firstOption.format);
      root = el("div", "ts-root");
      host.append(root);
      render();
      unbindScreenInput = bindScreenInput(goBack);
    },
    dispose() {
      unbindScreenInput?.();
      unbindScreenInput = null;
      root?.remove();
      root = null;
    },
  };
}
