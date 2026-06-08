import {
  AURA_RADIUS,
  type AuraKind,
  type BattleState,
  CT_THRESHOLD,
  type CtTimelineEntry,
  PokemonGender,
  type PokemonInstance,
  StatName,
  StatusType,
  TurnSystemKind,
  Weather,
} from "@pokemon-tactic/core";
import { getMoveName, getPokemonName } from "@pokemon-tactic/data";
import { getLanguage, t } from "../i18n/index.js";
import type { TranslationKey } from "../i18n/types.js";
import { getPortraitUrl } from "../team/team-builder-data.js";
import type { InfoPanelBadge, InfoPanelData } from "../ui/dom/info-panel.js";

/**
 * Core → DOM view-model adapters for the combat chrome (plan 121 step 4b-1).
 * The orchestrator owns the engine state, so it builds these plain view-models
 * and hands them to the DOM chrome — keeping the panels dumb renderers. These
 * mirror the Phaser `ui/InfoPanel.ts` (`updateBadges`/`addAuraBadges`) and
 * `ui/WeatherHud.ts` so the two renderers stay at parity.
 */

export type { InfoPanelData } from "../ui/dom/info-panel.js";

/** Active-weather kinds, derived from the core enum (stays in sync if it grows). */
export type WeatherKind = Exclude<Weather, typeof Weather.None>;

export interface WeatherView {
  readonly kind: WeatherKind;
  readonly turnsRemaining: number;
}

const MAJOR_STATUS_LABEL: Partial<Record<StatusType, TranslationKey>> = {
  [StatusType.Burned]: "status.burned",
  [StatusType.Paralyzed]: "status.paralyzed",
  [StatusType.Poisoned]: "status.poisoned",
  [StatusType.BadlyPoisoned]: "status.badlyPoisoned",
  [StatusType.Frozen]: "status.frozen",
  [StatusType.Asleep]: "status.asleep",
};

const STAT_LABEL: Record<string, TranslationKey> = {
  [StatName.Attack]: "stat.atk",
  [StatName.Defense]: "stat.def",
  [StatName.SpAttack]: "stat.spA",
  [StatName.SpDefense]: "stat.spD",
  [StatName.Speed]: "stat.spd",
  [StatName.Accuracy]: "stat.acc",
  [StatName.Evasion]: "stat.eva",
};

const VOLATILE_LABEL: Partial<Record<StatusType, TranslationKey>> = {
  [StatusType.Confused]: "status.confused",
  [StatusType.Seeded]: "status.seeded",
  [StatusType.Trapped]: "status.trapped",
  [StatusType.Infatuated]: "status.infatuated",
  [StatusType.Intimidated]: "status.intimidated",
  [StatusType.LockedOn]: "status.lockedOn",
  [StatusType.Charged]: "status.charged",
  [StatusType.Ingrain]: "status.ingrain",
  [StatusType.AquaRing]: "status.aquaRing",
};

const TIMED_VOLATILE_LABEL: Partial<Record<StatusType, TranslationKey>> = {
  [StatusType.Taunted]: "infoPanel.volatile.taunted",
  [StatusType.Disabled]: "infoPanel.volatile.disabled",
  [StatusType.Encored]: "infoPanel.volatile.encored",
};

const AURA_KIND_LABEL: Record<AuraKind, TranslationKey> = {
  reflect: "aura.kind.reflect",
  "light-screen": "aura.kind.lightScreen",
  mist: "aura.kind.mist",
  safeguard: "aura.kind.safeguard",
};

function genderOf(gender: PokemonGender): "male" | "female" | undefined {
  if (gender === PokemonGender.Male) {
    return "male";
  }
  if (gender === PokemonGender.Female) {
    return "female";
  }
  return undefined;
}

/** "player-2" → 2 (1-based team index for the `--team-N` color token). */
function teamNumberOf(playerId: string): number {
  return Number(playerId.match(/(\d+)/)?.[1] ?? "1");
}

/** Mirror of `InfoPanel.addAuraBadges`: own auras (with turns) + ally auras covering this mon. */
function pushAuraBadges(
  badges: InfoPanelBadge[],
  pokemon: PokemonInstance,
  state: BattleState,
): void {
  for (const aura of state.auras) {
    if (aura.casterPokemonId !== pokemon.id) {
      continue;
    }
    badges.push({
      label: t("infoPanel.aura.caster", {
        kind: t(AURA_KIND_LABEL[aura.kind]),
        turns: String(aura.remainingRounds),
      }),
      variant: "volatile",
    });
  }

  for (const aura of state.auras) {
    if (aura.casterPokemonId === pokemon.id) {
      continue;
    }
    const caster = state.pokemon.get(aura.casterPokemonId);
    if (!caster || caster.currentHp <= 0 || caster.playerId !== pokemon.playerId) {
      continue;
    }
    const distance =
      Math.abs(caster.position.x - pokemon.position.x) +
      Math.abs(caster.position.y - pokemon.position.y);
    if (distance > AURA_RADIUS) {
      continue;
    }
    badges.push({
      label: t("infoPanel.aura.protected", { kind: t(AURA_KIND_LABEL[aura.kind]) }),
      variant: "volatile",
    });
  }
}

