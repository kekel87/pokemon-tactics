import type { Weather } from "@pokemon-tactic/core";

/**
 * View-model DTOs handed by the presentation layer to a render backend / DOM
 * chrome. Pure data, zero engine/renderer dependency — the contract that keeps
 * any backend a "humble object" (plan 125).
 */

/* ── Weather HUD ──────────────────────────────────────────────────────────── */

/** Active-weather kinds, derived from the core enum (stays in sync if it grows). */
export type WeatherKind = Exclude<Weather, typeof Weather.None>;

export interface WeatherView {
  readonly kind: WeatherKind;
  readonly turnsRemaining: number;
}

/** Active Vent Arrière (tailwind) readout: the direction the wind blows toward + turns left. */
export interface TailwindView {
  readonly direction: "north" | "south" | "east" | "west";
  readonly turnsRemaining: number;
}

/* ── Turn timeline ────────────────────────────────────────────────────────── */

/** One portrait slot in the turn timeline (active first, then upcoming order). */
export interface TimelineEntryView {
  definitionId: string;
  /** 1-based team index → `--team-N` color token. */
  team: number;
  isActive: boolean;
  /** Move-cost preview: this is where the deciding mon ("you") will slot back in after acting. */
  isSelf: boolean;
  /** CT fill ratio 0..1 (Charge Time), or null when no bar is shown. */
  ctRatio: number | null;
  /** Upcoming (not-yet-acting) entries are rendered faded. */
  dimmed: boolean;
}

export interface TimelineView {
  /** Charge Time shows a CT bar per entry. */
  showCtBars: boolean;
  entries: readonly TimelineEntryView[];
}

/* ── Info panel ───────────────────────────────────────────────────────────── */

export type InfoPanelBadgeVariant = "buff" | "debuff" | "volatile";

export interface InfoPanelBadge {
  readonly label: string;
  readonly variant: InfoPanelBadgeVariant;
}

/** A type chip: `id` drives the `--type-<id>` color token, `label` is the localised name. */
export interface InfoPanelType {
  readonly id: string;
  readonly label: string;
}

/** One battle-stat row (plan 174): value after EV/nature, crans, status → effective value. */
export interface InfoPanelStat {
  /** Localised short label (Atk/Déf/…). */
  readonly label: string;
  /** Combat stat after EV/nature, before crans/status. */
  readonly value: number;
  /** Stat-stage crans (−6..+6); 0 = no arrow indicator. */
  readonly stage: number;
  /** Effective value after crans + stat-modifying statuses (burn/paralysis…); `→` shown when ≠ value. */
  readonly modified: number;
  /** This nature boosts/lowers this stat → colour the label (omitted = neutral for this stat). */
  readonly natureEffect?: "boost" | "lower";
}

export interface InfoPanelData {
  readonly name: string;
  readonly level: number;
  /** Omit for genderless species. */
  readonly gender?: "male" | "female";
  readonly hpCurrent: number;
  readonly hpMax: number;
  /** 1-based team index → `--team-N` color token. */
  readonly team: number;
  /** Portrait image URL; omitted = no portrait shown. */
  readonly portraitUrl?: string;
  /**
   * Perspective flag (plan 174): only allies get the enriched stats/ability/nature.
   * Enemy progressive-reveal = plan 176; for now enemies render minimal.
   */
  readonly isAlly: boolean;
  /** Effective types (species, override or transform), localised chips. */
  readonly types: readonly InfoPanelType[];
  /** Localised ability name; omitted for enemies (plan 174) / when unknown. */
  readonly ability?: string;
  /** Battle stats (Atk/Déf/Atk Spé/Déf Spé/Vit) in that order; omitted for enemies. */
  readonly stats?: readonly InfoPanelStat[];
  /** Status changes / volatiles / statuses, rendered as chips. */
  readonly badges: readonly InfoPanelBadge[];
  /** Localised held-item name; omitted when the Pokémon holds nothing. */
  readonly heldItem?: string;
  /** Held-item icon URL (plan 168); omitted when the Pokémon holds nothing. */
  readonly itemIconUrl?: string;
}
