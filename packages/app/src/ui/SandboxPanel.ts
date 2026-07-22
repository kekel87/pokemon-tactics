import { Direction, type HeldItemId, StatName, StatusType, Weather } from "@pokemon-tactic/core";
import {
  getLegalMoves,
  getMoveName,
  getPokemonAbilities,
  getPokemonName,
  loadData,
} from "@pokemon-tactic/data";
import {
  createButton,
  createLabeledRange,
  createLabeledSelect,
  createPickerCard,
  createStepper,
  replaceSelectOptions,
  type SelectOption,
} from "@pokemon-tactic/ui-dom";
import type { TranslationKey } from "../i18n";
import { getLanguage, t } from "../i18n";
import { getSandboxStudioDom } from "../sandbox-boot";
import { getAbilityInfo } from "../team/team-builder-data";
import {
  type AiProfileKey,
  normalizeSandboxConfig,
  type SandboxConfig,
  type SandboxMemberConfig,
  type SandboxTeamConfig,
  type TeamControl,
} from "../types/SandboxConfig";
import { createMovesList, type MovesList } from "./dom/MovesList";
import { openItemPickerModal } from "./team/ItemPickerModal";
import { openPokemonPickerModal } from "./team/PokemonPickerModal";

const MAX_TEAM_SIZE = 6;

const DEFENSIVE_MOVE_IDS = [
  "protect",
  "detect",
  "wide-guard",
  "quick-guard",
  "counter",
  "mirror-coat",
  "metal-burst",
  "endure",
];

const STAT_NAMES: StatName[] = [
  StatName.Attack,
  StatName.Defense,
  StatName.SpAttack,
  StatName.SpDefense,
  StatName.Speed,
  StatName.Accuracy,
  StatName.Evasion,
];

const STAT_TRANSLATION_KEYS: Record<StatName, TranslationKey> = {
  [StatName.Hp]: "sandbox.hpPercent",
  [StatName.Attack]: "stat.atk",
  [StatName.Defense]: "stat.def",
  [StatName.SpAttack]: "stat.spA",
  [StatName.SpDefense]: "stat.spD",
  [StatName.Speed]: "stat.spd",
  [StatName.Accuracy]: "stat.acc",
  [StatName.Evasion]: "stat.eva",
};

const STATUS_ENTRIES: [StatusType, TranslationKey][] = [
  [StatusType.Burned, "status.burned"],
  [StatusType.Poisoned, "status.poisoned"],
  [StatusType.BadlyPoisoned, "status.badlyPoisoned"],
  [StatusType.Paralyzed, "status.paralyzed"],
  [StatusType.Frozen, "status.frozen"],
  [StatusType.Asleep, "status.asleep"],
];

const VOLATILE_STATUS_ENTRIES: [StatusType, TranslationKey][] = [
  [StatusType.Confused, "status.confused"],
  [StatusType.Seeded, "status.seeded"],
  [StatusType.Trapped, "status.trapped"],
];

const DIRECTION_ENTRIES: [Direction, TranslationKey][] = [
  [Direction.North, "direction.north"],
  [Direction.East, "direction.east"],
  [Direction.South, "direction.south"],
  [Direction.West, "direction.west"],
];

const SANDBOX_MAPS: SelectOption[] = [
  { value: "assets/maps/dev/sandbox-flat.tmj", label: "Sandbox Flat" },
  { value: "assets/maps/dev/sandbox-slopes.tmj", label: "Sandbox Slopes" },
  { value: "assets/maps/dev/sandbox-melee-block.tmj", label: "Sandbox Melee Block (+2)" },
  { value: "assets/maps/dev/sandbox-fall-1.tmj", label: "Sandbox Fall 1" },
  { value: "assets/maps/dev/sandbox-fall-2.tmj", label: "Sandbox Fall 2 (33%)" },
  { value: "assets/maps/dev/sandbox-fall-3.tmj", label: "Sandbox Fall 3 (66%)" },
  { value: "assets/maps/dev/sandbox-fall-4.tmj", label: "Sandbox Fall 4 (lethal)" },
  { value: "assets/maps/dev/sandbox-los.tmj", label: "Sandbox LoS (2 pillars)" },
  { value: "assets/maps/dev/decorations-demo.tmj", label: "Decorations Demo (rocks/tree/grass)" },
];

