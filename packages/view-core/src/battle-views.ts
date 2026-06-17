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
  Weather,
} from "@pokemon-tactic/core";
import { getMoveName, getPokemonName } from "@pokemon-tactic/data";
import type {
  InfoPanelBadge,
  InfoPanelData,
  PresentationContext,
  TimelineEntryView,
  TimelineView,
  WeatherKind,
  WeatherView,
} from "@pokemon-tactic/render-ports";

/**
 * Core → DOM view-model adapters for the combat chrome (plan 121 step 4b-1).
 * The orchestrator owns the engine state, so it builds these plain view-models
 * and hands them to the DOM chrome — keeping the panels dumb renderers. These
 * feed the info panel (`updateBadges`/`addAuraBadges`) and weather HUD.
 *
 * The view-model *types* live in `@pokemon-tactic/render-ports` (plan 125);
 * re-exported here for callers that still import them from this module.
 */

export type {
  InfoPanelData,
  TimelineEntryView,
  TimelineView,
  WeatherKind,
  WeatherView,
} from "@pokemon-tactic/render-ports";

const MAJOR_STATUS_LABEL: Partial<Record<StatusType, string>> = {
  [StatusType.Burned]: "status.burned",
  [StatusType.Paralyzed]: "status.paralyzed",
  [StatusType.Poisoned]: "status.poisoned",
  [StatusType.BadlyPoisoned]: "status.badlyPoisoned",
  [StatusType.Frozen]: "status.frozen",
  [StatusType.Asleep]: "status.asleep",
};

const STAT_LABEL: Record<string, string> = {
  [StatName.Attack]: "stat.atk",
  [StatName.Defense]: "stat.def",
  [StatName.SpAttack]: "stat.spA",
  [StatName.SpDefense]: "stat.spD",
  [StatName.Speed]: "stat.spd",
  [StatName.Accuracy]: "stat.acc",
  [StatName.Evasion]: "stat.eva",
};

