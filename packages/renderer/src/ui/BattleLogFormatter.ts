import type { BattleEvent } from "@pokemon-tactic/core";
import {
  BattleEventType,
  DefensiveKind,
  StatName,
  StatusImmuneReason,
  StatusType,
  TerrainType,
  Weather,
} from "@pokemon-tactic/core";
import {
  BATTLE_LOG_COLOR_ABILITY,
  BATTLE_LOG_COLOR_BATTLE_ENDED,
  BATTLE_LOG_COLOR_CRITICAL,
  BATTLE_LOG_COLOR_DAMAGE,
  BATTLE_LOG_COLOR_DEFENSE,
  BATTLE_LOG_COLOR_EFFECTIVENESS,
  BATTLE_LOG_COLOR_HEAL,
  BATTLE_LOG_COLOR_ITEM,
  BATTLE_LOG_COLOR_ITEM_CONSUMED,
  BATTLE_LOG_COLOR_KNOCKBACK,
  BATTLE_LOG_COLOR_KO,
  BATTLE_LOG_COLOR_MISS,
  BATTLE_LOG_COLOR_MOVE,
  BATTLE_LOG_COLOR_MULTI_HIT,
  BATTLE_LOG_COLOR_RECHARGE,
  BATTLE_LOG_COLOR_STAT_DOWN,
  BATTLE_LOG_COLOR_STAT_UP,
  BATTLE_LOG_COLOR_STATUS,
  BATTLE_LOG_COLOR_TURN,
} from "../constants";
import type { Language } from "../i18n/types";

export interface BattleLogEntry {
  readonly message: string;
  readonly color: string;
  readonly pokemonIds: readonly string[];
}

export interface BattleLogContext {
  readonly getPokemonName: (id: string) => string;
  readonly getMoveName: (moveId: string) => string;
  readonly getAbilityName: (abilityId: string) => string | null;
  readonly getItemName: (itemId: string) => string | null;
  readonly language: Language;
}

export const BattleLogColors = {
  turn: BATTLE_LOG_COLOR_TURN,
  move: BATTLE_LOG_COLOR_MOVE,
  damage: BATTLE_LOG_COLOR_DAMAGE,
  effectiveness: BATTLE_LOG_COLOR_EFFECTIVENESS,
  miss: BATTLE_LOG_COLOR_MISS,
  status: BATTLE_LOG_COLOR_STATUS,
  statUp: BATTLE_LOG_COLOR_STAT_UP,
  statDown: BATTLE_LOG_COLOR_STAT_DOWN,
  ko: BATTLE_LOG_COLOR_KO,
  defense: BATTLE_LOG_COLOR_DEFENSE,
  knockback: BATTLE_LOG_COLOR_KNOCKBACK,
  multiHit: BATTLE_LOG_COLOR_MULTI_HIT,
  recharge: BATTLE_LOG_COLOR_RECHARGE,
  ability: BATTLE_LOG_COLOR_ABILITY,
  item: BATTLE_LOG_COLOR_ITEM,
  itemConsumed: BATTLE_LOG_COLOR_ITEM_CONSUMED,
  critical: BATTLE_LOG_COLOR_CRITICAL,
  heal: BATTLE_LOG_COLOR_HEAL,
  battleEnded: BATTLE_LOG_COLOR_BATTLE_ENDED,
} as const;

const STATUS_LOG_KEY: Record<
  string,
  { applied: { fr: string; en: string }; removed: { fr: string; en: string } }