/** Single control-select value: three of them collapse `control:"scored"` + `aiProfile`. */
type ControlValue = "player" | "passive" | "easy" | "medium" | "hard";

function controlToValue(control: TeamControl, aiProfile: AiProfileKey | undefined): ControlValue {
  if (control === "scored") {
    return aiProfile ?? "hard";
  }
  return control;
}

function valueToControl(value: ControlValue): { control: TeamControl; aiProfile?: AiProfileKey } {
  if (value === "player" || value === "passive") {
    return { control: value };
  }
  return { control: "scored", aiProfile: value };
}

interface MemberUiState {
  pokemonId: string;
  pokemonButton: HTMLButtonElement;
  summaryLabel: HTMLElement;
  heldItemId: string;
  heldItemButton: HTMLButtonElement;
  hpInput: HTMLInputElement;
  statusSelect: HTMLSelectElement;
  volatileStatusSelect: HTMLSelectElement;
  directionSelect: HTMLSelectElement;
  abilitySelect: HTMLSelectElement;
  statStageGetters: Map<StatName, () => number>;
  position: { x: number; y: number };
  positionSetters: { x: (v: number) => void; y: (v: number) => void };
  moves: string[];
  movesList: MovesList | null;
  defensiveMoveSelect: HTMLSelectElement | null;
  details: HTMLDetailsElement;
}

interface TeamUiState {
  control: TeamControl;
  aiProfile: AiProfileKey | undefined;
  members: MemberUiState[];
  section: HTMLElement;
}

export class SandboxPanel {
  private readonly onConfigChanged: (config: SandboxConfig) => void;
  private readonly abort = new AbortController();
  private readonly gameData = loadData();

  private mapSelect!: HTMLSelectElement;
  private weatherSelect!: HTMLSelectElement;
  private weatherTurns = 5;
  private rngMode: "random" | "deterministic" = "random";
  private seed = 0;
  private seedInput!: HTMLInputElement;
  private seedRow!: HTMLDivElement;

  private readonly teams: [TeamUiState, TeamUiState];

  constructor(initialConfig: SandboxConfig, onConfigChanged: (config: SandboxConfig) => void) {
    this.onConfigChanged = onConfigChanged;
    this.weatherTurns = initialConfig.weatherTurns ?? 5;
    // Prefer the explicit mode (survives the studio's rebuild-on-every-change); else
    // infer: seed present → deterministic (reproducible), absent → random.
    this.rngMode =
      initialConfig.rngMode ?? (initialConfig.seed === undefined ? "random" : "deterministic");
    this.seed = initialConfig.seed ?? 0;

    const dom = getSandboxStudioDom();
    this.teams = [
      this.buildTeamPanel(initialConfig.teams[0], 0, dom.playerColumn),
      this.buildTeamPanel(initialConfig.teams[1], 1, dom.dummyColumn),
    ];
    dom.battleStrip.replaceChildren(this.buildBattleStrip(initialConfig));
  }

  destroy(): void {
    this.abort.abort();
    const dom = getSandboxStudioDom();
    dom.playerColumn.replaceChildren();
    dom.dummyColumn.replaceChildren();
    dom.battleStrip.replaceChildren();
  }

  setResolvedPositions(
    resolved: { teamIndex: number; memberIndex: number; position: { x: number; y: number } }[],
  ): void {
    for (const { teamIndex, memberIndex, position } of resolved) {
      const member = this.teams[teamIndex]?.members[memberIndex];
      if (member) {
        member.positionSetters.x(position.x);
        member.positionSetters.y(position.y);
      }
    }
  }

