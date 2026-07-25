import {
  AURA_RADIUS,
  type AuraKind,
  type BattleState,
  CT_THRESHOLD,
  type CtTimelineEntry,
  type DisplayStat,
  type EntryHazardKind,
  effectiveAbilityId,
  effectiveCombatStats,
  effectiveDisplayStat,
  FieldGlobalKind,
  type FieldTerrain,
  getEntryHazardsAt,
  getMovementPenalty,
  getNatureEffect,
  getTerrainBonusType,
  getTerrainDotFraction,
  getTerrainImmuneTypes,
  getTerrainStatusOnStop,
  isTerrainPassable,
  maxLayersFor,
  PokemonGender,
  type PokemonInstance,
  type PokemonType,
  type Position,
  StatName,
  StatusType,
  type TerrainType,
  Weather,
} from "@pokemon-tactic/core";
import { getMoveName, getPokemonName, strongestMoveId } from "@pokemon-tactic/data";
import type {
  InfoPanelBadge,
  InfoPanelData,
  InfoPanelStat,
  InfoPanelType,
  PresentationContext,
  TailwindView,
  TileInfoChip,
  TileInfoData,
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
  TailwindView,
  TileInfoChip,
  TileInfoData,
  TileInfoTone,
  TimelineEntryView,
  TimelineView,
  WeatherKind,
  WeatherView,
} from "@pokemon-tactic/render-ports";

/** FR/EN type names — single source for the type-override badge and the battle-log type-manip lines. */
export const TYPE_LABEL: Record<PokemonType, { fr: string; en: string }> = {
  normal: { fr: "Normal", en: "Normal" },
  fire: { fr: "Feu", en: "Fire" },
  water: { fr: "Eau", en: "Water" },
  grass: { fr: "Plante", en: "Grass" },
  electric: { fr: "Électrik", en: "Electric" },
  ice: { fr: "Glace", en: "Ice" },
  fighting: { fr: "Combat", en: "Fighting" },
  poison: { fr: "Poison", en: "Poison" },
  ground: { fr: "Sol", en: "Ground" },
  flying: { fr: "Vol", en: "Flying" },
  psychic: { fr: "Psy", en: "Psychic" },
  bug: { fr: "Insecte", en: "Bug" },
  rock: { fr: "Roche", en: "Rock" },
  ghost: { fr: "Spectre", en: "Ghost" },
  dragon: { fr: "Dragon", en: "Dragon" },
  dark: { fr: "Ténèbres", en: "Dark" },
  steel: { fr: "Acier", en: "Steel" },
  fairy: { fr: "Fée", en: "Fairy" },
};

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
  [StatusType.Imprisoning]: "infoPanel.volatile.imprison",
  [StatusType.DestinyBond]: "infoPanel.volatile.destinyBond",
  [StatusType.Grudge]: "infoPanel.volatile.grudge",
  [StatusType.Cursed]: "infoPanel.volatile.cursed",
};

