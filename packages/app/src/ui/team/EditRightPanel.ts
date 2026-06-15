import {
  type BaseStats,
  computeCombatStats,
  SP_PER_STAT_MAX,
  SP_TOTAL_MAX,
  type StatSpread,
  type TeamSlot,
} from "@pokemon-tactic/core";
import { type TranslationKey, t } from "../../i18n";
import { getPlayablePokemonById } from "../../team/team-builder-data";

type StatKey = keyof BaseStats;

interface StatRowConfig {
  key: StatKey;
  shortLabel: string;
}

const STAT_ROWS: StatRowConfig[] = [
  { key: "hp", shortLabel: "HP" },
  { key: "attack", shortLabel: "Atk" },
  { key: "defense", shortLabel: "Def" },
  { key: "spAttack", shortLabel: "SpA" },
  { key: "spDefense", shortLabel: "SpD" },
  { key: "speed", shortLabel: "Spe" },
];

const STAT_MAX_DISPLAY = 200;

export interface Preset {
  id: string;
  labelKey: TranslationKey;
  spread: StatSpread;
}

export const PRESETS: Preset[] = [
  {
    id: "phys-sweeper",
    labelKey: "teamBuilder.preset.physSweeper",
    spread: { hp: 2, attack: 32, speed: 32 },
  },
  {
    id: "spec-sweeper",
    labelKey: "teamBuilder.preset.specSweeper",
    spread: { hp: 2, spAttack: 32, speed: 32 },
  },
  {
    id: "tank-phys",
    labelKey: "teamBuilder.preset.tankPhys",
    spread: { hp: 32, defense: 32, spDefense: 2 },
  },
  {
    id: "tank-spec",
    labelKey: "teamBuilder.preset.tankSpec",
    spread: { hp: 32, defense: 2, spDefense: 32 },
  },
  { id: "reset", labelKey: "teamBuilder.preset.reset", spread: {} },
];

export interface EditRightPanelCallbacks {
  onSpChange: (statSpread: StatSpread) => void;
  onPresetApply: (statSpread: StatSpread) => void;
}

interface StatRowRefs {
  fill: HTMLDivElement;
  value: HTMLSpanElement;
}

interface SpRowRefs {
  slider: HTMLInputElement;
  value: HTMLSpanElement;
}

export class EditRightPanel {
  readonly element: HTMLDivElement;
  private currentSlot: TeamSlot | null = null;
  private statRefs: Partial<Record<StatKey, StatRowRefs>> = {};
  private spRefs: Partial<Record<StatKey, SpRowRefs>> = {};
  private spCounter: HTMLDivElement | null = null;
  private lastPokemonId: string | null = null;

  constructor(private readonly callbacks: EditRightPanelCallbacks) {
    this.element = document.createElement("div");
  }

  render(slot: TeamSlot): void {
    this.currentSlot = slot;
    if (this.lastPokemonId === slot.pokemonId) {
      this.refreshValues(slot);
      return;
    }
    this.rebuild(slot);
  }