  private emit(): void {
    this.onConfigChanged(this.readConfig());
  }

  private buildTeamPanel(
    teamConfig: SandboxTeamConfig,
    teamIndex: number,
    container: HTMLElement,
  ): TeamUiState {
    const control = teamConfig.control;
    const aiProfile = control === "scored" ? (teamConfig.aiProfile ?? "hard") : undefined;

    const section = document.createElement("div");
    section.className = "sb-section";
    section.dataset.controlMode = control;

    const headerRow = document.createElement("div");
    headerRow.className = "sb-team-header";
    const title = document.createElement("h2");
    title.className = "sb-section-title";
    title.textContent = t(teamIndex === 0 ? "sandbox.team1" : "sandbox.team2");
    headerRow.appendChild(title);

    const controlField = createLabeledSelect({
      label: t("sandbox.dummyControl"),
      options: [
        { value: "player", label: t("sandbox.dummyControl.player") },
        { value: "passive", label: t("sandbox.control.passive") },
        { value: "easy", label: t("sandbox.control.easy") },
        { value: "medium", label: t("sandbox.control.medium") },
        { value: "hard", label: t("sandbox.control.hard") },
      ],
      selected: controlToValue(control, aiProfile),
      layout: "inline",
      onChange: () => {
        const next = valueToControl(controlField.select.value as ControlValue);
        const config = this.readConfig();
        const team = config.teams[teamIndex];
        if (!team) {
          return;
        }
        team.control = next.control;
        if (next.control === "scored") {
          team.aiProfile = next.aiProfile ?? "hard";
        } else {
          team.aiProfile = undefined;
        }
        this.onConfigChanged(config);
      },
      signal: this.abort.signal,
    });
    headerRow.appendChild(controlField.row);
    section.appendChild(headerRow);

    const membersList = document.createElement("div");
    membersList.className = "sb-members";
    section.appendChild(membersList);

    const teamState: TeamUiState = { control, aiProfile, members: [], section };

    teamConfig.members.forEach((member, memberIndex) => {
      const memberState = this.buildMemberDetails(
        member,
        teamIndex,
        memberIndex,
        control,
        memberIndex === 0,
        membersList,
      );
      teamState.members.push(memberState);
      membersList.appendChild(memberState.details);
    });

    const addButton = createButton({
      label: t("sandbox.addPokemon"),
      variant: "ghost",
      onClick: () => this.addMember(teamIndex),
      signal: this.abort.signal,
    });
    addButton.classList.add("sb-add-member");
    addButton.disabled = teamConfig.members.length >= MAX_TEAM_SIZE;
    section.appendChild(addButton);

    container.replaceChildren(section);
    return teamState;
  }

