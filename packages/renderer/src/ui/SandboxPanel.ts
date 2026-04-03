import {
  type BaseStats,
  computeCombatStats,
  computeStatAtLevel,
  Direction,
  StatName,
  StatusType,
} from "@pokemon-tactic/core";
import { getMoveName, getPokemonName, loadData } from "@pokemon-tactic/data";
import { getLanguage, t } from "../i18n";
import type { TranslationKey } from "../i18n";
import type { SandboxConfig } from "../types/SandboxConfig";

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

const BASE_STAT_KEYS: (keyof BaseStats)[] = [
  "hp",
  "attack",
  "defense",
  "spAttack",
  "spDefense",
  "speed",
];

const BASE_STAT_LABELS: Record<string, string> = {
  hp: "HP",
  attack: "Atk",
  defense: "Def",
  spAttack: "SpA",
  spDefense: "SpD",
  speed: "Spd",
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

const PANEL_STYLE = `
  position: fixed; top: 10px; width: 220px;
  background: rgba(10, 10, 30, 0.92); color: #ddd; font-family: monospace;
  font-size: 11px; border-radius: 6px; border: 1px solid #444;
  z-index: 1000; overflow: hidden; user-select: none;
`;

const HEADER_STYLE = `
  padding: 5px 8px; background: rgba(30,30,60,0.95); cursor: pointer;
  display: flex; justify-content: space-between; align-items: center;
  border-bottom: 1px solid #444; font-weight: bold;
`;

export class SandboxPanel {
  private toolbarPanel: HTMLDivElement;
  private playerPanel: HTMLDivElement;
  private dummyPanel: HTMLDivElement;
  private readonly onConfigChanged: (config: SandboxConfig) => void;
  private readonly gameData = loadData();
  private readonly pokemonIds: string[];

  private pokemonSelect!: HTMLSelectElement;
  private moveSelects: HTMLSelectElement[] = [];
  private hpSlider!: HTMLInputElement;
  private statusSelect!: HTMLSelectElement;
  private volatileStatusSelect!: HTMLSelectElement;
  private statSliders: Map<StatName, HTMLInputElement> = new Map();

  private dummyPokemonSelect!: HTMLSelectElement;
  private dummyMoveSelect!: HTMLSelectElement;
  private dummyDirectionSelect!: HTMLSelectElement;
  private dummyHpSlider!: HTMLInputElement;
  private dummyLevelInput!: HTMLInputElement;
  private dummyStatusSelect!: HTMLSelectElement;
  private dummyVolatileStatusSelect!: HTMLSelectElement;
  private dummyStatSliders: Map<StatName, HTMLInputElement> = new Map();
  private dummyBaseStatInputs: Map<string, HTMLInputElement> = new Map();
  private dummyComputedLabels: Map<string, HTMLSpanElement> = new Map();

  private playerCollapsed = false;
  private dummyCollapsed = false;

  constructor(initialConfig: SandboxConfig, onConfigChanged: (config: SandboxConfig) => void) {
    this.onConfigChanged = onConfigChanged;
    this.pokemonIds = this.gameData.pokemon.map((p) => p.id);

    this.toolbarPanel = this.buildToolbar();
    document.body.appendChild(this.toolbarPanel);

    this.dummyPanel = this.buildDummyPanel(initialConfig);
    this.dummyPanel.style.cssText = `${PANEL_STYLE} right: 10px; top: 46px;`;
    document.body.appendChild(this.dummyPanel);

    this.playerPanel = this.buildPlayerPanel(initialConfig);
    this.playerPanel.style.cssText = `${PANEL_STYLE} right: 240px; top: 46px;`;
    document.body.appendChild(this.playerPanel);
  }

  destroy(): void {
    this.toolbarPanel.remove();
    this.playerPanel.remove();
    this.dummyPanel.remove();
  }

  private buildToolbar(): HTMLDivElement {
    const toolbar = document.createElement("div");
    toolbar.style.cssText = `
      position: fixed; top: 10px; right: 10px; width: 450px;
      display: flex; gap: 6px; z-index: 1001;
    `;

    const resetButton = this.createButton(t("sandbox.reset"), () => this.emit());
    resetButton.style.width = "auto";
    resetButton.style.flex = "1";
    toolbar.appendChild(resetButton);

    const urlButton = this.createButton(t("sandbox.copyUrl"), () => this.copyUrl());
    urlButton.style.width = "auto";
    urlButton.style.flex = "1";
    toolbar.appendChild(urlButton);

    return toolbar;
  }

  private emit(): void {
    this.onConfigChanged(this.readConfig());
  }

  private buildPlayerPanel(config: SandboxConfig): HTMLDivElement {
    const panel = document.createElement("div");

    const header = this.createHeader(t("sandbox.player"), () => {
      this.playerCollapsed = !this.playerCollapsed;
      this.toggleBody(panel, this.playerCollapsed);
    });
    panel.appendChild(header);

    const body = this.createBody();
    panel.appendChild(body);

    const pokemonSelect = this.createSelect(
      t("sandbox.pokemon"),
      this.pokemonIds
        .filter((id) => id !== "dummy")
        .map((id) => ({ value: id, label: this.pokemonName(id) })),
      config.pokemon,
    );
    pokemonSelect.select.addEventListener("change", () => {
      this.updatePlayerMoves();
      this.emit();
    });
    body.appendChild(pokemonSelect.row);
    this.pokemonSelect = pokemonSelect.select;

    const movepool = this.getMovepoolFor(config.pokemon);
    for (let i = 0; i < 4; i++) {
      const moveId = config.moves[i] ?? "";
      const moveSelect = this.createSelect(
        `${t("sandbox.move")} ${i + 1}`,
        [
          { value: "", label: t("sandbox.none") },
          ...movepool.map((id) => ({ value: id, label: this.moveName(id) })),
        ],
        moveId,
      );
      moveSelect.select.addEventListener("change", (event) => {
        this.deduplicateMoveSlot(event.target as HTMLSelectElement);
        this.emit();
      });
      body.appendChild(moveSelect.row);
      this.moveSelects.push(moveSelect.select);
    }

    const hpSlider = this.createSlider(t("sandbox.hpPercent"), 1, 100, config.hp);
    hpSlider.input.addEventListener("change", () => this.emit());
    body.appendChild(hpSlider.row);
    this.hpSlider = hpSlider.input;

    const statusSelect = this.createSelect(
      t("sandbox.status"),
      [{ value: "", label: t("sandbox.none") }, ...STATUS_ENTRIES.map(([s, key]) => ({ value: s, label: t(key) }))],
      config.status ?? "",
    );
    statusSelect.select.addEventListener("change", () => this.emit());
    body.appendChild(statusSelect.row);
    this.statusSelect = statusSelect.select;

    const volatileStatusSelect = this.createSelect(
      t("sandbox.volatile"),
      [
        { value: "", label: t("sandbox.none") },
        ...VOLATILE_STATUS_ENTRIES.map(([s, key]) => ({ value: s, label: t(key) })),
      ],
      config.volatileStatus ?? "",
    );
    volatileStatusSelect.select.addEventListener("change", () => this.emit());
    body.appendChild(volatileStatusSelect.row);
    this.volatileStatusSelect = volatileStatusSelect.select;

    for (const stat of STAT_NAMES) {
      const slider = this.createSlider(
        t(STAT_TRANSLATION_KEYS[stat]),
        -6,
        6,
        config.statStages[stat] ?? 0,
      );
      slider.input.addEventListener("change", () => this.emit());
      body.appendChild(slider.row);
      this.statSliders.set(stat, slider.input);
    }

    return panel;
  }

  private buildDummyPanel(config: SandboxConfig): HTMLDivElement {
    const panel = document.createElement("div");

    const header = this.createHeader(t("sandbox.dummy"), () => {
      this.dummyCollapsed = !this.dummyCollapsed;
      this.toggleBody(panel, this.dummyCollapsed);
    });
    panel.appendChild(header);

    const body = this.createBody();
    panel.appendChild(body);

    const defensiveMoves = this.gameData.moves.filter((m) => DEFENSIVE_MOVE_IDS.includes(m.id));
    const dummyMoveSelect = this.createSelect(
      t("sandbox.move"),
      [
        { value: "", label: t("sandbox.passive") },
        ...defensiveMoves.map((m) => ({ value: m.id, label: this.moveName(m.id) })),
      ],
      config.dummyMove ?? "",
    );
    dummyMoveSelect.select.addEventListener("change", () => this.emit());
    body.appendChild(dummyMoveSelect.row);
    this.dummyMoveSelect = dummyMoveSelect.select;

    const dirSelect = this.createSelect(
      t("sandbox.direction"),
      DIRECTION_ENTRIES.map(([d, key]) => ({ value: d, label: t(key) })),
      config.dummyDirection,
    );
    dirSelect.select.addEventListener("change", () => this.emit());
    body.appendChild(dirSelect.row);
    this.dummyDirectionSelect = dirSelect.select;

    const hpSlider = this.createSlider(t("sandbox.hpPercent"), 1, 100, config.dummyHp);
    hpSlider.input.addEventListener("change", () => this.emit());
    body.appendChild(hpSlider.row);
    this.dummyHpSlider = hpSlider.input;

    const statusSelect = this.createSelect(
      t("sandbox.status"),
      [{ value: "", label: t("sandbox.none") }, ...STATUS_ENTRIES.map(([s, key]) => ({ value: s, label: t(key) }))],
      config.dummyStatus ?? "",
    );
    statusSelect.select.addEventListener("change", () => this.emit());
    body.appendChild(statusSelect.row);
    this.dummyStatusSelect = statusSelect.select;

    const dummyVolatileStatusSelect = this.createSelect(
      t("sandbox.volatile"),
      [
        { value: "", label: t("sandbox.none") },
        ...VOLATILE_STATUS_ENTRIES.map(([s, key]) => ({ value: s, label: t(key) })),
      ],
      config.dummyVolatileStatus ?? "",
    );
    dummyVolatileStatusSelect.select.addEventListener("change", () => this.emit());
    body.appendChild(dummyVolatileStatusSelect.row);
    this.dummyVolatileStatusSelect = dummyVolatileStatusSelect.select;

    for (const stat of STAT_NAMES) {
      const slider = this.createSlider(
        t(STAT_TRANSLATION_KEYS[stat]),
        -6,
        6,
        config.dummyStatStages[stat] ?? 0,
      );
      slider.input.addEventListener("change", () => this.emit());
      body.appendChild(slider.row);
      this.dummyStatSliders.set(stat, slider.input);
    }

    const presetSelect = this.createSelect(
      t("sandbox.statsFrom"),
      [
        { value: "", label: t("sandbox.custom") },
        ...this.pokemonIds
          .filter((id) => id !== "dummy")
          .map((id) => ({ value: id, label: this.pokemonName(id) })),
      ],
      config.dummyPokemon === "dummy" ? "" : config.dummyPokemon,
    );
    presetSelect.select.addEventListener("change", () => {
      this.syncDummyBaseStats();
      this.emit();
    });
    body.appendChild(presetSelect.row);
    this.dummyPokemonSelect = presetSelect.select;

    const statsHeader = document.createElement("div");
    statsHeader.style.cssText =
      "display: flex; justify-content: space-between; font-size: 9px; color: #888; margin-bottom: 2px;";
    statsHeader.innerHTML =
      `<span style="width:30px"></span><span style="flex:1;text-align:center">${t("sandbox.base")}</span><span style="width:35px;text-align:right">${t("sandbox.computed")}</span>`;
    body.appendChild(statsHeader);

    const dummyDef = this.gameData.pokemon.find((p) => p.id === config.dummyPokemon);
    const dummyLevel = 50;

    const levelRow = this.createNumberInput(t("sandbox.level"), 1, 100, dummyLevel);
    levelRow.input.addEventListener("change", () => {
      this.updateComputedStats();
      this.emit();
    });
    body.appendChild(levelRow.row);
    this.dummyLevelInput = levelRow.input;

    for (const key of BASE_STAT_KEYS) {
      const baseValue = dummyDef?.baseStats[key] ?? 50;
      const computedValue = computeStatAtLevel(baseValue, dummyLevel, key === "hp");

      const row = document.createElement("div");
      row.style.cssText =
        "display: flex; justify-content: space-between; align-items: center; margin: 1px 0;";

      const label = document.createElement("span");
      label.textContent = BASE_STAT_LABELS[key] ?? key;
      label.style.cssText = "width: 30px; flex-shrink: 0;";
      row.appendChild(label);

      const input = document.createElement("input");
      input.type = "number";
      input.min = "1";
      input.max = "255";
      input.value = String(baseValue);
      input.style.cssText =
        "width: 45px; background: #222; color: #ddd; border: 1px solid #444; border-radius: 3px; padding: 1px 3px; font-size: 10px; font-family: monospace; text-align: center;";
      input.addEventListener("change", () => {
        this.updateComputedStats();
        this.emit();
      });
      row.appendChild(input);
      this.dummyBaseStatInputs.set(key, input);

      const computed = document.createElement("span");
      computed.textContent = String(computedValue);
      computed.style.cssText = "width: 35px; text-align: right; color: #8cf; font-size: 10px;";
      row.appendChild(computed);
      this.dummyComputedLabels.set(key, computed);

      body.appendChild(row);
    }

    return panel;
  }

  private updatePlayerMoves(): void {
    const movepool = this.getMovepoolFor(this.pokemonSelect.value);
    const pokemonDef = this.gameData.pokemon.find((p) => p.id === this.pokemonSelect.value);

    for (let i = 0; i < this.moveSelects.length; i++) {
      const select = this.moveSelects[i];
      if (!select) continue;

      if (!movepool.includes(select.value)) {
        select.value = "";
      }
      if (select.value === "" && pokemonDef) {
        select.value = pokemonDef.movepool[i] ?? "";
      }
    }
    this.rebuildMoveOptions();
  }

  private deduplicateMoveSlot(changedSelect: HTMLSelectElement): void {
    const selectedValue = changedSelect.value;
    if (!selectedValue) return;

    for (const other of this.moveSelects) {
      if (other !== changedSelect && other.value === selectedValue) {
        other.value = "";
      }
    }
  }

  private rebuildMoveOptions(): void {
    const movepool = this.getMovepoolFor(this.pokemonSelect.value);

    for (const select of this.moveSelects) {
      const currentValue = select.value;
      select.innerHTML = "";

      const emptyOpt = document.createElement("option");
      emptyOpt.value = "";
      emptyOpt.textContent = t("sandbox.none");
      select.appendChild(emptyOpt);

      for (const id of movepool) {
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = this.moveName(id);
        select.appendChild(opt);
      }

      select.value = movepool.includes(currentValue) ? currentValue : "";
    }
  }

  private syncDummyBaseStats(): void {
    const selectedId = this.dummyPokemonSelect.value;
    const pokemonDef = selectedId ? this.gameData.pokemon.find((p) => p.id === selectedId) : null;

    const defaultStats = {
      hp: 100,
      attack: 50,
      defense: 50,
      spAttack: 50,
      spDefense: 50,
      speed: 50,
    };

    for (const key of BASE_STAT_KEYS) {
      const input = this.dummyBaseStatInputs.get(key);
      if (input) {
        input.value = String(pokemonDef?.baseStats[key] ?? defaultStats[key]);
      }
    }
    this.updateComputedStats();
  }

  private updateComputedStats(): void {
    const level = Number(this.dummyLevelInput.value) || 50;
    for (const key of BASE_STAT_KEYS) {
      const input = this.dummyBaseStatInputs.get(key);
      const label = this.dummyComputedLabels.get(key);
      if (input && label) {
        const base = Number(input.value) || 50;
        label.textContent = String(computeStatAtLevel(base, level, key === "hp"));
      }
    }
  }

  private readConfig(): SandboxConfig {
    const moves = this.moveSelects.map((s) => s.value).filter((v) => v !== "");

    const statStages: Partial<Record<StatName, number>> = {};
    for (const stat of STAT_NAMES) {
      const slider = this.statSliders.get(stat);
      if (slider) {
        const value = Number(slider.value);
        if (value !== 0) statStages[stat] = value;
      }
    }

    const dummyStatStages: Partial<Record<StatName, number>> = {};
    for (const stat of STAT_NAMES) {
      const slider = this.dummyStatSliders.get(stat);
      if (slider) {
        const value = Number(slider.value);
        if (value !== 0) dummyStatStages[stat] = value;
      }
    }

    return {
      pokemon: this.pokemonSelect.value,
      moves: moves.length > 0 ? moves : this.getMovepoolFor(this.pokemonSelect.value),
      hp: Number(this.hpSlider.value),
      status: this.statusSelect.value ? (this.statusSelect.value as StatusType) : null,
      volatileStatus: this.volatileStatusSelect.value
        ? (this.volatileStatusSelect.value as StatusType)
        : null,
      statStages,
      dummyPokemon: this.dummyPokemonSelect.value || "dummy",
      dummyMove: this.dummyMoveSelect.value || null,
      dummyDirection: this.dummyDirectionSelect.value as Direction,
      dummyHp: Number(this.dummyHpSlider.value),
      dummyLevel: Number(this.dummyLevelInput.value) || 50,
      dummyBaseStats: this.readDummyBaseStats(),
      dummyStatus: this.dummyStatusSelect.value
        ? (this.dummyStatusSelect.value as StatusType)
        : null,
      dummyVolatileStatus: this.dummyVolatileStatusSelect.value
        ? (this.dummyVolatileStatusSelect.value as StatusType)
        : null,
      dummyStatStages,
    };
  }

  private readDummyBaseStats(): BaseStats | null {
    const pokemonDef = this.gameData.pokemon.find((p) => p.id === this.dummyPokemonSelect.value);
    const defaultStats = pokemonDef?.baseStats;

    let hasOverride = false;
    const stats: BaseStats = {
      hp: 50,
      attack: 50,
      defense: 50,
      spAttack: 50,
      spDefense: 50,
      speed: 50,
    };

    for (const key of BASE_STAT_KEYS) {
      const input = this.dummyBaseStatInputs.get(key);
      if (input) {
        const value = Number(input.value) || 50;
        stats[key] = value;
        if (defaultStats && value !== defaultStats[key]) {
          hasOverride = true;
        }
      }
    }

    return hasOverride ? stats : null;
  }

  private buildUrl(): string {
    const config = this.readConfig();
    const params = new URLSearchParams();
    params.set("sandbox", "");
    params.set("pokemon", config.pokemon);
    if (config.moves.length > 0) params.set("moves", config.moves.join(","));
    if (config.hp !== 100) params.set("hp", String(config.hp));
    if (config.status) params.set("status", config.status);
    if (config.volatileStatus) params.set("volatileStatus", config.volatileStatus);
    if (Object.keys(config.statStages).length > 0) {
      params.set(
        "statStages",
        Object.entries(config.statStages)
          .map(([k, v]) => `${k}:${v}`)
          .join(","),
      );
    }
    params.set("dummy", config.dummyPokemon);
    if (config.dummyMove) params.set("dummyMove", config.dummyMove);
    if (config.dummyDirection !== Direction.West)
      params.set("dummyDirection", config.dummyDirection);
    if (config.dummyHp !== 100) params.set("dummyHp", String(config.dummyHp));
    if (config.dummyStatus) params.set("dummyStatus", config.dummyStatus);
    if (config.dummyVolatileStatus) params.set("dummyVolatileStatus", config.dummyVolatileStatus);
    if (Object.keys(config.dummyStatStages).length > 0) {
      params.set(
        "dummyStatStages",
        Object.entries(config.dummyStatStages)
          .map(([k, v]) => `${k}:${v}`)
          .join(","),
      );
    }

    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  }

  private copyUrl(): void {
    const url = this.buildUrl();
    navigator.clipboard.writeText(url);
  }

  private getMovepoolFor(pokemonId: string): string[] {
    const def = this.gameData.pokemon.find((p) => p.id === pokemonId);
    return def?.movepool ?? [];
  }

  private pokemonName(id: string): string {
    return getPokemonName(id, getLanguage());
  }

  private moveName(id: string): string {
    return getMoveName(id, getLanguage());
  }

  private createHeader(title: string, onClick: () => void): HTMLDivElement {
    const header = document.createElement("div");
    header.style.cssText = HEADER_STYLE;
    const titleSpan = document.createElement("span");
    titleSpan.textContent = title;
    header.appendChild(titleSpan);
    const toggle = document.createElement("span");
    toggle.textContent = "▼";
    toggle.className = "sandbox-toggle";
    header.appendChild(toggle);
    header.addEventListener("click", onClick);
    return header;
  }

  private createBody(): HTMLDivElement {
    const body = document.createElement("div");
    body.className = "sandbox-body";
    body.style.cssText =
      "padding: 6px; display: flex; flex-direction: column; gap: 4px; max-height: 80vh; overflow-y: auto;";
    return body;
  }

  private toggleBody(panel: HTMLDivElement, collapsed: boolean): void {
    const body = panel.querySelector(".sandbox-body") as HTMLElement | null;
    const toggle = panel.querySelector(".sandbox-toggle") as HTMLElement | null;
    if (body) body.style.display = collapsed ? "none" : "flex";
    if (toggle) toggle.textContent = collapsed ? "▶" : "▼";
  }

  private createSelect(
    label: string,
    options: { value: string; label: string }[],
    selected: string,
  ): { row: HTMLDivElement; select: HTMLSelectElement } {
    const row = document.createElement("div");
    row.style.cssText =
      "display: flex; justify-content: space-between; align-items: center; margin: 1px 0;";

    const labelElement = document.createElement("span");
    labelElement.textContent = label;
    labelElement.style.cssText = "flex-shrink: 0; width: 55px;";
    row.appendChild(labelElement);

    const select = document.createElement("select");
    select.style.cssText =
      "flex: 1; background: #222; color: #ddd; border: 1px solid #444; border-radius: 3px; padding: 2px; font-size: 10px; font-family: monospace;";
    for (const option of options) {
      const opt = document.createElement("option");
      opt.value = option.value;
      opt.textContent = option.label;
      if (option.value === selected) opt.selected = true;
      select.appendChild(opt);
    }
    row.appendChild(select);
    return { row, select };
  }

  private createSlider(
    label: string,
    min: number,
    max: number,
    value: number,
  ): { row: HTMLDivElement; input: HTMLInputElement } {
    const row = document.createElement("div");
    row.style.cssText =
      "display: flex; justify-content: space-between; align-items: center; margin: 1px 0;";

    const labelElement = document.createElement("span");
    labelElement.textContent = label;
    labelElement.style.cssText = "flex-shrink: 0; width: 35px;";
    row.appendChild(labelElement);

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.value = String(value);
    input.style.cssText = "flex: 1; margin: 0 4px;";
    row.appendChild(input);

    const valueLabel = document.createElement("span");
    valueLabel.textContent = String(value);
    valueLabel.style.cssText = "width: 24px; text-align: right; font-size: 10px;";
    input.addEventListener("input", () => {
      valueLabel.textContent = input.value;
    });
    row.appendChild(valueLabel);
    return { row, input };
  }

  private createNumberInput(
    label: string,
    min: number,
    max: number,
    value: number,
  ): { row: HTMLDivElement; input: HTMLInputElement } {
    const row = document.createElement("div");
    row.style.cssText =
      "display: flex; justify-content: space-between; align-items: center; margin: 1px 0;";

    const labelElement = document.createElement("span");
    labelElement.textContent = label;
    labelElement.style.cssText = "flex-shrink: 0; width: 45px;";
    row.appendChild(labelElement);

    const input = document.createElement("input");
    input.type = "number";
    input.min = String(min);
    input.max = String(max);
    input.value = String(value);
    input.style.cssText =
      "width: 50px; background: #222; color: #ddd; border: 1px solid #444; border-radius: 3px; padding: 1px 3px; font-size: 10px; font-family: monospace; text-align: center;";
    row.appendChild(input);
    return { row, input };
  }

  private createButton(text: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.textContent = text;
    button.style.cssText = `
      width: 100%; padding: 5px; background: #335; border: 1px solid #557;
      color: #ddd; border-radius: 4px; cursor: pointer; font-family: monospace;
      font-size: 10px; margin-top: 4px;
    `;
    button.addEventListener("click", onClick);
    return button;
  }
}
