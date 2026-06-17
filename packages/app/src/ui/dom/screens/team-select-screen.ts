import { type MapFormat, PlayerController } from "@pokemon-tactic/core";
import { AnalyticsEvent, trackEvent } from "../../../analytics/analytics";
import type { Navigate, Screen } from "../../../app/screen-manager";
import { t } from "../../../i18n";
import { loadTiledMap } from "../../../maps/load-tiled-map";
import { refreshAllAiSlots } from "../../../team/refresh-ai-teams";
import { listTeams } from "../../../team/team-storage";
import {
  buildFormatKey,
  createFormatPickerElement,
  type FormatOption,
} from "../../team-select/FormatPicker";
import {
  createPlayersColumnElement,
  type PlayerColumnEntry,
} from "../../team-select/PlayersColumn";
import {
  assignTeamToSlot,
  buildInitialSlots,
  buildTeamSelections,
  ephemeralTeamName,
  playerLabel,
  playerShortLabel,
  type SlotState,
  teamColorToHex,
  toggleSlotController,
} from "../../team-select/slot-state";
import { createTeamListElement, type TeamListEntry } from "../../team-select/TeamList";
import { bindEscape, el } from "./elements";

/**
 * DOM port of TeamSelectScene (plan 120 step 4, minimal version — full screen in
 * 4d). Format picker, one slot per player (human/AI toggle, team assignment),
 * auto-placement + CT/RR options, launch. Launching hands the whole CombatSetup
 * to the combat screen, which runs the placement phase (step 6).
 */
export function createTeamSelectScreen(navigate: Navigate): Screen<"team-select"> {
  let root: HTMLElement | null = null;
  let unbindEscape: (() => void) | null = null;
  let mapUrl = "";
  let mapName = "";
  let formatOptions: FormatOption[] = [];
  let formatKey = "";
  let slots: SlotState[] = [];
  let activeSlotIndex = 0;
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
      setup: { teams, formatKey, autoPlacement },
    });
  };

  const setActive = (slotIndex: number): void => {
    if (slotIndex !== activeSlotIndex) {
      activeSlotIndex = slotIndex;
      render();
    }
  };

  const toggleController = (slotIndex: number): void => {
    const slot = slots[slotIndex];
    if (slot) {
      toggleSlotController(slot);
      render();
    }
  };

  const assignTeam = (slotIndex: number, teamId: string | null): void => {
    const slot = slots[slotIndex];
    if (!slot || !assignTeamToSlot(slot, slotIndex, teamId)) {
      return;
    }
    if (activeSlotIndex < slots.length - 1) {
      activeSlotIndex += 1;
    }
    render();
  };

  const onFormatChange = (key: string): void => {
    if (key !== formatKey) {
      formatKey = key;
      slots = buildInitialSlots(currentFormat());
      activeSlotIndex = 0;
      render();
    }
  };

  const refreshAllAi = (): void => {
    slots = refreshAllAiSlots(slots, ephemeralTeamName());
    render();
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
      formatOptions,
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
      controllerHuman: PlayerController.Human,
      controllerAi: PlayerController.Ai,
      assignedTeam: slot.assignedTeam,
      ephemeral: slot.ephemeral,
      active: slotIndex === activeSlotIndex,
      labels: {
        controllerHuman: t("teamSelect.controller.human"),
        controllerAi: t("teamSelect.controller.ai"),
        chooseTeam: t("teamSelect.players.choose"),
      },
    },
    callbacks: {
      onActivate: () => setActive(slotIndex),
      onToggleController: () => toggleController(slotIndex),
    },
  });

  const buildMain = (): HTMLElement => {
    const main = el("main", "ts-main");

    const left: PlayerColumnEntry[] = [];
    const right: PlayerColumnEntry[] = [];
    const useTwoColumns = slots.length > 6;
    const half = Math.ceil(slots.length / 2);
    slots.forEach((slot, index) => {
      const entry = buildPlayerEntry(index, slot);
      if (useTwoColumns && index >= half) {
        right.push(entry);
      } else {
        left.push(entry);
      }
    });

    main.append(createPlayersColumnElement(left, "left"));
    main.append(buildCentralList());
    if (right.length > 0) {
      main.append(createPlayersColumnElement(right, "right"));
    }
    return main;
  };

  const computeBadgesByTeamId = (): Map<
    string,
    { slotIndex: number; label: string; colorHex: string }[]
  > => {
    const map = new Map<string, { slotIndex: number; label: string; colorHex: string }[]>();
    slots.forEach((slot, index) => {
      if (slot.assignedTeamId === null) {
        return;
      }
      const list = map.get(slot.assignedTeamId) ?? [];
      list.push({
        slotIndex: index,
        label: playerShortLabel(index),
        colorHex: teamColorToHex(index),
      });
      map.set(slot.assignedTeamId, list);
    });
    return map;
  };

  const buildCentralList = (): HTMLElement => {
    const teams = listTeams().sort((a, b) => b.updatedAt - a.updatedAt);
    const badgesByTeamId = computeBadgesByTeamId();

    const entries: TeamListEntry[] = teams.map((team) => ({
      teamId: team.id,
      team,
      isRandom: false,
      badges: badgesByTeamId.get(team.id) ?? [],
    }));
    entries.push({ teamId: null, team: null, isRandom: true, badges: [] });

    return createTeamListElement(
      {
        entries,
        randomLabel: t("teamSelect.teams.random"),
        emptyTitle: t("teamSelect.teams.empty.title"),
        emptyCta: t("teamSelect.teams.empty.cta"),
      },
      { onPick: (teamId) => assignTeam(activeSlotIndex, teamId) },
    );
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

    const refreshAi = el("button", "tb-btn");
    refreshAi.type = "button";
    refreshAi.textContent = t("teamSelect.actions.refreshAi");
    refreshAi.addEventListener("click", refreshAllAi);

    const spacer = el("div", "ts-footer-spacer");

    const launch = el("button", "tb-btn");
    launch.type = "button";
    launch.dataset.variant = "primary";
    launch.textContent = t("teamSelect.actions.launch");
    launch.disabled = !isLaunchable();
    launch.addEventListener("click", onLaunch);

    footer.append(autoLabel, refreshAi, spacer, launch);
    return footer;
  };

  const render = (): void => {
    if (!root) {
      return;
    }
    root.replaceChildren(buildHeader(), buildMain(), buildFooter());
  };

  return {
    async mount(host, params) {
      trackEvent(AnalyticsEvent.TeamBuilder);
      mapUrl = params.mapUrl;
      const loaded = await loadTiledMap(mapUrl);
      mapName = loaded.map.name;
      formatOptions = loaded.map.formats.map((format) => ({
        key: buildFormatKey(format),
        format,
        label: `${format.teamCount}v${format.maxPokemonPerTeam}`,
      }));
      const firstOption = formatOptions[0];
      if (!firstOption) {
        throw new Error(`Map "${mapUrl}" has no formats`);
      }
      formatKey = firstOption.key;
      slots = buildInitialSlots(firstOption.format);
      activeSlotIndex = 0;
      root = el("div", "ts-root");
      host.append(root);
      render();
      unbindEscape = bindEscape(goBack);
    },
    dispose() {
      unbindEscape?.();
      unbindEscape = null;
      root?.remove();
      root = null;
    },
  };
}