  private buildMemberDetails(
    member: SandboxMemberConfig,
    teamIndex: number,
    memberIndex: number,
    control: TeamControl,
    open: boolean,
    membersList: HTMLDivElement,
  ): MemberUiState {
    const details = document.createElement("details");
    details.className = "sb-member";
    details.open = open;
    // Accordion: opening one member collapses its siblings in the same team.
    details.addEventListener(
      "toggle",
      () => {
        if (!details.open) {
          return;
        }
        for (const sibling of membersList.querySelectorAll<HTMLDetailsElement>(
          "details.sb-member",
        )) {
          if (sibling !== details) {
            sibling.open = false;
          }
        }
      },
      { signal: this.abort.signal },
    );

    const summary = document.createElement("summary");
    summary.className = "sb-member-summary";
    const summaryLabel = document.createElement("span");
    summaryLabel.className = "sb-member-summary-label";
    summaryLabel.textContent = this.pokemonName(member.pokemon);
    summary.appendChild(summaryLabel);

    const trash = createButton({
      label: "🗑",
      variant: "ghost",
      onClick: () => this.removeMember(teamIndex, memberIndex),
      signal: this.abort.signal,
    });
    trash.classList.add("sb-member-trash");
    trash.setAttribute("aria-label", t("sandbox.removePokemon"));
    // The trash button lives inside <summary>; suppress the default toggle so a delete
    // click never also expands/collapses the member.
    trash.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
      },
      { signal: this.abort.signal },
    );
    summary.appendChild(trash);
    details.appendChild(summary);

    const body = document.createElement("div");
    body.className = "sb-member-body";
    details.appendChild(body);

    const state = this.buildMemberEditor(member, control, body, summaryLabel);
    state.details = details;
    return state;
  }

  private buildMemberEditor(
    member: SandboxMemberConfig,
    control: TeamControl,
    container: HTMLDivElement,
    summaryLabel: HTMLElement,
  ): MemberUiState {
    const grid = document.createElement("div");
    grid.className = "sb-grid";
    container.appendChild(grid);

    const colLeft = document.createElement("div");
    colLeft.className = "sb-col";
    const colRight = document.createElement("div");
    colRight.className = "sb-col";
    grid.appendChild(colLeft);
    grid.appendChild(colRight);

    const initialPokemonId = member.pokemon;
    const initialHeldItem = member.heldItem ?? "";

    // Forward-declared so the picker/HP callbacks can refresh the summary + dependents.
    const state: MemberUiState = {
      pokemonId: initialPokemonId,
      pokemonButton: undefined as unknown as HTMLButtonElement,
      summaryLabel,
      heldItemId: initialHeldItem,
      heldItemButton: undefined as unknown as HTMLButtonElement,
      hpInput: undefined as unknown as HTMLInputElement,
      statusSelect: undefined as unknown as HTMLSelectElement,
      volatileStatusSelect: undefined as unknown as HTMLSelectElement,
      directionSelect: undefined as unknown as HTMLSelectElement,
      abilitySelect: undefined as unknown as HTMLSelectElement,
      statStageGetters: new Map(),
      position: { x: member.position?.x ?? 0, y: member.position?.y ?? 0 },
      // Real setters are wired below once the position row is built.
      positionSetters: {
        x: () => {
          /* replaced below */
        },
        y: () => {
          /* replaced below */
        },
      },
      moves: [],
      movesList: null,
      defensiveMoveSelect: null,
      details: undefined as unknown as HTMLDetailsElement,
    };

    const pokemonCard = createPickerCard({
      label: t("sandbox.pokemon"),
      text: this.pokemonName(initialPokemonId),
      onClick: () => {
        openPokemonPickerModal({
          onSelect: (pk) => {
            state.pokemonId = pk.id;
            state.pokemonButton.textContent = this.pokemonName(pk.id);
            this.refreshSummary(state);
            this.rebuildAbilityOptions(state);
            if (state.movesList) {
              this.resetMemberMoves(state);
            }
            this.emit();
          },
        });
      },
      signal: this.abort.signal,
    });
    colLeft.appendChild(pokemonCard.row);
    state.pokemonButton = pokemonCard.button;

    const ability = createLabeledSelect({
      label: t("sandbox.ability"),
      options: this.buildAbilityOptions(initialPokemonId),
      selected: member.ability ?? this.getFirstAbility(initialPokemonId),
      onChange: () => this.emit(),
      signal: this.abort.signal,
    });
    colLeft.appendChild(ability.row);
    state.abilitySelect = ability.select;

    const itemCard = createPickerCard({
      label: "Item",
      text: this.itemName(initialHeldItem),
      onClick: () => {
        openItemPickerModal({
          onSelect: (item) => {
            const id = item?.id ?? "";
            state.heldItemId = id;
            state.heldItemButton.textContent = this.itemName(id);
            this.emit();
          },
        });
      },
      signal: this.abort.signal,
    });
    colLeft.appendChild(itemCard.row);
    state.heldItemButton = itemCard.button;

    const hpField = createLabeledRange({
      label: t("sandbox.hpPercent"),
      min: 0,
      max: 100,
      value: member.hp ?? 100,
      onChange: () => this.emit(),
      signal: this.abort.signal,
    });
    colLeft.appendChild(hpField.row);
    state.hpInput = hpField.input;

    const statusField = createLabeledSelect({
      label: t("sandbox.status"),
      options: [
        { value: "", label: t("sandbox.none") },
        ...STATUS_ENTRIES.map(([s, key]) => ({ value: s, label: t(key) })),
      ],
      selected: member.status ?? "",
      onChange: () => this.emit(),
      signal: this.abort.signal,
    });
    colRight.appendChild(statusField.row);
    state.statusSelect = statusField.select;

    const volatileField = createLabeledSelect({
      label: t("sandbox.volatile"),
      options: [
        { value: "", label: t("sandbox.none") },
        ...VOLATILE_STATUS_ENTRIES.map(([s, key]) => ({ value: s, label: t(key) })),
      ],
      selected: member.volatileStatus ?? "",
      onChange: () => this.emit(),
      signal: this.abort.signal,
    });
    colRight.appendChild(volatileField.row);
    state.volatileStatusSelect = volatileField.select;

    colRight.appendChild(this.buildStatStagesRow(member.statStages ?? {}, state.statStageGetters));

    const positionRow = this.buildPositionRow(state.position, member.direction);
    colRight.appendChild(positionRow.row);
    state.directionSelect = positionRow.directionSelect;
    state.positionSetters = positionRow.setters;

    // Control-dependent move UI: passive teams script a single defensive move; player and
    // scored teams edit a 4-move set. The CSS hides whichever row is inactive via
    // `[data-control-mode]`, but we build the relevant one so `readConfig` has a source.
    if (control === "passive") {
      const defensiveMoves = this.gameData.moves.filter((m) => DEFENSIVE_MOVE_IDS.includes(m.id));
      const defensiveField = createLabeledSelect({
        label: t("sandbox.move"),
        options: [
          { value: "", label: t("sandbox.passive") },
          ...defensiveMoves.map((m) => ({ value: m.id, label: this.moveName(m.id) })),
        ],
        selected: member.defensiveMove ?? "",
        onChange: () => this.emit(),
        signal: this.abort.signal,
      });
      defensiveField.row.classList.add("sb-defensive-row");
      grid.appendChild(defensiveField.row);
      state.defensiveMoveSelect = defensiveField.select;
    } else {
      const defaults = this.getDefaultMoveset(initialPokemonId);
      state.moves = [0, 1, 2, 3].map((i) => member.moves?.[i] ?? defaults[i] ?? "");
      const movesList = createMovesList({
        pokemonId: initialPokemonId,
        moves: state.moves,
        allMoves: getLegalMoves(initialPokemonId).size === 0,
        onChange: (slotIndex, moveId) => {
          state.moves[slotIndex] = moveId;
          this.emit();
        },
        signal: this.abort.signal,
      });
      movesList.element.classList.add("sb-moves-grid");
      grid.appendChild(movesList.element);
      state.movesList = movesList;
    }

    return state;
  }

  private resetMemberMoves(state: MemberUiState): void {
    const defaults = this.getDefaultMoveset(state.pokemonId);
    state.moves = [0, 1, 2, 3].map((i) => defaults[i] ?? "");
    state.movesList?.refresh(state.pokemonId, state.moves);
  }

  private addMember(teamIndex: number): void {
    const config = this.readConfig();
    const team = config.teams[teamIndex];
    if (!team || team.members.length >= MAX_TEAM_SIZE) {
      return;
    }
    team.members.push({ pokemon: this.defaultNewMemberSpecies(teamIndex) });
    this.onConfigChanged(config);
  }

  private removeMember(teamIndex: number, memberIndex: number): void {
    const config = this.readConfig();
    const team = config.teams[teamIndex];
    if (!team || team.members.length <= 1) {
      return;
    }
    team.members.splice(memberIndex, 1);
    this.onConfigChanged(config);
  }

  private defaultNewMemberSpecies(teamIndex: number): string {
    return teamIndex === 0 ? "venusaur" : "dummy";
  }

  private refreshSummary(state: MemberUiState): void {
    state.summaryLabel.textContent = this.pokemonName(state.pokemonId);
  }

  private buildBattleStrip(config: SandboxConfig): HTMLDivElement {
    const strip = document.createElement("div");
    strip.className = "sb-battle-strip-content";

    const left = document.createElement("div");
    left.className = "sb-strip-left";
    strip.appendChild(left);

    const mapField = createLabeledSelect({
      label: "Map",
      options: SANDBOX_MAPS,
      selected: config.mapUrl ?? "",
      layout: "inline",
      onChange: () => this.emit(),
      signal: this.abort.signal,
    });
    left.appendChild(mapField.row);
    this.mapSelect = mapField.select;

    const weatherField = createLabeledSelect({
      label: t("sandbox.weather"),
      options: [
        { value: Weather.None, label: t("weather.none") },
        { value: Weather.Sun, label: t("weather.sun") },
        { value: Weather.Rain, label: t("weather.rain") },
        { value: Weather.Sandstorm, label: t("weather.sandstorm") },
        { value: Weather.Snow, label: t("weather.snow") },
      ],
      selected: config.weather ?? Weather.None,
      layout: "inline",
      onChange: () => this.emit(),
      signal: this.abort.signal,
    });
    left.appendChild(weatherField.row);
    this.weatherSelect = weatherField.select;

    for (const row of this.buildRngRows()) {
      left.appendChild(row);
    }

    const right = document.createElement("div");
    right.className = "sb-strip-right";
    strip.appendChild(right);

    right.appendChild(
      createButton({
        label: t("sandbox.reset"),
        variant: "ghost",
        onClick: () => this.onConfigChanged(normalizeSandboxConfig({})),
        signal: this.abort.signal,
      }),
    );

    right.appendChild(
      createButton({
        label: t("sandbox.exportJson"),
        variant: "primary",
        onClick: () => this.copyJson(),
        signal: this.abort.signal,
      }),
    );

    right.appendChild(
      createButton({
        label: t("sandbox.importJson"),
        variant: "primary",
        onClick: () => void this.importJson(),
        signal: this.abort.signal,
      }),
    );

    return strip;
  }

  /**
   * RNG controls: a mode toggle (random = fresh seed each launch, respects Pokémon
   * RNG; deterministic = fixed seed for reproducible/probability-controlled runs)
   * plus the seed field, shown only in deterministic mode.
   */
  private buildRngRows(): HTMLDivElement[] {
    const modeField = createLabeledSelect({
      label: "RNG",
      options: [
        { value: "random", label: "Aléatoire" },
        { value: "deterministic", label: "Déterministe" },
      ],
      selected: this.rngMode,
      layout: "inline",
      onChange: () => {
        this.rngMode = modeField.select.value as "random" | "deterministic";
        if (this.rngMode === "deterministic" && this.seed === 0) {
          this.seed = SandboxPanel.randomSeed();
          this.seedInput.value = String(this.seed);
        }
        this.seedRow.hidden = this.rngMode !== "deterministic";
        this.emit();
      },
      signal: this.abort.signal,
    });

    const seedRow = document.createElement("div");
    seedRow.className = "sb-form-row";
    seedRow.hidden = this.rngMode !== "deterministic";
    this.seedRow = seedRow;

    const seedLabel = document.createElement("span");
    seedLabel.className = "sb-form-label";
    seedLabel.textContent = "Seed";
    seedRow.appendChild(seedLabel);

    const input = document.createElement("input");
    input.type = "number";
    input.className = "sb-form-input sb-seed-input";
    input.value = String(this.seed);
    input.addEventListener(
      "change",
      () => {
        this.seed = Number(input.value) || 0;
        this.emit();
      },
      { signal: this.abort.signal },
    );
    seedRow.appendChild(input);
    this.seedInput = input;

    seedRow.appendChild(
      createButton({
        label: "🎲",
        variant: "ghost",
        onClick: () => {
          this.seed = SandboxPanel.randomSeed();
          this.seedInput.value = String(this.seed);
          this.emit();
        },
        signal: this.abort.signal,
      }),
    );

    return [modeField.row, seedRow];
  }

  private async importJson(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      this.onConfigChanged(normalizeSandboxConfig(JSON.parse(text)));
    } catch (_err) {
      window.alert(t("sandbox.importJsonError"));
    }
  }

  private buildStatStagesRow(
    initial: Partial<Record<StatName, number>>,
    getters: Map<StatName, () => number>,
  ): HTMLDivElement {
    const row = document.createElement("div");
    row.className = "sb-stat-stages";
    for (const stat of STAT_NAMES) {
      const cell = document.createElement("div");
      cell.className = "sb-stat-cell";
      const label = document.createElement("span");
      label.className = "sb-form-label";
      label.textContent = t(STAT_TRANSLATION_KEYS[stat]);
      cell.appendChild(label);
      const stepper = createStepper({
        value: initial[stat] ?? 0,
        min: -6,
        max: 6,
        format: (v) => (v >= 0 ? `+${v}` : `${v}`),
        onChange: () => this.emit(),
        signal: this.abort.signal,
      });
      cell.appendChild(stepper.element);
      row.appendChild(cell);
      getters.set(stat, stepper.getValue);
    }
    return row;
  }

  private buildPositionRow(
    position: { x: number; y: number },
    direction: Direction | undefined,
  ): {
    row: HTMLDivElement;
    directionSelect: HTMLSelectElement;
    setters: { x: (v: number) => void; y: (v: number) => void };
  } {
    const row = document.createElement("div");
    row.className = "sb-form-row";

    const xLabel = document.createElement("span");
    xLabel.className = "sb-form-label";
    xLabel.textContent = "X";
    row.appendChild(xLabel);
    const xStepper = createStepper({
      value: position.x,
      min: 0,
      max: 99,
      onChange: (v) => {
        position.x = v;
        this.emit();
      },
      signal: this.abort.signal,
    });
    row.appendChild(xStepper.element);

    const yLabel = document.createElement("span");
    yLabel.className = "sb-form-label";
    yLabel.textContent = "Y";
    row.appendChild(yLabel);
    const yStepper = createStepper({
      value: position.y,
      min: 0,
      max: 99,
      onChange: (v) => {
        position.y = v;
        this.emit();
      },
      signal: this.abort.signal,
    });
    row.appendChild(yStepper.element);

    const dirField = createLabeledSelect({
      label: t("sandbox.direction"),
      options: DIRECTION_ENTRIES.map(([d, key]) => ({ value: d, label: t(key) })),
      selected: direction ?? Direction.North,
      layout: "inline",
      labelWidth: "narrow",
      onChange: () => this.emit(),
      signal: this.abort.signal,
    });
    row.appendChild(dirField.row);

    return {
      row,
      directionSelect: dirField.select,
      setters: {
        x: (v: number) => {
          position.x = v;
          xStepper.setValue(v);
        },
        y: (v: number) => {
          position.y = v;
          yStepper.setValue(v);
        },
      },
    };
  }

  private readConfig(): SandboxConfig {
    return {
      rngMode: this.rngMode,
      // Deterministic seed value; in random mode the battle setup rolls a fresh seed
      // each launch (this value is carried but ignored). rngMode survives remount.
      seed: this.seed,
      mapUrl: this.mapSelect.value || undefined,
      weather: (this.weatherSelect.value as Weather) || Weather.None,
      weatherTurns: this.weatherTurns,
      teams: [this.readTeam(this.teams[0]), this.readTeam(this.teams[1])],
    };
  }

  private readTeam(team: TeamUiState): SandboxTeamConfig {
    const result: SandboxTeamConfig = {
      control: team.control,
      members: team.members.map((member) => this.readMember(member)),
    };
    if (team.control === "scored") {
      result.aiProfile = team.aiProfile ?? "hard";
    }
    return result;
  }

  private readMember(member: MemberUiState): SandboxMemberConfig {
    const moves = member.movesList ? member.moves.filter((id) => id !== "") : undefined;
    const result: SandboxMemberConfig = {
      pokemon: member.pokemonId || "dummy",
      hp: Number(member.hpInput.value),
      status: member.statusSelect.value ? (member.statusSelect.value as StatusType) : null,
      volatileStatus: member.volatileStatusSelect.value
        ? (member.volatileStatusSelect.value as StatusType)
        : null,
      statStages: this.collectStatStages(member.statStageGetters),
      direction: member.directionSelect.value as Direction,
      position: { ...member.position },
    };
    if (moves && moves.length > 0) {
      result.moves = moves;
    }
    if (member.heldItemId) {
      result.heldItem = member.heldItemId as HeldItemId;
    }
    if (member.abilitySelect.value) {
      result.ability = member.abilitySelect.value;
    }
    if (member.defensiveMoveSelect) {
      result.defensiveMove = member.defensiveMoveSelect.value || null;
    }
    return result;
  }

  private collectStatStages(
    getters: Map<StatName, () => number>,
  ): Partial<Record<StatName, number>> {
    const stages: Partial<Record<StatName, number>> = {};
    for (const stat of STAT_NAMES) {
      const getter = getters.get(stat);
      if (getter === undefined) {
        continue;
      }
      const value = getter();
      if (value !== 0) {
        stages[stat] = value;
      }
    }
    return stages;
  }

  private copyJson(): void {
    const config = this.readConfig();
    const json = JSON.stringify(config, null, 2);
    navigator.clipboard.writeText(json);
  }

  private buildAbilityOptions(pokemonId: string): SelectOption[] {
    const abilities = getPokemonAbilities(pokemonId).all;
    const options: SelectOption[] = [];
    for (const id of abilities) {
      const info = getAbilityInfo(id);
      options.push({
        value: id,
        label: info?.name ?? id,
        disabled: info ? !info.implemented : false,
      });
    }
    return options;
  }

  private rebuildAbilityOptions(state: MemberUiState): void {
    replaceSelectOptions(
      state.abilitySelect,
      this.buildAbilityOptions(state.pokemonId),
      this.getFirstAbility(state.pokemonId),
    );
  }

  private static randomSeed(): number {
    return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  }

  private getFirstAbility(pokemonId: string): string {
    const abilities = getPokemonAbilities(pokemonId).all;
    for (const id of abilities) {
      const info = getAbilityInfo(id);
      if (info?.implemented) {
        return id;
      }
    }
    return abilities[0] ?? "";
  }

  private itemName(id: string): string {
    if (!id) {
      return t("sandbox.none");
    }
    const lang = getLanguage();
    return this.gameData.itemRegistry.get(id as HeldItemId)?.name[lang] ?? id;
  }

  /**
   * The 4 default moves the battle assigns when no override is given
   * (`definition.movepool.slice(0, 4)` in BattleSetup). Mirrors combat so the panel
   * never shows a different starting moveset than what actually fights.
   */
  private getDefaultMoveset(pokemonId: string): string[] {
    const definition = this.gameData.pokemon.find((entry) => entry.id === pokemonId);
    return definition ? definition.movepool.slice(0, 4) : [];
  }

  private pokemonName(id: string): string {
    return getPokemonName(id, getLanguage());
  }

  private moveName(id: string): string {
    return getMoveName(id, getLanguage());
  }
}