> = {
  [StatusType.Burned]: {
    applied: { fr: "{name} est brûlé !", en: "{name} was burned!" },
    removed: { fr: "{name} n'est plus brûlé", en: "{name} is no longer burned" },
  },
  [StatusType.Poisoned]: {
    applied: { fr: "{name} est empoisonné !", en: "{name} was poisoned!" },
    removed: { fr: "{name} n'est plus empoisonné", en: "{name} is no longer poisoned" },
  },
  [StatusType.BadlyPoisoned]: {
    applied: { fr: "{name} est gravement empoisonné !", en: "{name} was badly poisoned!" },
    removed: { fr: "{name} n'est plus empoisonné", en: "{name} is no longer poisoned" },
  },
  [StatusType.Paralyzed]: {
    applied: { fr: "{name} est paralysé !", en: "{name} was paralyzed!" },
    removed: { fr: "{name} n'est plus paralysé", en: "{name} is no longer paralyzed" },
  },
  [StatusType.Frozen]: {
    applied: { fr: "{name} est gelé !", en: "{name} was frozen!" },
    removed: { fr: "{name} n'est plus gelé", en: "{name} is no longer frozen" },
  },
  [StatusType.Asleep]: {
    applied: { fr: "{name} s'est endormi !", en: "{name} fell asleep!" },
    removed: { fr: "{name} se réveille !", en: "{name} woke up!" },
  },
  [StatusType.Confused]: {
    applied: { fr: "{name} est confus !", en: "{name} became confused!" },
    removed: { fr: "{name} n'est plus confus", en: "{name} snapped out of confusion" },
  },
  [StatusType.Seeded]: {
    applied: { fr: "{name} est infecté par Vampigraine !", en: "{name} was seeded!" },
    removed: { fr: "{name} est libéré de Vampigraine", en: "{name} was freed from Leech Seed" },
  },
  [StatusType.Trapped]: {
    applied: { fr: "{name} est piégé !", en: "{name} was trapped!" },
    removed: { fr: "{name} est libéré du piège", en: "{name} broke free from the trap" },
  },
};

const STAT_NAME_KEY: Record<string, { fr: string; en: string }> = {
  [StatName.Attack]: { fr: "Attaque", en: "Attack" },
  [StatName.Defense]: { fr: "Défense", en: "Defense" },
  [StatName.SpAttack]: { fr: "Atq. Spé.", en: "Sp. Atk" },
  [StatName.SpDefense]: { fr: "Déf. Spé.", en: "Sp. Def" },
  [StatName.Speed]: { fr: "Vitesse", en: "Speed" },
  [StatName.Accuracy]: { fr: "Précision", en: "Accuracy" },
  [StatName.Evasion]: { fr: "Esquive", en: "Evasion" },
};

const TERRAIN_STATUS_LOG_KEY: Partial<Record<TerrainType, { fr: string; en: string }>> = {
  [TerrainType.Swamp]: {
    fr: "{name} est empoisonné par le marécage !",
    en: "{name} was poisoned by the swamp!",
  },
  [TerrainType.Magma]: {
    fr: "{name} est brûlé par le magma !",
    en: "{name} was burned by the magma!",
  },
};

const DEFENSE_NAME: Record<string, { fr: string; en: string }> = {
  [DefensiveKind.Protect]: { fr: "Abri", en: "Protect" },
  [DefensiveKind.Detect]: { fr: "Détection", en: "Detect" },
  [DefensiveKind.WideGuard]: { fr: "Garde Large", en: "Wide Guard" },
  [DefensiveKind.QuickGuard]: { fr: "Prévention", en: "Quick Guard" },
  [DefensiveKind.Counter]: { fr: "Riposte", en: "Counter" },
  [DefensiveKind.MirrorCoat]: { fr: "Voile Miroir", en: "Mirror Coat" },
  [DefensiveKind.MetalBurst]: { fr: "Fulmifer", en: "Metal Burst" },
  [DefensiveKind.Endure]: { fr: "Ténacité", en: "Endure" },
};

function resolve(template: string, name: string): string {
  return template.replaceAll("{name}", name);
}