const TIMED_VOLATILE_LABEL: Partial<Record<StatusType, string>> = {
  [StatusType.Taunted]: "infoPanel.volatile.taunted",
  [StatusType.Disabled]: "infoPanel.volatile.disabled",
  [StatusType.Encored]: "infoPanel.volatile.encored",
  [StatusType.HealBlocked]: "infoPanel.volatile.healBlock",
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

/** Ordered battle stats shown in the ally InfoPanel (HP is the life bar, not a row). */
const INFO_PANEL_STAT_ROWS: ReadonlyArray<{ readonly stat: DisplayStat; readonly key: string }> = [
  { stat: StatName.Attack, key: "stat.atk" },
  { stat: StatName.Defense, key: "stat.def" },
  { stat: StatName.SpAttack, key: "stat.spA" },
  { stat: StatName.SpDefense, key: "stat.spD" },
  { stat: StatName.Speed, key: "stat.spd" },
];

/** Effective types (override > transform > species), localised into chips. */
function buildTypeChips(
  context: PresentationContext,
  pokemon: PokemonInstance,
  language: string,
): InfoPanelType[] {
  const typeIds: readonly string[] =
    pokemon.typeOverride ??
    pokemon.transformState?.types ??
    context.getPokemonTypes(pokemon.definitionId);
  return typeIds.map((id) => ({
    id,
    label: TYPE_LABEL[id as PokemonType]
      ? language === "fr"
        ? TYPE_LABEL[id as PokemonType].fr
        : TYPE_LABEL[id as PokemonType].en
      : id,
  }));
}

/**
 * Battle stats for the ally panel: base (EV/nature) + crans + stat-modifying statuses, via the core
 * `effectiveDisplayStat` (mirrors the damage-calc / initiative math, incl. burn/paralysis + Cran/Pied
 * Véloce). The nature's boosted/lowered stat colours its label.
 */
function buildStatRows(context: PresentationContext, pokemon: PokemonInstance): InfoPanelStat[] {
  const combat = effectiveCombatStats(pokemon);
  const natureEffect = getNatureEffect(pokemon.nature);
  return INFO_PANEL_STAT_ROWS.map(({ stat, key }) => {
    const row: InfoPanelStat = {
      label: context.translate(key),
      value: combat[stat],
      stage: pokemon.statStages[stat] ?? 0,
      modified: effectiveDisplayStat(pokemon, stat),
      ...(natureEffect.boost === stat
        ? { natureEffect: "boost" as const }
        : natureEffect.lowered === stat
          ? { natureEffect: "lower" as const }
          : {}),
    };
    return row;
  });
}

/**
 * Build the InfoPanel view-model for a Pokémon (mirror of `InfoPanel.update`).
 *
 * `isAlly` (plan 174) gates the enriched readout: allies get stats + ability + nature; enemies
 * render minimal (types are public, so shown either way). The enemy progressive-reveal panel is
 * plan 176 — the caller (orchestrator) decides `isAlly` from the viewing player's perspective.
 */
export function buildInfoPanelView(
  context: PresentationContext,
  pokemon: PokemonInstance,
  state: BattleState,
  isAlly = false,
): InfoPanelData {
  const language = context.getLanguage();
  const badges: InfoPanelBadge[] = [];

  const majorStatus = pokemon.statusEffects[0]?.type;
  const majorKey = majorStatus ? MAJOR_STATUS_LABEL[majorStatus] : undefined;
  if (majorKey) {
    badges.push({ label: context.translate(majorKey), variant: "debuff" });
  }

  // Ally panels show Atk/Déf/Atk Spé/Déf Spé/Vit crans inline in the stats block (plan 174), so only
  // Précision/Esquive (not in the block) still need a badge. Enemy panels keep every stat-stage badge.
  const inlineStats: ReadonlySet<string> = isAlly
    ? new Set<string>([
        StatName.Attack,
        StatName.Defense,
        StatName.SpAttack,
        StatName.SpDefense,
        StatName.Speed,
      ])
    : new Set<string>();
  for (const [stat, key] of Object.entries(STAT_LABEL)) {
    if (inlineStats.has(stat)) {
      continue;
    }
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

  if (pokemon.lockInMoveId !== undefined && (pokemon.lockInTurnsRemaining ?? 0) > 0) {
    badges.push({
      label: context.translate("infoPanel.volatile.lockIn", {
        move: getMoveName(pokemon.lockInMoveId, language),
        turns: String(pokemon.lockInTurnsRemaining),
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

  if (pokemon.helpingHand === true) {
    badges.push({ label: context.translate("infoPanel.volatile.helpingHand"), variant: "buff" });
  }

  if ((pokemon.critStageBoost ?? 0) > 0) {
    badges.push({
      label: context.translate("infoPanel.volatile.focusEnergy", {
        stages: String(pokemon.critStageBoost),
      }),
      variant: "buff",
    });
  }

  if (pokemon.guaranteedCritArmed === true) {
    badges.push({ label: context.translate("infoPanel.volatile.laserFocus"), variant: "buff" });
  }

  if (pokemon.perishAura !== undefined) {
    badges.push({
      label: context.translate("infoPanel.volatile.perish", {
        turns: String(pokemon.perishAura.turnsRemaining),
      }),
      variant: "debuff",
    });
  }

  if (pokemon.smackedDown === true) {
    badges.push({ label: context.translate("infoPanel.volatile.smackedDown"), variant: "debuff" });
  }

  if (pokemon.drowsyTurns !== undefined) {
    badges.push({ label: context.translate("infoPanel.volatile.drowsy"), variant: "debuff" });
  }

  if ((pokemon.magnetRiseTurns ?? 0) > 0) {
    badges.push({
      label: context.translate("infoPanel.volatile.magnetRise", {
        turns: String(pokemon.magnetRiseTurns),
      }),
      variant: "buff",
    });
  }

  if ((pokemon.stockpileCount ?? 0) > 0) {
    badges.push({
      label: context.translate("infoPanel.volatile.stockpile", {
        count: String(pokemon.stockpileCount),
      }),
      variant: "buff",
    });
  }

  if (pokemon.typeOverride !== undefined) {
    if (pokemon.typeOverride.length === 0) {
      badges.push({ label: context.translate("infoPanel.volatile.noType"), variant: "volatile" });
    } else {
      const typeLabel = pokemon.typeOverride
        .map((type) => (language === "fr" ? TYPE_LABEL[type].fr : TYPE_LABEL[type].en))
        .join(" / ");
      badges.push({
        label: context.translate("infoPanel.volatile.typeChanged", { types: typeLabel }),
        variant: "volatile",
      });
    }
  }

  if (pokemon.abilitySuppressed === true) {
    badges.push({
      label: context.translate("infoPanel.volatile.abilitySealed"),
      variant: "debuff",
    });
  } else if (pokemon.abilityIdOverride !== undefined) {
    const abilityName =
      context.getAbilityName(pokemon.abilityIdOverride) ?? pokemon.abilityIdOverride;
    badges.push({
      label: context.translate("infoPanel.volatile.abilityChanged", { ability: abilityName }),
      variant: "volatile",
    });
  }

  if (pokemon.arenaTrapped === true) {
    badges.push({ label: context.translate("status.trapped"), variant: "debuff" });
  }

  if (pokemon.abilitySuppressedByGas === true && pokemon.abilitySuppressed !== true) {
    badges.push({
      label: context.translate("infoPanel.volatile.gasSuppressed"),
      variant: "debuff",
    });
  }

  // Info-reveal abilities (plan 163): scouting badges set by Fouille / Prédiction / Anticipation.
  if (pokemon.revealedItem === true && pokemon.heldItemId !== undefined) {
    badges.push({
      label: context.translate("infoPanel.reveal.item", {
        item: context.getItemName(pokemon.heldItemId) ?? pokemon.heldItemId,
      }),
      variant: "volatile",
    });
  }
  if (pokemon.revealedTopMove === true) {
    const topMoveId = strongestMoveId(pokemon.moveIds);
    if (topMoveId !== undefined) {
      badges.push({
        label: context.translate("infoPanel.reveal.topMove", {
          move: getMoveName(topMoveId, language),
        }),
        variant: "volatile",
      });
    }
  }
  if (pokemon.revealedAbility === true && pokemon.abilityId !== undefined) {
    const abilityName = context.getAbilityName(pokemon.abilityId) ?? pokemon.abilityId;
    badges.push({
      label: context.translate("infoPanel.reveal.ability", { ability: abilityName }),
      variant: "volatile",
    });
  }

  pushAuraBadges(context, badges, pokemon, state);

  const heldItem =
    pokemon.heldItemId === undefined
      ? undefined
      : (context.getItemName(pokemon.heldItemId) ?? undefined);

  // Ally-only enrichment (plan 174): exact stats, effective ability, nature. Enemies stay minimal.
  const abilityId = isAlly ? effectiveAbilityId(pokemon) : undefined;
  const ability = abilityId ? (context.getAbilityName(abilityId) ?? undefined) : undefined;

  return {
    name: getPokemonName(pokemon.definitionId, language),
    level: pokemon.level,
    gender: genderOf(pokemon.gender),
    hpCurrent: pokemon.currentHp,
    hpMax: pokemon.maxHp,
    team: teamNumberOf(pokemon.playerId),
    portraitUrl: context.getPortraitUrl(pokemon.definitionId),
    isAlly,
    types: buildTypeChips(context, pokemon, language),
    ...(ability === undefined ? {} : { ability }),
    ...(isAlly ? { stats: buildStatRows(context, pokemon) } : {}),
    badges,
    ...(heldItem === undefined ? {} : { heldItem }),
    ...(pokemon.heldItemId === undefined
      ? {}
      : { itemIconUrl: context.getItemIconUrl(pokemon.heldItemId) }),
  };
}

/* ── Tile info panel (plan 177) ───────────────────────────────────────────── */

const TERRAIN_LABEL: Record<TerrainType, string> = {
  normal: "tileInfo.terrain.normal",
  tall_grass: "tileInfo.terrain.tallGrass",
  obstacle: "tileInfo.terrain.obstacle",
  water: "tileInfo.terrain.water",
  deep_water: "tileInfo.terrain.deepWater",
  magma: "tileInfo.terrain.magma",
  lava: "tileInfo.terrain.lava",
  ice: "tileInfo.terrain.ice",
  sand: "tileInfo.terrain.sand",
  snow: "tileInfo.terrain.snow",
  swamp: "tileInfo.terrain.swamp",
};

const HAZARD_LABEL: Record<EntryHazardKind, string> = {
  spikes: "tileInfo.hazard.spikes",
  "stealth-rock": "tileInfo.hazard.stealthRock",
  "toxic-spikes": "tileInfo.hazard.toxicSpikes",
  "sticky-web": "tileInfo.hazard.stickyWeb",
};

const FIELD_LABEL: Record<FieldTerrain, string> = {
  grassy: "tileInfo.field.grassy",
  electric: "tileInfo.field.electric",
  misty: "tileInfo.field.misty",
  psychic: "tileInfo.field.psychic",
};

const ON_STOP_STATUS_LABEL: Partial<Record<StatusType, string>> = {
  [StatusType.Burned]: "tileInfo.onStop.burn",
  [StatusType.Poisoned]: "tileInfo.onStop.poison",
};

/** Per-terrain status trigger glyph (human 2026-07-25): 👣 = inflicted on pass-through, 🛑 = on stop. */
const TERRAIN_STATUS_TRIGGER: Partial<Record<TerrainType, string>> = {
  magma: "👣",
  swamp: "🛑",
};

const FIELD_GLOBAL_ORDER: readonly FieldGlobalKind[] = [
  FieldGlobalKind.Gravity,
  FieldGlobalKind.WonderRoom,
  FieldGlobalKind.MagicRoom,
];

const FIELD_GLOBAL_LABEL: Record<FieldGlobalKind, string> = {
  gravity: "tileInfo.zone.gravity",
  "wonder-room": "tileInfo.zone.wonderRoom",
  "magic-room": "tileInfo.zone.magicRoom",
};

function typeLabelOf(type: PokemonType, language: string): string {
  const entry = TYPE_LABEL[type];
  if (!entry) {
    return type;
  }
  return language === "fr" ? entry.fr : entry.en;
}

/**
 * Build the tile-info view-model (plan 177): the terrain of `position` + every modifier active on it
 * (movement cost, DoT/status, type bonus, immunities, hazards, field terrain, global zones). Effects
 * are read intrinsically (occupant-agnostic: what the tile does to a grounded, non-immune mon), so the
 * panel is meaningful even over an empty tile. Returns null when `position` is out of bounds.
 */
export function buildTileInfoView(
  context: PresentationContext,
  state: BattleState,
  position: Position,
): TileInfoData | null {
  const tile = state.grid?.[position.y]?.[position.x];
  if (!tile) {
    return null;
  }
  const language = context.getLanguage();
  const { terrain } = tile;
  const covers = (tiles: readonly Position[]): boolean =>
    tiles.some((t) => t.x === position.x && t.y === position.y);

  // Line 1 = the terrain's intrinsic combat effects (traversal / status / DoT) grouped on one row
  // (the height sits beside the name in the header, human 2026-07-25). The rest is stacked below.
  const summary: TileInfoChip[] = [];

  const dotFraction = getTerrainDotFraction(terrain);
  const fatal = dotFraction === 1;
  const penalty = getMovementPenalty(terrain, [], false);
  if (!isTerrainPassable(terrain)) {
    summary.push({
      emoji: fatal ? "⛔💀" : "⛔",
      title: context.translate(fatal ? "tileInfo.dotFatal" : "tileInfo.impassable"),
      tone: "danger",
    });
  } else if (penalty > 0) {
    summary.push({
      emoji: "🥾",
      text: `−${penalty}`,
      title: context.translate("tileInfo.movementPenalty", { cost: String(penalty) }),
      tone: "danger",
    });
  }

  // Status: trigger glyph (👣 = inflicted on pass-through / 🛑 = on stop, per terrain) + status sprite.
  const onStop = getTerrainStatusOnStop(terrain, [], false);
  const onStopKey = onStop ? ON_STOP_STATUS_LABEL[onStop] : undefined;
  if (onStop && onStopKey) {
    summary.push({
      emoji: TERRAIN_STATUS_TRIGGER[terrain] ?? "🛑",
      iconUrls: [context.getStatusIconUrl(onStop)],
      title: context.translate(onStopKey),
      tone: "danger",
    });
  }

  // Recurring damage while standing (🛑 = on stop). Shown small (secondary). Fatal → traversal row above.
  if (dotFraction !== null && !fatal) {
    summary.push({
      emoji: "🛑",
      text: `−1/${dotFraction}`,
      small: true,
      title: context.translate("tileInfo.dot", { fraction: String(dotFraction) }),
      tone: "danger",
    });
  }

  const lines: TileInfoChip[][] = [];
  if (summary.length > 0) {
    lines.push(summary);
  }

  // Stacked (one per line): hazards (no ⚠ glyph, human 2026-07-25), then field + global zones with
  // their remaining-turns count in place of a glyph, then distortion.
  for (const cell of getEntryHazardsAt(state, position)) {
    const name = context.translate(HAZARD_LABEL[cell.kind]);
    lines.push([
      {
        text: maxLayersFor(cell.kind) > 1 ? `${name} ×${cell.layers}` : name,
        title: name,
        tone: "danger",
      },
    ]);
  }

  const fieldZone = [...state.fieldTerrains].reverse().find((zone) => covers(zone.tiles));
  if (fieldZone) {
    const name = context.translate(FIELD_LABEL[fieldZone.kind]);
    lines.push([{ text: name, duration: fieldZone.remainingTurns, title: name, tone: "info" }]);
  }

  for (const kind of FIELD_GLOBAL_ORDER) {
    const zone = state.fieldGlobalZones.find((z) => z.kind === kind && covers(z.tiles));
    if (zone) {
      const name = context.translate(FIELD_GLOBAL_LABEL[kind]);
      lines.push([{ text: name, duration: zone.remainingTurns, title: name, tone: "info" }]);
    }
  }

  const distortion = state.distortionZones.find((zone) => covers(zone.tiles));
  if (distortion) {
    const name = context.translate("tileInfo.zone.distortion");
    lines.push([{ text: name, duration: distortion.remainingTurns, title: name, tone: "info" }]);
  }

  // Damage bonus: own line — the real type sprite + the multiplier.
  const bonusType = getTerrainBonusType(terrain);
  if (bonusType) {
    lines.push([
      {
        iconUrls: [context.getTypeIconUrl(bonusType)],
        text: "×1.15",
        title: context.translate("tileInfo.typeBonus", { type: typeLabelOf(bonusType, language) }),
        tone: "buff",
      },
    ]);
  }

  // Immunity: own line — a "free/unaffected" marker (🆓) then the spared type sprites.
  const immuneTypes = getTerrainImmuneTypes(terrain);
  if (immuneTypes.length > 0) {
    lines.push([
      {
        emoji: "🆓",
        iconUrls: immuneTypes.map((type) => context.getTypeIconUrl(type)),
        title: context.translate("tileInfo.immune", {
          types: immuneTypes.map((type) => typeLabelOf(type, language)).join(", "),
        }),
        tone: "info",
      },
    ]);
  }

  return {
    terrainLabel: context.translate(TERRAIN_LABEL[terrain]),
    height: tile.height,
    lines,
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

export function buildTailwindView(state: BattleState): TailwindView | null {
  if (!state.tailwind) {
    return null;
  }
  return {
    direction: state.tailwind.direction,
    turnsRemaining: state.tailwind.remainingTurns,
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