/** Build the InfoPanel view-model for a Pokémon (mirror of `InfoPanel.update`). */
export function buildInfoPanelView(pokemon: PokemonInstance, state: BattleState): InfoPanelData {
  const language = getLanguage();
  const badges: InfoPanelBadge[] = [];

  const majorStatus = pokemon.statusEffects[0]?.type;
  const majorKey = majorStatus ? MAJOR_STATUS_LABEL[majorStatus] : undefined;
  if (majorKey) {
    badges.push({ label: t(majorKey), variant: "debuff" });
  }

  for (const [stat, key] of Object.entries(STAT_LABEL)) {
    const stages = pokemon.statStages[stat as keyof typeof pokemon.statStages];
    if (stages === undefined || stages === 0) {
      continue;
    }
    const sign = stages > 0 ? "+" : "";
    badges.push({
      label: `${t(key)} ${sign}${stages}`,
      variant: stages > 0 ? "buff" : "debuff",
    });
  }

  for (const volatile of pokemon.volatileStatuses) {
    const timedKey = TIMED_VOLATILE_LABEL[volatile.type];
    if (timedKey) {
      badges.push({
        label: t(timedKey, { turns: String(volatile.remainingTurns) }),
        variant: "volatile",
      });
      continue;
    }
    const key = VOLATILE_LABEL[volatile.type];
    if (key) {
      badges.push({ label: t(key), variant: "volatile" });
    }
  }

  if (pokemon.chargingMove) {
    badges.push({
      label: t("status.charging", { move: getMoveName(pokemon.chargingMove.moveId, language) }),
      variant: "volatile",
    });
  }

  if (pokemon.substituteHp !== undefined && pokemon.substituteHp > 0) {
    badges.push({
      label: t("infoPanel.volatile.substitute", { hp: String(pokemon.substituteHp) }),
      variant: "volatile",
    });
  }

  if (pokemon.pendingWish !== undefined) {
    badges.push({ label: t("infoPanel.volatile.wish"), variant: "volatile" });
  }

  pushAuraBadges(badges, pokemon, state);

  return {
    name: getPokemonName(pokemon.definitionId, language),
    level: pokemon.level,
    gender: genderOf(pokemon.gender),
    hpCurrent: pokemon.currentHp,
    hpMax: pokemon.maxHp,
    team: teamNumberOf(pokemon.playerId),
    portraitUrl: getPortraitUrl(pokemon.definitionId),
    badges,
  };
}

/** Build the WeatherHud view-model (mirror of `WeatherHud.update`); null = clear weather. */
export function buildWeatherView(state: BattleState): WeatherView | null {
  if (state.weather === Weather.None) {
    return null;
  }
  return {
    kind: state.weather as WeatherKind,
    turnsRemaining: state.weatherTurnsRemaining,
  };
}

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

function timelineEntry(
  pokemon: PokemonInstance,
  isActive: boolean,
  ct: number | null,
  dimmed: boolean,
  separatorRound: number | null,
): TimelineEntryView {
  return {
    definitionId: pokemon.definitionId,
    team: teamNumberOf(pokemon.playerId),
    isActive,
    ctRatio: ct === null ? null : Math.max(0, Math.min(1, ct / CT_THRESHOLD)),
    dimmed,
    separatorRound,
  };
}

/**
 * Build the TurnTimeline view-model (mirror of `ui/TurnTimeline.ts`). In
 * Charge-Time it lists the active Pokémon then the predicted `ctSequence`; in
 * Round-Robin it lists the current round's remaining order then next round's
 * already-acted mons behind a round separator.
 */
export function buildTimelineView(
  state: BattleState,
  ctSequence: readonly CtTimelineEntry[],
): TimelineView {
  const alive = (id: string | undefined): PokemonInstance | null => {
    const pokemon = id ? state.pokemon.get(id) : undefined;
    return pokemon && pokemon.currentHp > 0 ? pokemon : null;
  };
  const entries: TimelineEntryView[] = [];

  if (state.turnSystemKind === TurnSystemKind.ChargeTime) {
    const active = alive(state.turnOrder[0]);
    if (active) {
      entries.push(timelineEntry(active, true, state.ctSnapshot?.[active.id] ?? 0, false, null));
    }
    for (const entry of ctSequence) {
      const pokemon = alive(entry.pokemonId);
      if (pokemon) {
        entries.push(timelineEntry(pokemon, false, entry.ct, false, null));
      }
    }
    return { showCtBars: true, entries };
  }

  const active = alive(state.turnOrder[state.currentTurnIndex]);
  if (active) {
    entries.push(timelineEntry(active, true, null, false, null));
  }
  for (const id of state.turnOrder.slice(state.currentTurnIndex + 1)) {
    const pokemon = alive(id);
    if (pokemon) {
      entries.push(timelineEntry(pokemon, false, null, false, null));
    }
  }
  const actedIds = new Set(state.turnOrder.slice(0, state.currentTurnIndex));
  let isFirstNextRound = true;
  for (const id of state.predictedNextRoundOrder.filter((acted) => actedIds.has(acted))) {
    const pokemon = alive(id);
    if (!pokemon) {
      continue;
    }
    entries.push(
      timelineEntry(pokemon, false, null, true, isFirstNextRound ? state.roundNumber + 1 : null),
    );
    isFirstNextRound = false;
  }
  return { showCtBars: false, entries };
}