  private rebuild(slot: TeamSlot): void {
    this.lastPokemonId = slot.pokemonId;
    this.statRefs = {};
    this.spRefs = {};
    this.spCounter = null;
    const pokemon = getPlayablePokemonById(slot.pokemonId);
    this.element.innerHTML = "";
    if (pokemon === null) {
      return;
    }

    const statsSection = document.createElement("div");
    statsSection.className = "tb-edit-section";
    const statsTitle = document.createElement("div");
    statsTitle.className = "tb-edit-section-title";
    statsTitle.textContent = t("teamBuilder.section.stats");
    statsSection.appendChild(statsTitle);

    for (const cfg of STAT_ROWS) {
      const row = document.createElement("div");
      row.className = "tb-stat-row";
      row.dataset.stat = cfg.key;
      const label = document.createElement("span");
      label.className = "tb-stat-label";
      label.textContent = cfg.shortLabel;
      row.appendChild(label);
      const bar = document.createElement("div");
      bar.className = "tb-stat-bar";
      const fill = document.createElement("div");
      fill.className = "tb-stat-bar-fill";
      bar.appendChild(fill);
      row.appendChild(bar);
      const valueEl = document.createElement("span");
      valueEl.className = "tb-stat-value";
      row.appendChild(valueEl);
      statsSection.appendChild(row);
      this.statRefs[cfg.key] = { fill, value: valueEl };
    }
    this.element.appendChild(statsSection);

    const spSection = document.createElement("div");
    spSection.className = "tb-edit-section";
    const spTitle = document.createElement("div");
    spTitle.className = "tb-edit-section-title";
    spTitle.textContent = t("teamBuilder.section.statPoints");
    spSection.appendChild(spTitle);

    const counter = document.createElement("div");
    counter.className = "tb-sp-counter";
    spSection.appendChild(counter);
    this.spCounter = counter;

    for (const cfg of STAT_ROWS) {
      const row = document.createElement("div");
      row.className = "tb-sp-row";
      const label = document.createElement("span");
      label.className = "tb-stat-label";
      label.textContent = cfg.shortLabel;
      row.appendChild(label);
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = "0";
      slider.max = String(SP_PER_STAT_MAX);
      slider.value = String(slot.statSpread[cfg.key] ?? 0);
      slider.addEventListener("pointerdown", (event) => {
        slider.setPointerCapture(event.pointerId);
      });
      slider.addEventListener("input", () => this.handleSliderInput(cfg.key, Number(slider.value)));
      row.appendChild(slider);
      const value = document.createElement("span");
      value.className = "tb-sp-value";
      value.textContent = slider.value;
      row.appendChild(value);
      const reset = document.createElement("button");
      reset.className = "tb-btn";
      reset.dataset.variant = "ghost";
      reset.type = "button";
      reset.textContent = t("teamBuilder.spReset");
      reset.title = t("teamBuilder.spStatMax");
      reset.addEventListener("click", () => this.handleSliderInput(cfg.key, 0));
      row.appendChild(reset);
      spSection.appendChild(row);
      this.spRefs[cfg.key] = { slider, value };
    }
    this.element.appendChild(spSection);

    const presetsSection = document.createElement("div");
    presetsSection.className = "tb-edit-section";
    const presetsTitle = document.createElement("div");
    presetsTitle.className = "tb-edit-section-title";
    presetsTitle.textContent = t("teamBuilder.section.presets");
    presetsSection.appendChild(presetsTitle);
    const presets = document.createElement("div");
    presets.className = "tb-presets";
    for (const preset of PRESETS) {
      const btn = document.createElement("button");
      btn.className = "tb-btn";
      btn.type = "button";
      btn.textContent = t(preset.labelKey);
      btn.addEventListener("click", () => this.callbacks.onPresetApply({ ...preset.spread }));
      presets.appendChild(btn);
    }
    presetsSection.appendChild(presets);
    this.element.appendChild(presetsSection);

    this.refreshValues(slot);
  }

  private refreshValues(slot: TeamSlot): void {
    const pokemon = getPlayablePokemonById(slot.pokemonId);
    if (pokemon === null) {
      return;
    }
    const stats = computeCombatStats(
      pokemon.definition.baseStats,
      50,
      slot.nature,
      slot.statSpread,
    );
    for (const cfg of STAT_ROWS) {
      const refs = this.statRefs[cfg.key];
      if (refs === undefined) {
        continue;
      }
      const value = stats[cfg.key];
      const widthPercent = Math.min(100, (value / STAT_MAX_DISPLAY) * 100);
      refs.fill.style.width = `${widthPercent}%`;
      refs.value.textContent = String(value);
    }
    const used = STAT_ROWS.reduce((sum, cfg) => sum + (slot.statSpread[cfg.key] ?? 0), 0);
    if (this.spCounter !== null) {
      this.spCounter.innerHTML = t("teamBuilder.spTotal")
        .replace("{used}", `<strong>${used}</strong>`)
        .replace("{max}", String(SP_TOTAL_MAX));
    }
    for (const cfg of STAT_ROWS) {
      const refs = this.spRefs[cfg.key];
      if (refs === undefined) {
        continue;
      }
      const current = slot.statSpread[cfg.key] ?? 0;
      if (refs.slider.value !== String(current)) {
        refs.slider.value = String(current);
      }
      refs.value.textContent = String(current);
    }
  }

  private handleSliderInput(statKey: StatKey, requested: number): void {
    if (this.currentSlot === null) {
      return;
    }
    const slot = this.currentSlot;
    const current = slot.statSpread[statKey] ?? 0;
    const otherUsed =
      STAT_ROWS.reduce((sum, cfg) => sum + (slot.statSpread[cfg.key] ?? 0), 0) - current;
    const clampedByTotal = Math.max(0, Math.min(SP_TOTAL_MAX - otherUsed, requested));
    const clampedByStat = Math.min(SP_PER_STAT_MAX, clampedByTotal);
    const next: StatSpread = { ...slot.statSpread, [statKey]: clampedByStat };
    if (clampedByStat === 0) {
      delete next[statKey];
    }
    this.callbacks.onSpChange(next);
  }
}
