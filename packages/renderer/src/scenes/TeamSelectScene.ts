import {
  type MapFormat,
  PlayerController,
  type TeamSelection,
  TurnSystemKind,
} from "@pokemon-tactic/core";
import { AnalyticsEvent, trackEvent } from "../analytics/analytics";
import { t } from "../i18n";
import { loadTiledMap } from "../maps/load-tiled-map";
import { sandboxBootConfig } from "../sandbox-boot";
import { refreshAllAiSlots } from "../team/refresh-ai-teams";
import { listTeams } from "../team/team-storage";
import { DEFAULT_SANDBOX_CONFIG } from "../types/SandboxConfig";
import {
  buildFormatKey,
  createFormatPickerElement,
  type FormatOption,
} from "../ui/team-select/FormatPicker";
import {
  createPlayersColumnElement,
  type PlayerColumnEntry,
} from "../ui/team-select/PlayersColumn";
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
} from "../ui/team-select/slot-state";
import { createTeamListElement, type TeamListEntry } from "../ui/team-select/TeamList";
import { extractEngagedPokemonIds } from "./extract-engaged-ids";
import { buildEngagedSpritesQueue } from "./preload-pokemon";

const DEFAULT_MAP_URL = "assets/maps/simple-arena.tmj";

export interface TeamSelectResult {
  teams: TeamSelection[];
  autoPlacement: boolean;
  turnSystemKind: TurnSystemKind;
  mapUrl: string;
  formatKey: string;
}

export class TeamSelectScene extends Phaser.Scene {
  private mapUrl: string = DEFAULT_MAP_URL;
  private mapName: string = "";
  private formatOptions: FormatOption[] = [];
  private formatKey: string = "";
  private slots: SlotState[] = [];
  private activeSlotIndex = 0;
  private autoPlacement = true;
  private turnSystemKind: TurnSystemKind = TurnSystemKind.ChargeTime;
  private root: HTMLDivElement | null = null;

  constructor() {
    super("TeamSelectScene");
  }

  init(data: { mapUrl?: string }): void {
    this.mapUrl = data.mapUrl ?? DEFAULT_MAP_URL;
  }

