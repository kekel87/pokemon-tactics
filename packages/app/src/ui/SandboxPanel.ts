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
import { DEFAULT_SANDBOX_CONFIG, type SandboxConfig } from "../types/SandboxConfig";
import { createMovesList, type MovesList } from "./dom/MovesList";
import { openItemPickerModal } from "./team/ItemPickerModal";
import { openPokemonPickerModal } from "./team/PokemonPickerModal";

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

type Owner = "player" | "dummy";

interface PokemonState {
  pokemonId: string;
  pokemonButton: HTMLButtonElement;
  heldItemId: string;
  heldItemButton: HTMLButtonElement;
  hpInput: HTMLInputElement;
  statusSelect: HTMLSelectElement;
  volatileStatusSelect: HTMLSelectElement;
  directionSelect: HTMLSelectElement;
  statStageGetters: Map<StatName, () => number>;
  position: { x: number; y: number };
  positionSetters: { x: (v: number) => void; y: (v: number) => void };
}

export class SandboxPanel {
  private readonly onConfigChanged: (config: SandboxConfig) => void;
  private readonly abort = new AbortController();
  private readonly gameData = loadData();
  private readonly movepoolCache = new Map<string, string[]>();

  private mapSelect!: HTMLSelectElement;
  private weatherSelect!: HTMLSelectElement;
  private weatherTurns = 5;
  private rngMode: "random" | "deterministic" = "random";
  private seed = 0;
  private seedInput!: HTMLInputElement;
  private seedRow!: HTMLDivElement;

  private player!: PokemonState;
  private dummy!: PokemonState;

  private playerAbilitySelect!: HTMLSelectElement;
  private playerMoves: string[] = [];
  private playerMovesList!: MovesList;

  private dummyControl: "ai" | "player" = "ai";
  private dummyAbilitySelect!: HTMLSelectElement;
  private dummyMoveSelect!: HTMLSelectElement;
  private dummyMoves: string[] = [];
  private dummyMovesList!: MovesList;
  private dummySection!: HTMLDivElement;

  constructor(initialConfig: SandboxConfig, onConfigChanged: (config: SandboxConfig) => void) {
    this.onConfigChanged = onConfigChanged;
    this.dummyControl = initialConfig.dummyControl;
    this.dummyMoves = [...initialConfig.dummyMoves];
    this.weatherTurns = initialConfig.weatherTurns ?? 5;
    // Prefer the explicit mode (survives the studio's rebuild-on-every-change); else
    // infer: seed present → deterministic (reproducible, controls probabilistic effects
    // for e2e/QA), absent → random (fresh seed each launch, respects Pokémon RNG).
    this.rngMode =
      initialConfig.rngMode ?? (initialConfig.seed === undefined ? "random" : "deterministic");
    this.seed = initialConfig.seed ?? 0;

    const dom = getSandboxStudioDom();
    dom.playerColumn.replaceChildren(this.buildPlayerPanel(initialConfig));
    dom.dummyColumn.replaceChildren(this.buildDummyPanel(initialConfig));
    dom.battleStrip.replaceChildren(this.buildBattleStrip(initialConfig));
  }

  destroy(): void {
    this.abort.abort();
    const dom = getSandboxStudioDom();
    dom.playerColumn.replaceChildren();
    dom.dummyColumn.replaceChildren();
    dom.battleStrip.replaceChildren();
  }

  setResolvedPositions(player: { x: number; y: number }, dummy: { x: number; y: number }): void {
    this.player.positionSetters.x(player.x);
    this.player.positionSetters.y(player.y);
    this.dummy.positionSetters.x(dummy.x);
    this.dummy.positionSetters.y(dummy.y);
  }