const VOLATILE_LABEL: Partial<Record<StatusType, string>> = {
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

const TIMED_VOLATILE_LABEL: Partial<Record<StatusType, string>> = {
  [StatusType.Taunted]: "infoPanel.volatile.taunted",
  [StatusType.Disabled]: "infoPanel.volatile.disabled",
  [StatusType.Encored]: "infoPanel.volatile.encored",
};

const AURA_KIND_LABEL: Record<AuraKind, string> = {
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
  context: PresentationContext,
  badges: InfoPanelBadge[],
  pokemon: PokemonInstance,
  state: BattleState,
): void {
  for (const aura of state.auras) {
    if (aura.casterPokemonId !== pokemon.id) {
      continue;
    }
    badges.push({
      label: context.translate("infoPanel.aura.caster", {
        kind: context.translate(AURA_KIND_LABEL[aura.kind]),
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
      label: context.translate("infoPanel.aura.protected", {
        kind: context.translate(AURA_KIND_LABEL[aura.kind]),
      }),
      variant: "volatile",
    });
  }
}

/** Build the InfoPanel view-model for a Pokémon (mirror of `InfoPanel.update`). */
export function buildInfoPanelView(
  context: PresentationContext,
  pokemon: PokemonInstance,
  state: BattleState,
): InfoPanelData {
  const language = context.getLanguage();
  const badges: InfoPanelBadge[] = [];

  const majorStatus = pokemon.statusEffects[0]?.type;
  const majorKey = majorStatus ? MAJOR_STATUS_LABEL[majorStatus] : undefined;
  if (majorKey) {
    badges.push({ label: context.translate(majorKey), variant: "debuff" });
  }

  for (const [stat, key] of Object.entries(STAT_LABEL)) {
    const stages = pokemon.statStages[stat as keyof typeof pokemon.statStages];
    if (stages === undefined || stages === 0) {
      continue;
    }
    const sign = stages > 0 ? "+" : "";
    badges.push({
      label: `${context.translate(key)} ${sign}${stages}`,
      variant: stages > 0 ? "buff" : "debuff",
    });
  }

  for (const volatile of pokemon.volatileStatuses) {
    const timedKey = TIMED_VOLATILE_LABEL[volatile.type];
    if (timedKey) {
      badges.push({
        label: context.translate(timedKey, { turns: String(volatile.remainingTurns) }),
        variant: "volatile",
      });
      continue;
    }
    const key = VOLATILE_LABEL[volatile.type];
    if (key) {
      badges.push({ label: context.translate(key), variant: "volatile" });
    }
  }

  if (pokemon.chargingMove) {
    badges.push({
      label: context.translate("status.charging", {
        move: getMoveName(pokemon.chargingMove.moveId, language),
      }),
      variant: "volatile",
    });
  }

  if (pokemon.substituteHp !== undefined && pokemon.substituteHp > 0) {
    badges.push({
      label: context.translate("infoPanel.volatile.substitute", {
        hp: String(pokemon.substituteHp),
      }),
      variant: "volatile",
    });
  }

  if (pokemon.pendingWish !== undefined) {
    badges.push({ label: context.translate("infoPanel.volatile.wish"), variant: "volatile" });
  }

  pushAuraBadges(context, badges, pokemon, state);

  return {
    name: getPokemonName(pokemon.definitionId, language),
    level: pokemon.level,
    gender: genderOf(pokemon.gender),
    hpCurrent: pokemon.currentHp,
    hpMax: pokemon.maxHp,
    team: teamNumberOf(pokemon.playerId),
    portraitUrl: context.getPortraitUrl(pokemon.definitionId),
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

function timelineEntry(
  pokemon: PokemonInstance,
  opts: { isActive?: boolean; isSelf?: boolean; ct?: number | null; dimmed?: boolean },
): TimelineEntryView {
  const ct = opts.ct ?? null;
  return {
    definitionId: pokemon.definitionId,
    team: teamNumberOf(pokemon.playerId),
    isActive: opts.isActive ?? false,
    isSelf: opts.isSelf ?? false,
    ctRatio: ct === null ? null : Math.max(0, Math.min(1, ct / CT_THRESHOLD)),
    dimmed: opts.dimmed ?? false,
  };
}

/**
 * Build the TurnTimeline view-model (Charge Time).
 *
 * Live (`preview=false`): the active mon is pinned on top with no bar (a full bar would read as
 * "almost ready" rather than "acting now"); upcoming mons show their CURRENT charge bar; a mon's
 * later turns are dimmed (their future charge isn't reliably known).
 *
 * Move-cost preview (`preview=true`): show the EXACT resulting order — the deciding mon is no longer
 * pinned on top but appears where it will slot back in after paying the move's cost (marked
 * `isSelf`), so "what you see is what happens". No bars (these are future projections).
 */
export function buildTimelineView(
  state: BattleState,
  ctSequence: readonly CtTimelineEntry[],
  preview = false,
): TimelineView {
  const alive = (id: string | undefined): PokemonInstance | null => {
    const pokemon = id ? state.pokemon.get(id) : undefined;
    return pokemon && pokemon.currentHp > 0 ? pokemon : null;
  };
  const entries: TimelineEntryView[] = [];
  const seen = new Set<string>();

  if (preview) {
    for (const entry of ctSequence) {
      const pokemon = alive(entry.pokemonId);
      if (!pokemon) {
        continue;
      }
      if (seen.has(pokemon.id)) {
        entries.push(timelineEntry(pokemon, { dimmed: true }));
        continue;
      }
      seen.add(pokemon.id);
      // The deciding mon's first slot in the resulting order = where "you" land after this move.
      entries.push(timelineEntry(pokemon, { isSelf: pokemon.id === state.activePokemonId }));
    }
    return { showCtBars: false, entries };
  }

  const active = alive(state.activePokemonId);
  if (active) {
    entries.push(timelineEntry(active, { isActive: true }));
    seen.add(active.id);
  }
  for (const entry of ctSequence) {
    const pokemon = alive(entry.pokemonId);
    if (!pokemon) {
      continue;
    }
    if (seen.has(pokemon.id)) {
      entries.push(timelineEntry(pokemon, { dimmed: true }));
      continue;
    }
    seen.add(pokemon.id);
    entries.push(timelineEntry(pokemon, { ct: state.ctSnapshot?.[pokemon.id] ?? 0 }));
  }
  return { showCtBars: true, entries };
}