  async create(): Promise<void> {
    trackEvent(AnalyticsEvent.TeamBuilder);
    if (sandboxBootConfig.enabled) {
      const config = sandboxBootConfig.config ?? DEFAULT_SANDBOX_CONFIG;
      const engagedIds = extractEngagedPokemonIds({
        sandboxMode: true,
        sandboxConfig: config,
      });
      this.scene.start("LoadingScene", {
        queueAssets: buildEngagedSpritesQueue(engagedIds),
        nextScene: "BattleScene",
        nextSceneData: {
          sandboxMode: true,
          sandboxConfig: config,
        },
        showTips: true,
        labelKey: "loading.battle",
      });
      return;
    }

    const loaded = await loadTiledMap(this.mapUrl);
    this.mapName = loaded.map.name;
    this.formatOptions = loaded.map.formats.map((format) => ({
      key: buildFormatKey(format),
      format,
      label: this.formatLabel(format),
    }));
    const firstOption = this.formatOptions[0];
    if (!firstOption) {
      throw new Error(`Map "${this.mapUrl}" has no formats`);
    }
    this.formatKey = firstOption.key;
    this.initSlots(firstOption.format);
    this.mountRoot();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unmountRoot());
  }

  private formatLabel(format: MapFormat): string {
    return `${format.teamCount}v${format.maxPokemonPerTeam}`;
  }

  private currentFormat(): MapFormat {
    const option = this.formatOptions.find((o) => o.key === this.formatKey);
    if (!option) {
      throw new Error(`Unknown format key: ${this.formatKey}`);
    }
    return option.format;
  }

  private initSlots(format: MapFormat): void {
    this.slots = buildInitialSlots(format);
    this.activeSlotIndex = 0;
  }

  private mountRoot(): void {
    this.unmountRoot();
    const root = document.createElement("div");
    root.className = "ts-root";
    root.dataset.scene = "TeamSelectScene";
    document.body.appendChild(root);
    this.root = root;
    this.render();
  }

  private unmountRoot(): void {
    if (this.root !== null) {
      this.root.remove();
      this.root = null;
    }
  }

  private render(): void {
    if (this.root === null) {
      return;
    }
    this.root.innerHTML = "";
    this.root.appendChild(this.buildHeader());
    this.root.appendChild(this.buildMain());
    this.root.appendChild(this.buildFooter());
  }

  private buildHeader(): HTMLElement {
    const header = document.createElement("header");
    header.className = "ts-header";

    const back = document.createElement("button");
    back.type = "button";
    back.className = "tb-btn";
    back.dataset.variant = "ghost";
    back.textContent = t("teamSelect.actions.back");
    back.addEventListener("click", () => this.scene.start("MapSelectScene"));
    header.appendChild(back);

    const title = document.createElement("h2");
    title.className = "ts-header-title";
    title.textContent = `${t("teamSelect.title")} — ${this.mapName}`;
    header.appendChild(title);

    const picker = createFormatPickerElement(
      this.formatOptions,
      this.formatKey,
      t("teamSelect.format.label"),
      { onChange: (key) => this.onFormatChange(key) },
    );
    header.appendChild(picker);

    return header;
  }

  private buildMain(): HTMLElement {
    const main = document.createElement("main");
    main.className = "ts-main";

    const { left, right } = this.splitColumns();
    main.appendChild(createPlayersColumnElement(left, "left"));
    main.appendChild(this.buildCentralList());
    if (right.length > 0) {
      main.appendChild(createPlayersColumnElement(right, "right"));
    }

    return main;
  }

  private splitColumns(): { left: PlayerColumnEntry[]; right: PlayerColumnEntry[] } {
    const left: PlayerColumnEntry[] = [];
    const right: PlayerColumnEntry[] = [];
    const useTwoCols = this.slots.length > 6;
    const half = Math.ceil(this.slots.length / 2);
    for (let i = 0; i < this.slots.length; i++) {
      const entry = this.buildPlayerEntry(i);
      if (useTwoCols && i >= half) {
        right.push(entry);
      } else {
        left.push(entry);
      }
    }
    return { left, right };
  }

  private buildPlayerEntry(slotIndex: number): PlayerColumnEntry {
    const slot = this.slots[slotIndex];
    if (!slot) {
      throw new Error(`No slot at ${slotIndex}`);
    }
    return {
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
        active: slotIndex === this.activeSlotIndex,
        labels: {
          controllerHuman: t("teamSelect.controller.human"),
          controllerAi: t("teamSelect.controller.ai"),
          chooseTeam: t("teamSelect.players.choose"),
        },
      },
      callbacks: {
        onActivate: () => this.setActive(slotIndex),
        onToggleController: () => this.toggleController(slotIndex),
      },
    };
  }

  private buildCentralList(): HTMLElement {
    const teams = listTeams().sort((a, b) => b.updatedAt - a.updatedAt);
    const badgesByTeamId = this.computeBadgesByTeamId();

    const entries: TeamListEntry[] = teams.map((team) => ({
      teamId: team.id,
      team,
      isRandom: false,
      badges: badgesByTeamId.get(team.id) ?? [],
    }));
    entries.push({
      teamId: null,
      team: null,
      isRandom: true,
      badges: [],
    });

    return createTeamListElement(
      {
        entries,
        randomLabel: t("teamSelect.teams.random"),
        emptyTitle: t("teamSelect.teams.empty.title"),
        emptyCta: t("teamSelect.teams.empty.cta"),
      },
      {
        onPick: (teamId) => this.assignTeam(this.activeSlotIndex, teamId),
      },
    );
  }

  private computeBadgesByTeamId(): Map<
    string,
    { slotIndex: number; label: string; colorHex: string }[]
  > {
    const map = new Map<string, { slotIndex: number; label: string; colorHex: string }[]>();
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (!slot || slot.assignedTeamId === null) {
        continue;
      }
      const list = map.get(slot.assignedTeamId) ?? [];
      list.push({
        slotIndex: i,
        label: playerShortLabel(i),
        colorHex: teamColorToHex(i),
      });
      map.set(slot.assignedTeamId, list);
    }
    return map;
  }

  private buildFooter(): HTMLElement {
    const footer = document.createElement("footer");
    footer.className = "ts-footer";

    const autoLabel = document.createElement("label");
    autoLabel.className = "ts-footer-toggle";
    const autoInput = document.createElement("input");
    autoInput.type = "checkbox";
    autoInput.checked = this.autoPlacement;
    autoInput.addEventListener("change", () => {
      this.autoPlacement = autoInput.checked;
    });
    autoLabel.appendChild(autoInput);
    const autoText = document.createElement("span");
    autoText.textContent = t("teamSelect.autoPlacement.label");
    autoLabel.appendChild(autoText);
    footer.appendChild(autoLabel);

    const turnLabel = document.createElement("label");
    turnLabel.className = "ts-footer-turn";
    const turnText = document.createElement("span");
    turnText.textContent = t("teamSelect.turnSystem.label");
    turnLabel.appendChild(turnText);
    const turnSelect = document.createElement("select");
    const ctOption = document.createElement("option");
    ctOption.value = TurnSystemKind.ChargeTime;
    ctOption.textContent = t("teamSelect.turnSystemCt");
    turnSelect.appendChild(ctOption);
    const rrOption = document.createElement("option");
    rrOption.value = TurnSystemKind.RoundRobin;
    rrOption.textContent = t("teamSelect.turnSystemRr");
    turnSelect.appendChild(rrOption);
    turnSelect.value = this.turnSystemKind;
    turnSelect.addEventListener("change", () => {
      this.turnSystemKind = turnSelect.value as TurnSystemKind;
    });
    turnLabel.appendChild(turnSelect);
    footer.appendChild(turnLabel);

    const refreshAi = document.createElement("button");
    refreshAi.type = "button";
    refreshAi.className = "tb-btn";
    refreshAi.textContent = t("teamSelect.actions.refreshAi");
    refreshAi.addEventListener("click", () => this.refreshAllAi());
    footer.appendChild(refreshAi);

    const spacer = document.createElement("div");
    spacer.className = "ts-footer-spacer";
    footer.appendChild(spacer);

    const launch = document.createElement("button");
    launch.type = "button";
    launch.className = "tb-btn";
    launch.dataset.variant = "primary";
    launch.textContent = t("teamSelect.actions.launch");
    const launchable = this.isLaunchable();
    launch.disabled = !launchable;
    launch.addEventListener("click", () => this.onLaunch());
    footer.appendChild(launch);

    return footer;
  }

  private isLaunchable(): boolean {
    return this.slots.every((s) => s.assignedTeam !== null);
  }

  private setActive(slotIndex: number): void {
    if (slotIndex === this.activeSlotIndex) {
      return;
    }
    this.activeSlotIndex = slotIndex;
    this.render();
  }

  private toggleController(slotIndex: number): void {
    const slot = this.slots[slotIndex];
    if (!slot) {
      return;
    }
    toggleSlotController(slot);
    this.render();
  }

  private assignTeam(slotIndex: number, teamId: string | null): void {
    const slot = this.slots[slotIndex];
    if (!slot || !assignTeamToSlot(slot, slotIndex, teamId)) {
      return;
    }
    if (this.activeSlotIndex < this.slots.length - 1) {
      this.activeSlotIndex += 1;
    }
    this.render();
  }

  private refreshAllAi(): void {
    this.slots = refreshAllAiSlots(this.slots, ephemeralTeamName());
    this.render();
  }

  private onFormatChange(key: string): void {
    if (key === this.formatKey) {
      return;
    }
    this.formatKey = key;
    const format = this.currentFormat();
    this.initSlots(format);
    this.render();
  }

  private onLaunch(): void {
    if (!this.isLaunchable()) {
      return;
    }
    const teams = buildTeamSelections(this.slots);
    if (teams === null) {
      return;
    }
    const result: TeamSelectResult = {
      teams,
      autoPlacement: this.autoPlacement,
      turnSystemKind: this.turnSystemKind,
      mapUrl: this.mapUrl,
      formatKey: this.formatKey,
    };
    const engagedIds = extractEngagedPokemonIds({ teamSelectResult: result });
    this.scene.start("LoadingScene", {
      queueAssets: buildEngagedSpritesQueue(engagedIds),
      nextScene: "BattleScene",
      nextSceneData: { teamSelectResult: result },
      showTips: true,
      labelKey: "loading.battle",
    });
  }
}