  private emit(): void {
    this.onConfigChanged(this.readConfig());
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
        onClick: () => this.onConfigChanged({ ...DEFAULT_SANDBOX_CONFIG }),
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
        // Entering deterministic mode with no seed yet → roll a concrete starting seed
        // (0 replays the same battle, which reads as "nothing is random"). Keep a seed
        // the user already set.
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
      const parsed = JSON.parse(text) as Partial<SandboxConfig>;
      this.onConfigChanged({ ...this.readConfig(), ...parsed });
    } catch (_err) {
      window.alert(t("sandbox.importJsonError"));
    }
  }

  private buildPokemonState(
    config: SandboxConfig,
    owner: Owner,
    container: HTMLDivElement,
  ): PokemonState {
    const isPlayer = owner === "player";
    const grid = document.createElement("div");
    grid.className = "sb-grid";
    container.appendChild(grid);

    const colLeft = document.createElement("div");
    colLeft.className = "sb-col";
    const colRight = document.createElement("div");
    colRight.className = "sb-col";
    grid.appendChild(colLeft);
    grid.appendChild(colRight);

    const initialPokemonId = isPlayer ? config.pokemon : config.dummyPokemon;
    const initialHeldItem = isPlayer ? (config.heldItem ?? "") : (config.dummyHeldItem ?? "");

    const pokemonCard = createPickerCard({
      label: t("sandbox.pokemon"),
      text: this.pokemonName(initialPokemonId),
      onClick: () => {
        openPokemonPickerModal({
          onSelect: (pk) => {
            if (isPlayer) {
              this.player.pokemonId = pk.id;
              this.player.pokemonButton.textContent = this.pokemonName(pk.id);
              this.updatePlayerMoves();
              this.rebuildPlayerAbilityOptions();
            } else {
              this.dummy.pokemonId = pk.id;
              this.dummy.pokemonButton.textContent = this.pokemonName(pk.id);
              this.rebuildDummyAbilityOptions();
              this.dummyMovesList.refresh(pk.id, this.dummyMoves);
            }
            this.emit();
          },
        });
      },
      signal: this.abort.signal,
    });
    colLeft.appendChild(pokemonCard.row);

    const ability = createLabeledSelect({
      label: t("sandbox.ability"),
      options: this.buildAbilityOptions(initialPokemonId),
      selected:
        (isPlayer ? config.playerAbility : config.dummyAbility) ??
        this.getFirstAbility(initialPokemonId),
      onChange: () => this.emit(),
      signal: this.abort.signal,
    });
    colLeft.appendChild(ability.row);
    if (isPlayer) {
      this.playerAbilitySelect = ability.select;
    } else {
      this.dummyAbilitySelect = ability.select;
    }

    const itemCard = createPickerCard({
      label: "Item",
      text: this.itemName(initialHeldItem),
      onClick: () => {
        openItemPickerModal({
          onSelect: (item) => {
            const id = item?.id ?? "";
            if (isPlayer) {
              this.player.heldItemId = id;
              this.player.heldItemButton.textContent = this.itemName(id);
            } else {
              this.dummy.heldItemId = id;
              this.dummy.heldItemButton.textContent = this.itemName(id);
            }
            this.emit();
          },
        });
      },
      signal: this.abort.signal,
    });
    colLeft.appendChild(itemCard.row);

    const hpField = createLabeledRange({
      label: t("sandbox.hpPercent"),
      min: 1,
      max: 100,
      value: isPlayer ? config.hp : config.dummyHp,
      onChange: () => this.emit(),
      signal: this.abort.signal,
    });
    colLeft.appendChild(hpField.row);

    const statusField = createLabeledSelect({
      label: t("sandbox.status"),
      options: [
        { value: "", label: t("sandbox.none") },
        ...STATUS_ENTRIES.map(([s, key]) => ({ value: s, label: t(key) })),
      ],
      selected: (isPlayer ? config.status : config.dummyStatus) ?? "",
      onChange: () => this.emit(),
      signal: this.abort.signal,
    });
    colRight.appendChild(statusField.row);

    const volatileField = createLabeledSelect({
      label: t("sandbox.volatile"),
      options: [
        { value: "", label: t("sandbox.none") },
        ...VOLATILE_STATUS_ENTRIES.map(([s, key]) => ({ value: s, label: t(key) })),
      ],
      selected: (isPlayer ? config.volatileStatus : config.dummyVolatileStatus) ?? "",
      onChange: () => this.emit(),
      signal: this.abort.signal,
    });
    colRight.appendChild(volatileField.row);

    const statStageGetters = new Map<StatName, () => number>();
    const stagesInitial = isPlayer ? config.statStages : config.dummyStatStages;
    colRight.appendChild(this.buildStatStagesRow(stagesInitial, statStageGetters));

    const positionInitial = isPlayer ? config.playerPosition : config.dummyPosition;
    const directionInitial = isPlayer ? config.playerDirection : config.dummyDirection;
    const position = { x: positionInitial?.x ?? 0, y: positionInitial?.y ?? 0 };
    const positionRow = this.buildPositionRow(position, directionInitial);
    colRight.appendChild(positionRow.row);

    return {
      pokemonId: initialPokemonId,
      pokemonButton: pokemonCard.button,
      heldItemId: initialHeldItem,
      heldItemButton: itemCard.button,
      hpInput: hpField.input,
      statusSelect: statusField.select,
      volatileStatusSelect: volatileField.select,
      directionSelect: positionRow.directionSelect,
      statStageGetters,
      position,
      positionSetters: positionRow.setters,
    };
  }

  private buildPlayerPanel(config: SandboxConfig): HTMLDivElement {
    const panel = document.createElement("div");
    panel.className = "sb-section";

    const header = document.createElement("h2");
    header.className = "sb-section-title";
    header.textContent = t("sandbox.player");
    panel.appendChild(header);

    const body = document.createElement("div");
    panel.appendChild(body);

    this.player = this.buildPokemonState(config, "player", body);

    this.playerMoves = [];
    // Default to the curated movepool head (definition order) — the SAME 4 the battle
    // gives an instance when `config.moves` is empty (BattleSetup movepool.slice(0,4)).
    // The picker list stays alphabetical; only this default selection must mirror combat.
    const defaults = this.getDefaultMoveset(this.player.pokemonId);
    for (let i = 0; i < 4; i++) {
      this.playerMoves.push(config.moves[i] ?? defaults[i] ?? "");
    }
    this.playerMovesList = createMovesList({
      pokemonId: this.player.pokemonId,
      moves: this.playerMoves,
      onChange: (slotIndex, moveId) => {
        this.playerMoves[slotIndex] = moveId;
        this.emit();
      },
      signal: this.abort.signal,
    });
    this.playerMovesList.element.classList.add("sb-moves-grid");
    body.appendChild(this.playerMovesList.element);

    return panel;
  }

  private buildDummyPanel(config: SandboxConfig): HTMLDivElement {
    const panel = document.createElement("div");
    panel.className = "sb-section";
    panel.dataset.controlMode = this.dummyControl;
    this.dummySection = panel;

    const header = document.createElement("h2");
    header.className = "sb-section-title";
    header.textContent = t("sandbox.dummy");
    panel.appendChild(header);

    const body = document.createElement("div");
    panel.appendChild(body);

    this.dummy = this.buildPokemonState(config, "dummy", body);

    body.appendChild(this.buildControlRow());

    const defensiveMoves = this.gameData.moves.filter((m) => DEFENSIVE_MOVE_IDS.includes(m.id));
    const dummyMoveField = createLabeledSelect({
      label: t("sandbox.move"),
      options: [
        { value: "", label: t("sandbox.passive") },
        ...defensiveMoves.map((m) => ({ value: m.id, label: this.moveName(m.id) })),
      ],
      selected: config.dummyMove ?? "",
      onChange: () => this.emit(),
      signal: this.abort.signal,
    });
    dummyMoveField.row.classList.add("sb-defensive-row");
    body.appendChild(dummyMoveField.row);
    this.dummyMoveSelect = dummyMoveField.select;

    this.dummyMovesList = createMovesList({
      pokemonId: this.dummy.pokemonId,
      moves: this.dummyMoves,
      // The dummy species has no learnset (it's a test target), so offer every
      // implemented move — otherwise the picker would be empty.
      allMoves: true,
      onChange: (slotIndex, moveId) => {
        this.dummyMoves[slotIndex] = moveId;
        this.emit();
      },
      signal: this.abort.signal,
    });
    this.dummyMovesList.element.classList.add("sb-moves-grid");
    body.appendChild(this.dummyMovesList.element);

    return panel;
  }

  private buildControlRow(): HTMLDivElement {
    const row = document.createElement("div");
    row.className = "sb-form-row";

    const label = document.createElement("span");
    label.className = "sb-form-label";
    label.dataset.width = "wide";
    label.textContent = `${t("sandbox.dummyControl")}:`;
    row.appendChild(label);

    const group = document.createElement("div");
    group.className = "sb-radio-group";
    group.appendChild(this.createControlRadio("ai", t("sandbox.dummyControl.ai")));
    group.appendChild(this.createControlRadio("player", t("sandbox.dummyControl.player")));
    row.appendChild(group);

    return row;
  }

  private createControlRadio(value: "ai" | "player", label: string): HTMLLabelElement {
    const wrapper = document.createElement("label");
    wrapper.className = "sb-radio-option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "sandbox-dummy-control";
    input.value = value;
    input.checked = this.dummyControl === value;
    input.addEventListener(
      "change",
      () => {
        if (!input.checked) {
          return;
        }
        this.dummyControl = value;
        this.dummySection.dataset.controlMode = value;
        if (value === "player" && this.dummyMoves.every((id) => id === "")) {
          this.autoFillDummyMoves();
        }
        this.emit();
      },
      { signal: this.abort.signal },
    );
    wrapper.appendChild(input);
    const span = document.createElement("span");
    span.textContent = label;
    wrapper.appendChild(span);
    return wrapper;
  }

  private autoFillDummyMoves(): void {
    const movepool = this.getMovepoolFor(this.dummy.pokemonId);
    if (movepool.length === 0) {
      return;
    }
    const pool = [...movepool];
    const picks: string[] = [];
    for (let i = 0; i < 4 && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      picks.push(pool.splice(idx, 1)[0] ?? "");
    }
    while (picks.length < 4) {
      picks.push("");
    }
    this.dummyMoves = picks;
    this.dummyMovesList.refresh(this.dummy.pokemonId, this.dummyMoves);
  }

  private updatePlayerMoves(): void {
    // Switching species resets to that species' default moveset (mirrors the battle),
    // rather than carrying over the previous mon's overlapping moves.
    const defaults = this.getDefaultMoveset(this.player.pokemonId);
    this.playerMoves = [0, 1, 2, 3].map((i) => defaults[i] ?? "");
    this.playerMovesList.refresh(this.player.pokemonId, this.playerMoves);
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
    const moves = this.playerMoves.filter((v) => v !== "");

    const statStages = this.collectStatStages(this.player.statStageGetters);
    const dummyStatStages = this.collectStatStages(this.dummy.statStageGetters);

    const mapUrl = this.mapSelect.value || undefined;

    return {
      rngMode: this.rngMode,
      // Deterministic seed value; in random mode the battle setup rolls a fresh seed
      // each launch (this value is carried but ignored). rngMode survives remount.
      seed: this.seed,
      pokemon: this.player.pokemonId,
      moves: moves.length > 0 ? moves : this.getDefaultMoveset(this.player.pokemonId),
      hp: Number(this.player.hpInput.value),
      status: this.player.statusSelect.value
        ? (this.player.statusSelect.value as StatusType)
        : null,
      volatileStatus: this.player.volatileStatusSelect.value
        ? (this.player.volatileStatusSelect.value as StatusType)
        : null,
      heldItem: this.player.heldItemId ? (this.player.heldItemId as HeldItemId) : undefined,
      playerAbility: this.playerAbilitySelect.value || undefined,
      statStages,
      playerPosition: { ...this.player.position },
      playerDirection: this.player.directionSelect.value as Direction,
      dummyPokemon: this.dummy.pokemonId || "dummy",
      dummyControl: this.dummyControl,
      dummyMove: this.dummyMoveSelect.value || null,
      dummyMoves: [...this.dummyMoves],
      dummyDirection: this.dummy.directionSelect.value as Direction,
      dummyHp: Number(this.dummy.hpInput.value),
      dummyStatus: this.dummy.statusSelect.value
        ? (this.dummy.statusSelect.value as StatusType)
        : null,
      dummyVolatileStatus: this.dummy.volatileStatusSelect.value
        ? (this.dummy.volatileStatusSelect.value as StatusType)
        : null,
      dummyHeldItem: this.dummy.heldItemId ? (this.dummy.heldItemId as HeldItemId) : undefined,
      dummyAbility: this.dummyAbilitySelect.value || undefined,
      dummyStatStages,
      dummyPosition: { ...this.dummy.position },
      mapUrl,
      weather: (this.weatherSelect.value as Weather) || Weather.None,
      weatherTurns: this.weatherTurns,
    };
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

  private rebuildPlayerAbilityOptions(): void {
    replaceSelectOptions(
      this.playerAbilitySelect,
      this.buildAbilityOptions(this.player.pokemonId),
      this.getFirstAbility(this.player.pokemonId),
    );
  }

  private rebuildDummyAbilityOptions(): void {
    replaceSelectOptions(
      this.dummyAbilitySelect,
      this.buildAbilityOptions(this.dummy.pokemonId),
      this.getFirstAbility(this.dummy.pokemonId),
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

  private getMovepoolFor(pokemonId: string): string[] {
    const cached = this.movepoolCache.get(pokemonId);
    if (cached !== undefined) {
      return cached;
    }
    const legal = getLegalMoves(pokemonId);
    const result: string[] = [];
    for (const move of this.gameData.moves) {
      if (legal.has(move.id)) {
        result.push(move.id);
      }
    }
    result.sort((a, b) => this.moveName(a).localeCompare(this.moveName(b)));
    this.movepoolCache.set(pokemonId, result);
    return result;
  }

  private pokemonName(id: string): string {
    return getPokemonName(id, getLanguage());
  }

  private moveName(id: string): string {
    return getMoveName(id, getLanguage());
  }
}
