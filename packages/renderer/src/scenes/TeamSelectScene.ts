import {
  type MapFormat,
  PlayerController,
  PlayerId,
  type TeamSelection,
  type TeamSet,
  TurnSystemKind,
} from "@pokemon-tactic/core";
import { TEAM_COLORS } from "../constants";
import { t } from "../i18n";
import type { TranslationKey } from "../i18n/types";
import { loadTiledMap } from "../maps/load-tiled-map";
import { sandboxBootConfig } from "../sandbox-boot";
import { loadLastSelection, saveLastSelectionEntry } from "../team/last-selection";
import { refreshAllAiSlots } from "../team/refresh-ai-teams";
import { generateRandomTeam } from "../team/team-generator";
import { listTeams, loadTeam } from "../team/team-storage";
import {
  buildFormatKey,
  createFormatPickerElement,
  type FormatOption,
} from "../ui/team-select/FormatPicker";
import {
  createPlayersColumnElement,
  type PlayerColumnEntry,
} from "../ui/team-select/PlayersColumn";
import { createTeamListElement, type TeamListEntry } from "../ui/team-select/TeamList";

const PLAYER_IDS: PlayerId[] = [
  PlayerId.Player1,
  PlayerId.Player2,
  PlayerId.Player3,
  PlayerId.Player4,
  PlayerId.Player5,
  PlayerId.Player6,
  PlayerId.Player7,
  PlayerId.Player8,
  PlayerId.Player9,
  PlayerId.Player10,
  PlayerId.Player11,
  PlayerId.Player12,
];

const DEFAULT_MAP_URL = "assets/maps/simple-arena.tmj";

interface SlotState {
  controller: PlayerController;
  assignedTeam: TeamSet | null;
  assignedTeamId: string | null;
  ephemeral: boolean;
}

export interface TeamSelectResult {
  teams: TeamSelection[];
  autoPlacement: boolean;
  turnSystemKind: TurnSystemKind;
  mapUrl: string;
  formatKey: string;
}

function teamColorToHex(index: number): string {
  const value = TEAM_COLORS[index] ?? 0x2255aa;
  return `#${value.toString(16).padStart(6, "0")}`;
}

function playerLabel(slotIndex: number): string {
  const key = `teamSelect.player${slotIndex + 1}` as TranslationKey;
  return t(key);
}

function playerShortLabel(slotIndex: number): string {
  return `J${slotIndex + 1}`;
}

function ephemeralTeamName(): string {
  return t("teamSelect.teams.random");
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
    if (sandboxBootConfig.enabled) {
      this.scene.start("BattleScene", {
        sandboxMode: true,
        sandboxConfig: sandboxBootConfig.config,
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
    const lastSelection = loadLastSelection();
    this.slots = [];
    for (let i = 0; i < format.teamCount; i++) {
      const controller = i === 0 ? PlayerController.Human : PlayerController.Ai;
      const slot: SlotState = {
        controller,
        assignedTeam: null,
        assignedTeamId: null,
        ephemeral: false,
      };
      if (controller === PlayerController.Ai) {
        slot.assignedTeam = generateRandomTeam({ name: ephemeralTeamName() });
        slot.assignedTeamId = null;
        slot.ephemeral = true;
      } else {
        const lastId = lastSelection[i];
        if (lastId !== undefined) {
          const team = loadTeam(lastId);
          if (team !== null) {
            slot.assignedTeam = team;
            slot.assignedTeamId = lastId;
            slot.ephemeral = false;
          }
        }
      }
      this.slots.push(slot);
    }
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
    if (slot.controller === PlayerController.Human) {
      slot.controller = PlayerController.Ai;
      slot.assignedTeam = generateRandomTeam({ name: ephemeralTeamName() });
      slot.assignedTeamId = null;
      slot.ephemeral = true;
    } else {
      slot.controller = PlayerController.Human;
      slot.assignedTeam = null;
      slot.assignedTeamId = null;
      slot.ephemeral = false;
    }
    this.render();
  }

  private assignTeam(slotIndex: number, teamId: string | null): void {
    const slot = this.slots[slotIndex];
    if (!slot) {
      return;
    }
    if (teamId === null) {
      slot.assignedTeam = generateRandomTeam({ name: ephemeralTeamName() });
      slot.assignedTeamId = null;
      slot.ephemeral = true;
    } else {
      const team = loadTeam(teamId);
      if (team === null) {
        return;
      }
      slot.assignedTeam = team;
      slot.assignedTeamId = teamId;
      slot.ephemeral = false;
      if (slot.controller === PlayerController.Human) {
        saveLastSelectionEntry(slotIndex, teamId);
      }
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
    const teams: TeamSelection[] = [];
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      const playerId = PLAYER_IDS[i];
      if (!slot || !playerId || slot.assignedTeam === null) {
        return;
      }
      teams.push({
        playerId,
        pokemonDefinitionIds: slot.assignedTeam.slots.map((s) => s.pokemonId),
        controller: slot.controller,
        slots: [...slot.assignedTeam.slots],
      });
    }
    const result: TeamSelectResult = {
      teams,
      autoPlacement: this.autoPlacement,
      turnSystemKind: this.turnSystemKind,
      mapUrl: this.mapUrl,
      formatKey: this.formatKey,
    };
    this.scene.start("BattleScene", { teamSelectResult: result });
  }
}
