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

/* ── Turn timeline ────────────────────────────────────────────────────────── */

/** One portrait slot in the turn timeline (active first, then upcoming order). */
export interface TimelineEntryView {
  definitionId: string;
  /** 1-based team index → `--team-N` color token. */
  team: number;
  isActive: boolean;
  /** CT fill ratio 0..1 (Charge-Time), or null in Round-Robin (no bar). */
  ctRatio: number | null;
  /** Already-acted / next-round entries are rendered faded. */
  dimmed: boolean;
  /** Round label shown as a separator BEFORE this entry (Round-Robin next round). */
  separatorRound: number | null;
}

export interface TimelineView {
  /** Charge-Time shows a CT bar per entry; Round-Robin doesn't. */
  showCtBars: boolean;
  entries: readonly TimelineEntryView[];
}

/* ── Info panel ───────────────────────────────────────────────────────────── */

export type InfoPanelBadgeVariant = "buff" | "debuff" | "volatile";

export interface InfoPanelBadge {
  readonly label: string;
  readonly variant: InfoPanelBadgeVariant;
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
  /** Status changes / volatiles / statuses, rendered as chips. */
  readonly badges: readonly InfoPanelBadge[];
}
