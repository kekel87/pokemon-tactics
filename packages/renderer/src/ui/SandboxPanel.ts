import { Direction, type HeldItemId, StatName, StatusType, Weather } from "@pokemon-tactic/core";
import {
  getLegalMoves,
  getMoveName,
  getPokemonAbilities,
  getPokemonName,
  loadData,
} from "@pokemon-tactic/data";
import type { TranslationKey } from "../i18n";
import { getLanguage, t } from "../i18n";
import { getSandboxStudioDom } from "../sandbox-boot";
import { getAbilityInfo, getMoveInfo } from "../team/team-builder-data";
import { DEFAULT_SANDBOX_CONFIG, type SandboxConfig } from "../types/SandboxConfig";
import { openItemPickerModal } from "./team/ItemPickerModal";
import { openMovePickerModal } from "./team/MovePickerModal";
import { openPokemonPickerModal } from "./team/PokemonPickerModal";

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

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

const SANDBOX_MAPS: { value: string; label: string }[] = [
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

const HEADER_STYLE = `
  padding: 5px 8px; background: rgba(30,30,60,0.95); cursor: pointer;
  display: flex; justify-content: space-between; align-items: center;
  border-bottom: 1px solid #444; font-weight: bold;
`;

export class SandboxPanel {
  private readonly onConfigChanged: (config: SandboxConfig) => void;
  private readonly gameData = loadData();

  private mapSelect!: HTMLSelectElement;
  private playerX = 0;
  private playerY = 0;
  private dummyX = 0;
  private dummyY = 0;
  private setPlayerX?: (v: number) => void;
  private setPlayerY?: (v: number) => void;
  private setDummyX?: (v: number) => void;
  private setDummyY?: (v: number) => void;
  private playerDirectionSelect!: HTMLSelectElement;
  private dummyDirectionSelect!: HTMLSelectElement;
  private debugDecorationsFootprintCheckbox!: HTMLInputElement;
  private weatherSelect!: HTMLSelectElement;
  private weatherTurnsInput!: HTMLInputElement;

  private playerPokemonId = "";
  private playerPokemonButton!: HTMLButtonElement;
  private playerMoveCards: HTMLButtonElement[] = [];
  private playerMoves: string[] = [];
  private hpSlider!: HTMLInputElement;
  private statusSelect!: HTMLSelectElement;
  private volatileStatusSelect!: HTMLSelectElement;
  private playerHeldItemId = "";
  private playerHeldItemButton!: HTMLButtonElement;
  private playerAbilitySelect!: HTMLSelectElement;
  private statSliders: Map<StatName, HTMLInputElement> = new Map();

  private dummyPokemonId = "";
  private dummyPokemonButton!: HTMLButtonElement;
  private dummyMoveSelect!: HTMLSelectElement;
  private dummyHpSlider!: HTMLInputElement;
  private dummyStatusSelect!: HTMLSelectElement;
  private dummyVolatileStatusSelect!: HTMLSelectElement;
  private dummyHeldItemId = "";
  private dummyHeldItemButton!: HTMLButtonElement;
  private dummyAbility = "";
  private dummyStatSliders: Map<StatName, HTMLInputElement> = new Map();
  private dummyControl: "ai" | "player" = "ai";
  private dummyMoves: string[] = [];
  private dummyMoveCards: HTMLButtonElement[] = [];
  private dummyMovesContainer: HTMLDivElement | null = null;
  private dummyMoveDefensiveRow: HTMLDivElement | null = null;

  constructor(initialConfig: SandboxConfig, onConfigChanged: (config: SandboxConfig) => void) {
    this.onConfigChanged = onConfigChanged;
    this.dummyControl = initialConfig.dummyControl;
    this.dummyMoves = [...initialConfig.dummyMoves];
    this.playerPokemonId = initialConfig.pokemon;
    this.dummyPokemonId = initialConfig.dummyPokemon;
    this.playerHeldItemId = initialConfig.heldItem ?? "";
    this.dummyHeldItemId = initialConfig.dummyHeldItem ?? "";
    this.dummyAbility = initialConfig.dummyAbility ?? this.getFirstAbility("dummy");

    const dom = getSandboxStudioDom();

    dom.playerColumn.replaceChildren(this.buildPlayerPanel(initialConfig));
    dom.dummyColumn.replaceChildren(this.buildDummyPanel(initialConfig));
    dom.battleStrip.replaceChildren(this.buildMapPanel(initialConfig));
  }

  destroy(): void {
    const dom = getSandboxStudioDom();
    dom.playerColumn.replaceChildren();
    dom.dummyColumn.replaceChildren();
    dom.battleStrip.replaceChildren();
  }

  setResolvedPositions(player: { x: number; y: number }, dummy: { x: number; y: number }): void {
    this.setPlayerX?.(player.x);
    this.setPlayerY?.(player.y);
    this.setDummyX?.(dummy.x);
    this.setDummyY?.(dummy.y);
  }

  private emit(): void {
    this.onConfigChanged(this.readConfig());
  }

  private buildMapPanel(config: SandboxConfig): HTMLDivElement {
    const panel = document.createElement("div");
    panel.style.cssText =
      "display: flex; justify-content: space-between; align-items: center; gap: 20px; width: 100%; flex-wrap: wrap;";

    const left = document.createElement("div");
    left.style.cssText = "display: flex; gap: 12px; align-items: center; flex-wrap: wrap;";
    panel.appendChild(left);

    const mapSelect = this.createInlineSelect("Map", SANDBOX_MAPS, config.mapUrl ?? "");
    mapSelect.select.addEventListener("change", () => this.emit());
    left.appendChild(mapSelect.row);
    this.mapSelect = mapSelect.select;

    const weatherSelect = this.createInlineSelect(
      t("sandbox.weather"),
      [
        { value: Weather.None, label: t("weather.none") },
        { value: Weather.Sun, label: t("weather.sun") },
        { value: Weather.Rain, label: t("weather.rain") },
        { value: Weather.Sandstorm, label: t("weather.sandstorm") },
        { value: Weather.Snow, label: t("weather.snow") },
      ],
      config.weather ?? Weather.None,
    );
    weatherSelect.select.addEventListener("change", () => this.emit());
    left.appendChild(weatherSelect.row);
    this.weatherSelect = weatherSelect.select;

    const weatherTurns = this.createOptionalNumberInput(
      t("sandbox.weatherTurns"),
      1,
      8,
      config.weatherTurns,
      "5",
    );
    weatherTurns.input.addEventListener("change", () => this.emit());
    left.appendChild(weatherTurns.row);
    this.weatherTurnsInput = weatherTurns.input;

    const debugFootprint = this.createCheckbox(
      "Debug footprint",
      config.debugDecorationsFootprint ?? false,
    );
    debugFootprint.input.addEventListener("change", () => this.emit());
    left.appendChild(debugFootprint.row);
    this.debugDecorationsFootprintCheckbox = debugFootprint.input;

    const right = document.createElement("div");
    right.style.cssText = "display: flex; gap: 8px; align-items: center;";
    panel.appendChild(right);

    const resetButton = this.createButton(t("sandbox.reset"), () =>
      this.onConfigChanged({ ...DEFAULT_SANDBOX_CONFIG }),
    );
    resetButton.style.width = "auto";
    resetButton.style.marginTop = "0";
    right.appendChild(resetButton);

    const exportButton = this.createButton(t("sandbox.exportJson"), () => this.copyJson());
    exportButton.style.width = "auto";
    exportButton.style.marginTop = "0";
    right.appendChild(exportButton);

    const importButton = this.createButton(t("sandbox.importJson"), () => void this.importJson());
    importButton.style.width = "auto";
    importButton.style.marginTop = "0";
    right.appendChild(importButton);

    return panel;
  }

  private createInlineSelect(
    label: string,
    options: { value: string; label: string }[],
    selected: string,
  ): { row: HTMLDivElement; select: HTMLSelectElement } {
    const row = document.createElement("div");
    row.style.cssText = "display: flex; gap: 6px; align-items: center;";
    const labelEl = document.createElement("span");
    labelEl.textContent = `${label}:`;
    labelEl.style.cssText = "color: #aac;";
    row.appendChild(labelEl);
    const select = document.createElement("select");
    select.style.cssText =
      "background: #222; color: #ddd; border: 1px solid #444; border-radius: 3px; padding: 2px;";
    for (const option of options) {
      const opt = document.createElement("option");
      opt.value = option.value;
      opt.textContent = option.label;
      if (option.value === selected) {
        opt.selected = true;
      }
      select.appendChild(opt);
    }
    row.appendChild(select);
    return { row, select };
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

  private buildPlayerPanel(config: SandboxConfig): HTMLDivElement {
    const panel = document.createElement("div");

    const header = this.createHeader(t("sandbox.player"));
    panel.appendChild(header);

    const body = this.createBody();
    panel.appendChild(body);

    const grid = document.createElement("div");
    grid.style.cssText = "display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px;";
    body.appendChild(grid);

    const colLeft = document.createElement("div");
    colLeft.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
    const colRight = document.createElement("div");
    colRight.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
    grid.appendChild(colLeft);
    grid.appendChild(colRight);

    const pokemonCard = this.createPickerCard(
      t("sandbox.pokemon"),
      this.pokemonName(this.playerPokemonId),
      () => {
        openPokemonPickerModal({
          onSelect: (pk) => {
            this.playerPokemonId = pk.id;
            this.playerPokemonButton.textContent = this.pokemonName(pk.id);
            this.updatePlayerMoves();
            this.rebuildPlayerAbilityOptions();
            this.emit();
          },
        });
      },
    );
    colLeft.appendChild(pokemonCard.row);
    this.playerPokemonButton = pokemonCard.button;

    const playerAbility = this.createSelect(
      t("sandbox.ability"),
      this.buildAbilityOptions(config.pokemon),
      config.playerAbility ?? "",
    );
    playerAbility.select.addEventListener("change", () => this.emit());
    colLeft.appendChild(playerAbility.row);
    this.playerAbilitySelect = playerAbility.select;

    const itemCard = this.createPickerCard("Item", this.itemName(this.playerHeldItemId), () => {
      openItemPickerModal({
        onSelect: (item) => {
          this.playerHeldItemId = item?.id ?? "";
          this.playerHeldItemButton.textContent = this.itemName(this.playerHeldItemId);
          this.emit();
        },
      });
    });
    colLeft.appendChild(itemCard.row);
    this.playerHeldItemButton = itemCard.button;

    const hpSlider = this.createSlider(t("sandbox.hpPercent"), 1, 100, config.hp);
    hpSlider.input.addEventListener("change", () => this.emit());
    colLeft.appendChild(hpSlider.row);
    this.hpSlider = hpSlider.input;

    const statusSelect = this.createSelect(
      t("sandbox.status"),
      [
        { value: "", label: t("sandbox.none") },
        ...STATUS_ENTRIES.map(([s, key]) => ({ value: s, label: t(key) })),
      ],
      config.status ?? "",
    );
    statusSelect.select.addEventListener("change", () => this.emit());
    colRight.appendChild(statusSelect.row);
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
    colRight.appendChild(volatileStatusSelect.row);
    this.volatileStatusSelect = volatileStatusSelect.select;

    colRight.appendChild(this.buildStatStagesRow(config.statStages, "player"));
    colRight.appendChild(
      this.buildPositionRow(config.playerPosition, config.playerDirection, "player"),
    );

    const movepool = this.getMovepoolFor(config.pokemon);
    this.playerMoves = [];
    for (let i = 0; i < 4; i++) {
      const moveId = config.moves[i] ?? movepool[i] ?? "";
      this.playerMoves.push(moveId);
    }
    const movesContainer = this.buildMoveCardsRow("player");
    movesContainer.style.gridColumn = "1 / -1";
    grid.appendChild(movesContainer);

    return panel;
  }

  private buildDummyPanel(config: SandboxConfig): HTMLDivElement {
    const panel = document.createElement("div");

    const header = this.createHeader(t("sandbox.dummy"));
    panel.appendChild(header);

    const body = this.createBody();
    panel.appendChild(body);

    const grid = document.createElement("div");
    grid.style.cssText = "display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px;";
    body.appendChild(grid);

    const colLeft = document.createElement("div");
    colLeft.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
    const colRight = document.createElement("div");
    colRight.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
    grid.appendChild(colLeft);
    grid.appendChild(colRight);

    const pokemonCard = this.createPickerCard(
      t("sandbox.pokemon"),
      this.pokemonName(this.dummyPokemonId),
      () => {
        openPokemonPickerModal({
          onSelect: (pk) => {
            this.dummyPokemonId = pk.id;
            this.dummyPokemonButton.textContent = this.pokemonName(pk.id);
            this.dummyAbility = this.getFirstAbility(pk.id);
            this.emit();
          },
        });
      },
    );
    colLeft.appendChild(pokemonCard.row);
    this.dummyPokemonButton = pokemonCard.button;

    const itemCard = this.createPickerCard("Item", this.itemName(this.dummyHeldItemId), () => {
      openItemPickerModal({
        onSelect: (item) => {
          this.dummyHeldItemId = item?.id ?? "";
          this.dummyHeldItemButton.textContent = this.itemName(this.dummyHeldItemId);
          this.emit();
        },
      });
    });
    colLeft.appendChild(itemCard.row);
    this.dummyHeldItemButton = itemCard.button;

    const hpSlider = this.createSlider(t("sandbox.hpPercent"), 1, 100, config.dummyHp);
    hpSlider.input.addEventListener("change", () => this.emit());
    colLeft.appendChild(hpSlider.row);
    this.dummyHpSlider = hpSlider.input;

    const statusSelect = this.createSelect(
      t("sandbox.status"),
      [
        { value: "", label: t("sandbox.none") },
        ...STATUS_ENTRIES.map(([s, key]) => ({ value: s, label: t(key) })),
      ],
      config.dummyStatus ?? "",
    );
    statusSelect.select.addEventListener("change", () => this.emit());
    colLeft.appendChild(statusSelect.row);
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
    colRight.appendChild(dummyVolatileStatusSelect.row);
    this.dummyVolatileStatusSelect = dummyVolatileStatusSelect.select;

    colRight.appendChild(this.buildStatStagesRow(config.dummyStatStages, "dummy"));
    colRight.appendChild(
      this.buildPositionRow(config.dummyPosition, config.dummyDirection, "dummy"),
    );

    const controlRow = document.createElement("div");
    controlRow.style.cssText = "display: flex; gap: 8px; align-items: center; margin: 4px 0;";
    const controlLabel = document.createElement("span");
    controlLabel.textContent = `${t("sandbox.dummyControl")}:`;
    controlLabel.style.cssText = "color: #aac;";
    controlRow.appendChild(controlLabel);
    const radioAi = this.createControlRadio("ai", t("sandbox.dummyControl.ai"));
    const radioPlayer = this.createControlRadio("player", t("sandbox.dummyControl.player"));
    controlRow.appendChild(radioAi);
    controlRow.appendChild(radioPlayer);
    colRight.appendChild(controlRow);

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
    dummyMoveSelect.row.style.gridColumn = "1 / -1";
    grid.appendChild(dummyMoveSelect.row);
    this.dummyMoveSelect = dummyMoveSelect.select;
    this.dummyMoveDefensiveRow = dummyMoveSelect.row;

    this.dummyMovesContainer = this.buildMoveCardsRow("dummy");
    this.dummyMovesContainer.style.gridColumn = "1 / -1";
    grid.appendChild(this.dummyMovesContainer);

    this.applyDummyControlVisibility();

    return panel;
  }

  private updatePlayerMoves(): void {
    const movepool = this.getMovepoolFor(this.playerPokemonId);
    this.playerMoves = this.playerMoves.map((id) => (movepool.includes(id) ? id : ""));
    for (let i = 0; i < this.playerMoveCards.length; i++) {
      this.refreshMoveCard("player", i);
    }
  }

  private createStepperButton(
    initialValue: number,
    min: number,
    max: number,
    format: (v: number) => string,
    onChange: (v: number) => void,
  ): { button: HTMLButtonElement; hidden: HTMLInputElement; setValue: (v: number) => void } {
    const button = document.createElement("button");
    button.type = "button";
    const hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.value = String(initialValue);
    button.textContent = format(initialValue);
    button.style.cssText =
      "background: #1a1a2e; color: #ddd; border: 1px solid #335; border-radius: 3px; padding: 2px 6px; cursor: pointer; min-width: 32px;";
    const setValue = (v: number) => {
      hidden.value = String(v);
      button.textContent = format(v);
    };
    const step = (delta: number) => (e: MouseEvent) => {
      e.preventDefault();
      const current = Number(hidden.value);
      const next = Math.max(min, Math.min(max, current + delta));
      if (next === current) {
        return;
      }
      setValue(next);
      onChange(next);
    };
    button.addEventListener("click", step(1));
    button.addEventListener("contextmenu", step(-1));
    return { button, hidden, setValue };
  }

  private buildStatStagesRow(
    initial: Partial<Record<StatName, number>>,
    owner: "player" | "dummy",
  ): HTMLDivElement {
    const row = document.createElement("div");
    row.style.cssText = "display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px;";
    const sliderMap = owner === "player" ? this.statSliders : this.dummyStatSliders;
    for (const stat of STAT_NAMES) {
      const cell = document.createElement("div");
      cell.style.cssText = "display: flex; flex-direction: column; align-items: center; gap: 2px;";
      const label = document.createElement("span");
      label.textContent = t(STAT_TRANSLATION_KEYS[stat]);
      label.style.cssText = "color: #aac;";
      cell.appendChild(label);
      const stepper = this.createStepperButton(
        initial[stat] ?? 0,
        -6,
        6,
        (v) => (v >= 0 ? `+${v}` : `${v}`),
        () => this.emit(),
      );
      cell.appendChild(stepper.button);
      cell.appendChild(stepper.hidden);
      row.appendChild(cell);
      sliderMap.set(stat, stepper.hidden);
    }
    return row;
  }

  private buildPositionRow(
    position: { x: number; y: number } | undefined,
    direction: Direction | undefined,
    owner: "player" | "dummy",
  ): HTMLDivElement {
    const row = document.createElement("div");
    row.style.cssText = "display: flex; gap: 6px; align-items: center;";
    const labelEl = document.createElement("span");
    labelEl.textContent = "Pos:";
    labelEl.style.cssText = "color: #aac;";
    row.appendChild(labelEl);

    const xLabel = document.createElement("span");
    xLabel.textContent = "X";
    xLabel.style.cssText = "color: #aac;";
    row.appendChild(xLabel);
    const onX = (v: number) => {
      if (owner === "player") {
        this.playerX = v;
      } else {
        this.dummyX = v;
      }
      this.emit();
    };
    const xStepper = this.createStepperButton(position?.x ?? 0, 0, 99, (v) => `${v}`, onX);
    row.appendChild(xStepper.button);

    const yLabel = document.createElement("span");
    yLabel.textContent = "Y";
    yLabel.style.cssText = "color: #aac;";
    row.appendChild(yLabel);
    const onY = (v: number) => {
      if (owner === "player") {
        this.playerY = v;
      } else {
        this.dummyY = v;
      }
      this.emit();
    };
    const yStepper = this.createStepperButton(position?.y ?? 0, 0, 99, (v) => `${v}`, onY);
    row.appendChild(yStepper.button);

    const dir = this.createSelect(
      "Dir",
      DIRECTION_ENTRIES.map(([d, key]) => ({ value: d, label: t(key) })),
      direction ?? Direction.North,
    );
    dir.select.addEventListener("change", () => this.emit());
    row.appendChild(dir.row);

    if (owner === "player") {
      this.playerX = position?.x ?? 0;
      this.playerY = position?.y ?? 0;
      this.setPlayerX = (v) => {
        this.playerX = v;
        xStepper.setValue(v);
      };
      this.setPlayerY = (v) => {
        this.playerY = v;
        yStepper.setValue(v);
      };
      this.playerDirectionSelect = dir.select;
    } else {
      this.dummyX = position?.x ?? 0;
      this.dummyY = position?.y ?? 0;
      this.setDummyX = (v) => {
        this.dummyX = v;
        xStepper.setValue(v);
      };
      this.setDummyY = (v) => {
        this.dummyY = v;
        yStepper.setValue(v);
      };
      this.dummyDirectionSelect = dir.select;
    }
    return row;
  }

  private buildMoveCardsRow(owner: "player" | "dummy"): HTMLDivElement {
    const row = document.createElement("div");
    row.style.cssText = "display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin: 4px 0;";

    const cards = owner === "player" ? this.playerMoveCards : this.dummyMoveCards;
    cards.length = 0;
    const moves = owner === "player" ? this.playerMoves : this.dummyMoves;
    while (moves.length < 4) {
      moves.push("");
    }

    for (let i = 0; i < 4; i++) {
      const card = document.createElement("button");
      card.type = "button";
      card.style.cssText =
        "padding: 4px 6px; background: #1a1a2e; color: #ddd; border: 1px solid #335; border-radius: 3px; font-family: monospace; font-size: 10px; text-align: left; cursor: pointer;";
      card.addEventListener("click", () => this.openMovePickerForSlot(owner, i));
      row.appendChild(card);
      cards.push(card);
      this.refreshMoveCardFor(card, moves[i] ?? "");
    }
    return row;
  }

  private refreshMoveCard(owner: "player" | "dummy", index: number): void {
    const cards = owner === "player" ? this.playerMoveCards : this.dummyMoveCards;
    const moves = owner === "player" ? this.playerMoves : this.dummyMoves;
    const card = cards[index];
    if (!card) {
      return;
    }
    this.refreshMoveCardFor(card, moves[index] ?? "");
  }

  private refreshMoveCardFor(card: HTMLButtonElement, moveId: string): void {
    if (moveId === "") {
      card.textContent = `+ ${t("sandbox.move")}`;
      card.style.opacity = "0.5";
      return;
    }
    card.style.opacity = "1";
    const info = getMoveInfo(moveId);
    card.textContent = info?.name ?? this.moveName(moveId);
  }

  private openMovePickerForSlot(owner: "player" | "dummy", slotIndex: number): void {
    const pokemonId = owner === "player" ? this.playerPokemonId : this.dummyPokemonId;
    if (!pokemonId) {
      return;
    }
    const moves = owner === "player" ? this.playerMoves : this.dummyMoves;
    const excludeMoveIds = moves.filter((id, i) => id !== "" && i !== slotIndex);
    openMovePickerModal({
      pokemonId,
      slotIndex,
      excludeMoveIds,
      onSelect: (move) => {
        moves[slotIndex] = move.id;
        this.refreshMoveCard(owner, slotIndex);
        this.emit();
      },
    });
  }

  private createControlRadio(value: "ai" | "player", label: string): HTMLLabelElement {
    const wrapper = document.createElement("label");
    wrapper.style.cssText = "display: inline-flex; gap: 4px; align-items: center; cursor: pointer;";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "sandbox-dummy-control";
    input.value = value;
    input.checked = this.dummyControl === value;
    input.addEventListener("change", () => {
      if (input.checked) {
        this.dummyControl = value;
        this.applyDummyControlVisibility();
        this.emit();
      }
    });
    wrapper.appendChild(input);
    const span = document.createElement("span");
    span.textContent = label;
    wrapper.appendChild(span);
    return wrapper;
  }

  private applyDummyControlVisibility(): void {
    if (this.dummyMoveDefensiveRow) {
      this.dummyMoveDefensiveRow.style.display = this.dummyControl === "ai" ? "" : "none";
    }
    if (this.dummyMovesContainer) {
      this.dummyMovesContainer.style.display = this.dummyControl === "player" ? "grid" : "none";
    }
  }

  private readConfig(): SandboxConfig {
    const moves = this.playerMoves.filter((v) => v !== "");

    const statStages: Partial<Record<StatName, number>> = {};
    for (const stat of STAT_NAMES) {
      const slider = this.statSliders.get(stat);
      if (slider) {
        const value = Number(slider.value);
        if (value !== 0) {
          statStages[stat] = value;
        }
      }
    }

    const dummyStatStages: Partial<Record<StatName, number>> = {};
    for (const stat of STAT_NAMES) {
      const slider = this.dummyStatSliders.get(stat);
      if (slider) {
        const value = Number(slider.value);
        if (value !== 0) {
          dummyStatStages[stat] = value;
        }
      }
    }

    const mapUrl = this.mapSelect.value || undefined;
    const playerPosition = { x: this.playerX, y: this.playerY };
    const dummyPosition = { x: this.dummyX, y: this.dummyY };
    const playerDirection = this.playerDirectionSelect.value as Direction;

    return {
      pokemon: this.playerPokemonId,
      moves: moves.length > 0 ? moves : this.getMovepoolFor(this.playerPokemonId).slice(0, 4),
      hp: Number(this.hpSlider.value),
      status: this.statusSelect.value ? (this.statusSelect.value as StatusType) : null,
      volatileStatus: this.volatileStatusSelect.value
        ? (this.volatileStatusSelect.value as StatusType)
        : null,
      heldItem: this.playerHeldItemId ? (this.playerHeldItemId as HeldItemId) : undefined,
      playerAbility: this.playerAbilitySelect.value || undefined,
      statStages,
      playerPosition,
      playerDirection,
      dummyPokemon: this.dummyPokemonId || "dummy",
      dummyControl: this.dummyControl,
      dummyMove: this.dummyMoveSelect.value || null,
      dummyMoves: [...this.dummyMoves],
      dummyDirection: this.dummyDirectionSelect.value as Direction,
      dummyHp: Number(this.dummyHpSlider.value),
      dummyStatus: this.dummyStatusSelect.value
        ? (this.dummyStatusSelect.value as StatusType)
        : null,
      dummyVolatileStatus: this.dummyVolatileStatusSelect.value
        ? (this.dummyVolatileStatusSelect.value as StatusType)
        : null,
      dummyHeldItem: this.dummyHeldItemId ? (this.dummyHeldItemId as HeldItemId) : undefined,
      dummyAbility: this.dummyAbility || undefined,
      dummyStatStages,
      dummyPosition,
      mapUrl,
      debugDecorationsFootprint: this.debugDecorationsFootprintCheckbox.checked,
      weather: (this.weatherSelect.value as Weather) || Weather.None,
      weatherTurns: this.weatherTurnsInput.value ? Number(this.weatherTurnsInput.value) : 5,
    };
  }

  private copyJson(): void {
    const config = this.readConfig();
    const json = JSON.stringify(config, null, 2);
    navigator.clipboard.writeText(json);
  }

  private buildAbilityOptions(pokemonId: string): SelectOption[] {
    const abilities = getPokemonAbilities(pokemonId).all;
    const options: SelectOption[] = [{ value: "", label: t("sandbox.abilityDefault") }];
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
    this.replaceSelectOptions(
      this.playerAbilitySelect,
      this.buildAbilityOptions(this.playerPokemonId),
      "",
    );
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

  private replaceSelectOptions(
    select: HTMLSelectElement,
    options: SelectOption[],
    fallback: string,
  ): void {
    const previous = select.value;
    select.innerHTML = "";
    for (const option of options) {
      const opt = document.createElement("option");
      opt.value = option.value;
      opt.textContent = option.label;
      if (option.disabled) {
        opt.disabled = true;
      }
      select.appendChild(opt);
    }
    const stillValid = options.some((o) => o.value === previous && !o.disabled);
    select.value = stillValid ? previous : fallback;
  }

  private itemName(id: string): string {
    if (!id) {
      return t("sandbox.none");
    }
    const lang = getLanguage();
    return this.gameData.itemRegistry.get(id as HeldItemId)?.name[lang] ?? id;
  }

  private getMovepoolFor(pokemonId: string): string[] {
    const legal = getLegalMoves(pokemonId);
    const result: string[] = [];
    for (const move of this.gameData.moves) {
      if (legal.has(move.id)) {
        result.push(move.id);
      }
    }
    result.sort((a, b) => this.moveName(a).localeCompare(this.moveName(b)));
    return result;
  }

  private pokemonName(id: string): string {
    return getPokemonName(id, getLanguage());
  }

  private moveName(id: string): string {
    return getMoveName(id, getLanguage());
  }

  private createPickerCard(
    label: string,
    currentText: string,
    onClick: () => void,
  ): { row: HTMLDivElement; button: HTMLButtonElement } {
    const row = document.createElement("div");
    row.style.cssText = "display: flex; gap: 6px; align-items: center; margin: 1px 0;";
    const labelEl = document.createElement("span");
    labelEl.textContent = `${label}:`;
    labelEl.style.cssText = "flex-shrink: 0; width: 55px; color: #aac;";
    row.appendChild(labelEl);
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = currentText;
    button.style.cssText =
      "flex: 1; padding: 4px 8px; background: #1a1a2e; color: #ddd; border: 1px solid #335; border-radius: 3px; cursor: pointer; text-align: left;";
    button.addEventListener("click", onClick);
    row.appendChild(button);
    return { row, button };
  }

  private createHeader(title: string): HTMLDivElement {
    const header = document.createElement("div");
    header.style.cssText = HEADER_STYLE;
    const titleSpan = document.createElement("span");
    titleSpan.textContent = title;
    header.appendChild(titleSpan);
    return header;
  }

  private createBody(): HTMLDivElement {
    const body = document.createElement("div");
    body.className = "sandbox-body";
    body.style.cssText = "padding: 6px; display: flex; flex-direction: column; gap: 4px;";
    return body;
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
      if (option.value === selected) {
        opt.selected = true;
      }
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

  private createOptionalNumberInput(
    label: string,
    min: number,
    max: number,
    value: number | undefined,
    placeholder: string,
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
    input.value = value === undefined ? "" : String(value);
    input.placeholder = placeholder;
    input.style.cssText =
      "width: 50px; background: #222; color: #ddd; border: 1px solid #444; border-radius: 3px; padding: 1px 3px; font-size: 10px; font-family: monospace; text-align: center;";
    row.appendChild(input);
    return { row, input };
  }

  private createCheckbox(
    label: string,
    checked: boolean,
  ): { row: HTMLDivElement; input: HTMLInputElement } {
    const row = document.createElement("div");
    row.style.cssText =
      "display: flex; justify-content: space-between; align-items: center; margin: 1px 0;";

    const labelElement = document.createElement("span");
    labelElement.textContent = label;
    labelElement.style.cssText = "flex-shrink: 0; width: 55px;";
    row.appendChild(labelElement);

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    input.style.cssText = "margin: 0;";
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