export function formatBattleEvent(
  event: BattleEvent,
  context: BattleLogContext,
): BattleLogEntry | BattleLogEntry[] | null {
  const lang = context.language;

  switch (event.type) {
    case BattleEventType.TurnStarted: {
      const name = context.getPokemonName(event.pokemonId);
      const message = lang === "fr" ? `Tour de ${name}` : `${name}'s turn`;
      return { message, color: BattleLogColors.turn, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.MoveStarted: {
      const name = context.getPokemonName(event.attackerId);
      const moveName = context.getMoveName(event.moveId);
      const message = lang === "fr" ? `${name} utilise ${moveName} !` : `${name} used ${moveName}!`;
      return { message, color: BattleLogColors.move, pokemonIds: [event.attackerId] };
    }

    case BattleEventType.DamageDealt: {
      if (event.effectiveness === 0) {
        return null;
      }
      const name = context.getPokemonName(event.targetId);
      const dmgMessage =
        lang === "fr" ? `${name} perd ${event.amount} PV !` : `${name} lost ${event.amount} HP!`;
      const entries: BattleLogEntry[] = [
        { message: dmgMessage, color: BattleLogColors.damage, pokemonIds: [event.targetId] },
      ];

      const effectivenessText = getEffectivenessText(event.effectiveness, lang);
      if (effectivenessText) {
        entries.push({
          message: effectivenessText,
          color: BattleLogColors.effectiveness,
          pokemonIds: [],
        });
      }
      return entries;
    }

    case BattleEventType.MoveMissed: {
      const name = context.getPokemonName(event.attackerId);
      const message = lang === "fr" ? `${name} rate son attaque !` : `${name}'s attack missed!`;
      return { message, color: BattleLogColors.miss, pokemonIds: [event.attackerId] };
    }

    case BattleEventType.StatusApplied: {
      const name = context.getPokemonName(event.targetId);
      const statusEntry = STATUS_LOG_KEY[event.status];
      if (!statusEntry) {
        return null;
      }
      const message = resolve(statusEntry.applied[lang], name);
      return { message, color: BattleLogColors.status, pokemonIds: [event.targetId] };
    }

    case BattleEventType.StatusImmune: {
      const name = context.getPokemonName(event.targetId);
      if (event.reason === StatusImmuneReason.Weather && event.status === StatusType.Frozen) {
        const message =
          lang === "fr"
            ? `Le soleil brillant empêche ${name} d'être gelé.`
            : `The bright sunlight prevents ${name} from being frozen.`;
        return { message, color: BattleLogColors.status, pokemonIds: [event.targetId] };
      }
      const message =
        lang === "fr" ? `Ça n'affecte pas ${name}...` : `It doesn't affect ${name}...`;
      return { message, color: BattleLogColors.status, pokemonIds: [event.targetId] };
    }

    case BattleEventType.TerrainStatusApplied: {
      const name = context.getPokemonName(event.pokemonId);
      const terrainEntry = TERRAIN_STATUS_LOG_KEY[event.terrain];
      if (!terrainEntry) {
        const statusEntry = STATUS_LOG_KEY[event.status];
        if (!statusEntry) {
          return null;
        }
        const fallback = resolve(statusEntry.applied[lang], name);
        return { message: fallback, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
      }
      const message = resolve(terrainEntry[lang], name);
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.StatusRemoved: {
      const name = context.getPokemonName(event.targetId);
      const statusEntry = STATUS_LOG_KEY[event.status];
      if (!statusEntry) {
        return null;
      }
      const message = resolve(statusEntry.removed[lang], name);
      return { message, color: BattleLogColors.status, pokemonIds: [event.targetId] };
    }

    case BattleEventType.StatChanged: {
      const name = context.getPokemonName(event.targetId);
      const statName = STAT_NAME_KEY[event.stat]?.[lang] ?? event.stat;
      const isUp = event.stages > 0;
      const message = isUp
        ? lang === "fr"
          ? `${statName} de ${name} augmente !`
          : `${name}'s ${statName} rose!`
        : lang === "fr"
          ? `${statName} de ${name} baisse !`
          : `${name}'s ${statName} fell!`;
      return {
        message,
        color: isUp ? BattleLogColors.statUp : BattleLogColors.statDown,
        pokemonIds: [event.targetId],
      };
    }

    case BattleEventType.PokemonKo: {
      const name = context.getPokemonName(event.pokemonId);
      const message = lang === "fr" ? `${name} est K.O. !` : `${name} fainted!`;
      return { message, color: BattleLogColors.ko, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.DefenseActivated: {
      const name = context.getPokemonName(event.pokemonId);
      const defenseName = DEFENSE_NAME[event.defenseKind]?.[lang] ?? event.defenseKind;
      const message =
        lang === "fr" ? `${name} se protège avec ${defenseName} !` : `${name} used ${defenseName}!`;
      return { message, color: BattleLogColors.defense, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.DefenseTriggered: {
      const name = context.getPokemonName(event.defenderId);
      const defenseName = DEFENSE_NAME[event.defenseKind]?.[lang] ?? event.defenseKind;
      const message = event.blocked
        ? lang === "fr"
          ? `${defenseName} protège ${name} !`
          : `${name}'s ${defenseName} blocked the attack!`
        : lang === "fr"
          ? `${defenseName} renvoie les dégâts !`
          : `${defenseName} reflected the damage!`;
      return { message, color: BattleLogColors.defense, pokemonIds: [event.defenderId] };
    }

    case BattleEventType.ConfusionTriggered: {
      const name = context.getPokemonName(event.pokemonId);
      const message = lang === "fr" ? `${name} est confus...` : `${name} is confused...`;
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.KnockbackApplied: {
      const name = context.getPokemonName(event.pokemonId);
      const message = lang === "fr" ? `${name} est repoussé !` : `${name} was knocked back!`;
      return { message, color: BattleLogColors.knockback, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.MultiHitComplete: {
      const message =
        lang === "fr" ? `Touché ${event.totalHits} fois !` : `Hit ${event.totalHits} times!`;
      return { message, color: BattleLogColors.multiHit, pokemonIds: [] };
    }

    case BattleEventType.RechargeStarted: {
      const name = context.getPokemonName(event.pokemonId);
      const message = lang === "fr" ? `${name} doit se recharger` : `${name} must recharge`;
      return { message, color: BattleLogColors.recharge, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.BattleEnded: {
      const message =
        lang === "fr"
          ? `${event.winnerId} remporte le combat !`
          : `${event.winnerId} wins the battle!`;
      return { message, color: BattleLogColors.battleEnded, pokemonIds: [] };
    }

    case BattleEventType.AbilityActivated: {
      const abilityName = context.getAbilityName(event.abilityId);
      if (!abilityName) {
        return null;
      }
      const pokemonName = context.getPokemonName(event.pokemonId);
      const message =
        lang === "fr"
          ? `${abilityName} de ${pokemonName} s'active !`
          : `${pokemonName}'s ${abilityName} activated!`;
      return { message, color: BattleLogColors.ability, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.HeldItemActivated: {
      const itemName = context.getItemName(event.itemId);
      if (!itemName) {
        return null;
      }
      const pokemonName = context.getPokemonName(event.pokemonId);
      const message =
        lang === "fr"
          ? `${itemName} de ${pokemonName} s'active !`
          : `${pokemonName}'s ${itemName} activated!`;
      return { message, color: BattleLogColors.item, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.HeldItemConsumed: {
      const itemName = context.getItemName(event.itemId);
      if (!itemName) {
        return null;
      }
      const pokemonName = context.getPokemonName(event.pokemonId);
      const message =
        lang === "fr"
          ? `${pokemonName} a utilisé son ${itemName}`
          : `${pokemonName} used its ${itemName}`;
      return { message, color: BattleLogColors.itemConsumed, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.CriticalHit: {
      const pokemonName = context.getPokemonName(event.targetId);
      const message =
        lang === "fr" ? `Coup critique sur ${pokemonName} !` : `Critical hit on ${pokemonName}!`;
      return { message, color: BattleLogColors.critical, pokemonIds: [event.targetId] };
    }

    case BattleEventType.HpRestored: {
      const pokemonName = context.getPokemonName(event.pokemonId);
      const message =
        lang === "fr"
          ? `${pokemonName} récupère ${event.amount} PV`
          : `${pokemonName} restored ${event.amount} HP`;
      return { message, color: BattleLogColors.heal, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.WeatherSet: {
      const message = formatWeatherSet(event.weather, lang);
      if (!message) {
        return null;
      }
      return { message, color: BattleLogColors.turn, pokemonIds: [] };
    }

    case BattleEventType.WeatherCleared: {
      const message = formatWeatherCleared(event.weather, lang);
      if (!message) {
        return null;
      }
      return { message, color: BattleLogColors.turn, pokemonIds: [] };
    }

    case BattleEventType.WeatherDamage: {
      const name = context.getPokemonName(event.pokemonId);
      const message =
        lang === "fr"
          ? `${name} est blessé par la tempête de sable ! (-${event.amount} PV)`
          : `${name} is buffeted by the sandstorm! (-${event.amount} HP)`;
      return { message, color: BattleLogColors.damage, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.WeatherWar: {
      const message =
        lang === "fr"
          ? "La nouvelle météo écrase la précédente !"
          : "The new weather overrides the previous one!";
      return { message, color: BattleLogColors.turn, pokemonIds: [] };
    }

    case BattleEventType.MoveCharging: {
      const name = context.getPokemonName(event.pokemonId);
      const moveName = context.getMoveName(event.moveId);
      const message =
        lang === "fr"
          ? `${name} concentre son énergie pour ${moveName} !`
          : `${name} is gathering energy for ${moveName}!`;
      return { message, color: BattleLogColors.move, pokemonIds: [event.pokemonId] };
    }

    default:
      return null;
  }
}

function formatWeatherSet(weather: Weather, lang: "fr" | "en"): string | null {
  switch (weather) {
    case Weather.Sun:
      return lang === "fr" ? "Le soleil brille intensément !" : "The sunlight turned harsh!";
    case Weather.Rain:
      return lang === "fr" ? "Il commence à pleuvoir !" : "It started to rain!";
    case Weather.Sandstorm:
      return lang === "fr" ? "Une tempête de sable se lève !" : "A sandstorm kicked up!";
    case Weather.Snow:
      return lang === "fr" ? "Il commence à neiger !" : "It started to snow!";
    default:
      return null;
  }
}

function formatWeatherCleared(weather: Weather, lang: "fr" | "en"): string | null {
  switch (weather) {
    case Weather.Sun:
      return lang === "fr" ? "Le soleil s'estompe." : "The sunlight faded.";
    case Weather.Rain:
      return lang === "fr" ? "La pluie cesse." : "The rain stopped.";
    case Weather.Sandstorm:
      return lang === "fr" ? "La tempête de sable s'apaise." : "The sandstorm subsided.";
    case Weather.Snow:
      return lang === "fr" ? "Il cesse de neiger." : "The snow stopped.";
    default:
      return null;
  }
}

function getEffectivenessText(effectiveness: number, lang: Language): string | null {
  if (effectiveness >= 4) {
    return lang === "fr" ? "  (Extrêmement efficace !)" : "  (Extremely effective!)";
  }
  if (effectiveness >= 2) {
    return lang === "fr" ? "  (Super efficace !)" : "  (Super effective!)";
  }
  if (effectiveness <= 0.25) {
    return lang === "fr" ? "  (Quasi inefficace...)" : "  (Barely effective...)";
  }
  if (effectiveness <= 0.5) {
    return lang === "fr" ? "  (Pas très efficace...)" : "  (Not very effective...)";
  }
  return null;
}
