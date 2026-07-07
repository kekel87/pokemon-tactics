import type {
  AuraKind,
  BattleEvent,
  Direction,
  EntryHazardKind,
  FieldGlobalKind,
  FieldTerrain,
  PokemonType,
} from "@pokemon-tactic/core";
import {
  BattleEventType,
  DefensiveKind,
  HitAndRunRetreatFallbackReason,
  MoveFailedReason,
  ProtectionReason,
  StatName,
  StatusImmuneReason,
  StatusType,
  SubstituteFailedReason,
  TerrainType,
  TypeChangeReason,
  Weather,
} from "@pokemon-tactic/core";
import { TYPE_LABEL } from "@pokemon-tactic/view-core";
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
} from "./constants.js";

const FIELD_TERRAIN_LABELS_FR: Record<FieldTerrain, string> = {
  grassy: "Champ Herbu",
  electric: "Champ Électrifié",
  misty: "Champ Brumeux",
  psychic: "Champ Psychique",
};

const FIELD_TERRAIN_LABELS_EN: Record<FieldTerrain, string> = {
  grassy: "Grassy Terrain",
  electric: "Electric Terrain",
  misty: "Misty Terrain",
  psychic: "Psychic Terrain",
};

function fieldTerrainLabel(kind: FieldTerrain, lang: string): string {
  return lang === "fr" ? FIELD_TERRAIN_LABELS_FR[kind] : FIELD_TERRAIN_LABELS_EN[kind];
}

const FIELD_GLOBAL_LABELS_FR: Record<FieldGlobalKind, string> = {
  gravity: "Gravité",
  "wonder-room": "Zone Étrange",
  "magic-room": "Zone Magique",
};

const FIELD_GLOBAL_LABELS_EN: Record<FieldGlobalKind, string> = {
  gravity: "Gravity",
  "wonder-room": "Wonder Room",
  "magic-room": "Magic Room",
};

function fieldGlobalLabel(kind: FieldGlobalKind, lang: string): string {
  return lang === "fr" ? FIELD_GLOBAL_LABELS_FR[kind] : FIELD_GLOBAL_LABELS_EN[kind];
}

const DIRECTION_LABELS_FR: Record<Direction, string> = {
  north: "Nord",
  south: "Sud",
  east: "Est",
  west: "Ouest",
};

const DIRECTION_LABELS_EN: Record<Direction, string> = {
  north: "North",
  south: "South",
  east: "East",
  west: "West",
};

function directionLabel(direction: Direction, lang: string): string {
  return lang === "fr" ? DIRECTION_LABELS_FR[direction] : DIRECTION_LABELS_EN[direction];
}

const ENTRY_HAZARD_LABELS_FR: Record<EntryHazardKind, string> = {
  spikes: "Picots",
  "stealth-rock": "Pièges de Roc",
  "toxic-spikes": "Pics Toxik",
  "sticky-web": "Toile Gluante",
};

const ENTRY_HAZARD_LABELS_EN: Record<EntryHazardKind, string> = {
  spikes: "Spikes",
  "stealth-rock": "Stealth Rock",
  "toxic-spikes": "Toxic Spikes",
  "sticky-web": "Sticky Web",
};

function entryHazardLabel(kind: EntryHazardKind, lang: string): string {
  return lang === "fr" ? ENTRY_HAZARD_LABELS_FR[kind] : ENTRY_HAZARD_LABELS_EN[kind];
}

/** Type names for the B4 Terrain Pulse morph log ("becomes type X"). */
const MORPH_TYPE_NAME: Partial<Record<PokemonType, { fr: string; en: string }>> = {
  grass: { fr: "Plante", en: "Grass" },
  electric: { fr: "Électrik", en: "Electric" },
  fairy: { fr: "Fée", en: "Fairy" },
  psychic: { fr: "Psy", en: "Psychic" },
};

const AURA_LABELS_FR: Record<AuraKind, string> = {
  reflect: "Protection",
  "light-screen": "Mur Lumière",
  mist: "Brume",
  safeguard: "Rune Protect",
};

const AURA_LABELS_EN: Record<AuraKind, string> = {
  reflect: "Reflect",
  "light-screen": "Light Screen",
  mist: "Mist",
  safeguard: "Safeguard",
};

function auraKindLabel(kind: AuraKind, lang: string): string {
  return lang === "fr" ? AURA_LABELS_FR[kind] : AURA_LABELS_EN[kind];
}

/** UI language for the formatter's fr/en branches (host passes its own code). */
type Language = "en" | "fr";

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
  [StatusType.Flinch]: {
    applied: { fr: "{name} est apeuré !", en: "{name} flinched!" },
    removed: { fr: "{name} n'est plus apeuré", en: "{name} is no longer flinching" },
  },
  [StatusType.Seeded]: {
    applied: { fr: "{name} est infecté par Vampigraine !", en: "{name} was seeded!" },
    removed: { fr: "{name} est libéré de Vampigraine", en: "{name} was freed from Leech Seed" },
  },
  [StatusType.Trapped]: {
    applied: { fr: "{name} est piégé !", en: "{name} was trapped!" },
    removed: { fr: "{name} est libéré du piège", en: "{name} broke free from the trap" },
  },
  [StatusType.Taunted]: {
    applied: { fr: "{name} est provoqué !", en: "{name} fell for the taunt!" },
    removed: { fr: "La provoc de {name} se dissipe.", en: "{name} shook off the taunt." },
  },
  [StatusType.Disabled]: {
    applied: { fr: "{name} est sous Entrave !", en: "{name} was disabled!" },
    removed: { fr: "{name} n'est plus sous Entrave.", en: "{name} is no longer disabled." },
  },
  [StatusType.Encored]: {
    applied: { fr: "{name} reçoit un Encore !", en: "{name} got an encore!" },
    removed: { fr: "L'Encore de {name} se dissipe.", en: "{name}'s encore ended." },
  },
  [StatusType.Charged]: {
    applied: { fr: "{name} se charge en électricité !", en: "{name} began charging power!" },
    removed: { fr: "La charge de {name} se dissipe.", en: "{name}'s charge faded." },
  },
  [StatusType.HealBlocked]: {
    applied: { fr: "{name} ne peut plus être soigné !", en: "{name} was prevented from healing!" },
    removed: { fr: "{name} peut à nouveau être soigné.", en: "{name} can heal again." },
  },
  [StatusType.DestinyBond]: {
    applied: {
      fr: "{name} tisse un lien du destin !",
      en: "{name} is taking its foe down with it!",
    },
    removed: { fr: "Le lien du destin de {name} se dissipe.", en: "{name}'s destiny bond faded." },
  },
  [StatusType.Grudge]: {
    applied: { fr: "{name} nourrit une rancune !", en: "{name} is bearing a grudge!" },
    removed: { fr: "La rancune de {name} se dissipe.", en: "{name}'s grudge faded." },
  },
  [StatusType.Ingrain]: {
    applied: { fr: "{name} prend racine !", en: "{name} planted its roots!" },
    removed: { fr: "Les racines de {name} se rétractent.", en: "{name}'s roots receded." },
  },
  [StatusType.AquaRing]: {
    applied: {
      fr: "{name} s'entoure d'un voile d'eau !",
      en: "{name} surrounded itself with a veil of water!",
    },
    removed: { fr: "Le voile d'eau de {name} se dissipe.", en: "{name}'s aqua ring faded." },
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
      const usedEntry: BattleLogEntry = {
        message,
        color: BattleLogColors.move,
        pokemonIds: [event.attackerId],
      };
      // B4 morph: Nature Power transforms into another move; Terrain Pulse changes type.
      const morphEntries: BattleLogEntry[] = [];
      if (event.resolvedMoveId !== undefined) {
        const resolvedName = context.getMoveName(event.resolvedMoveId);
        morphEntries.push({
          message: `${moveName} → ${resolvedName}`,
          color: BattleLogColors.move,
          pokemonIds: [event.attackerId],
        });
      }
      if (event.resolvedType !== undefined) {
        const typeName = MORPH_TYPE_NAME[event.resolvedType]?.[lang] ?? event.resolvedType;
        morphEntries.push({
          message:
            lang === "fr" ? `${moveName} → type ${typeName}` : `${moveName} → ${typeName}-type`,
          color: BattleLogColors.move,
          pokemonIds: [event.attackerId],
        });
      }
      return morphEntries.length === 0 ? usedEntry : [usedEntry, ...morphEntries];
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

    case BattleEventType.Flinched: {
      const name = context.getPokemonName(event.pokemonId);
      const message =
        lang === "fr" ? `${name} est apeuré et ne peut pas agir !` : `${name} flinched!`;
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
        event.winnerId === null
          ? lang === "fr"
            ? "Double K.O. — match nul !"
            : "Double KO — it's a draw!"
          : lang === "fr"
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

    case BattleEventType.ItemKnockedOff: {
      const itemName = context.getItemName(event.itemId) ?? event.itemId;
      const pokemonName = context.getPokemonName(event.pokemonId);
      const message =
        lang === "fr"
          ? `${pokemonName} perd son ${itemName} !`
          : `${pokemonName} lost its ${itemName}!`;
      return { message, color: BattleLogColors.itemConsumed, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.ItemStolen: {
      const itemName = context.getItemName(event.itemId) ?? event.itemId;
      const thiefName = context.getPokemonName(event.thiefId);
      const victimName = context.getPokemonName(event.victimId);
      const message =
        lang === "fr"
          ? `${thiefName} vole le ${itemName} de ${victimName} !`
          : `${thiefName} stole ${victimName}'s ${itemName}!`;
      return {
        message,
        color: BattleLogColors.item,
        pokemonIds: [event.thiefId, event.victimId],
      };
    }

    case BattleEventType.ItemsSwapped: {
      const pokemonName = context.getPokemonName(event.pokemonId);
      const otherName = context.getPokemonName(event.otherId);
      const message =
        lang === "fr"
          ? `${pokemonName} échange son objet avec ${otherName} !`
          : `${pokemonName} swapped items with ${otherName}!`;
      return {
        message,
        color: BattleLogColors.item,
        pokemonIds: [event.pokemonId, event.otherId],
      };
    }

    case BattleEventType.ItemBurned: {
      const itemName = context.getItemName(event.itemId) ?? event.itemId;
      const pokemonName = context.getPokemonName(event.pokemonId);
      const message =
        lang === "fr"
          ? `Le ${itemName} de ${pokemonName} est réduit en cendres !`
          : `${pokemonName}'s ${itemName} was burned up!`;
      return { message, color: BattleLogColors.itemConsumed, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.BerryEaten: {
      const itemName = context.getItemName(event.itemId) ?? event.itemId;
      const eaterName = context.getPokemonName(event.eaterId);
      const message =
        lang === "fr"
          ? `${eaterName} dévore la ${itemName} !`
          : `${eaterName} ate the ${itemName}!`;
      return { message, color: BattleLogColors.item, pokemonIds: [event.eaterId] };
    }

    case BattleEventType.ItemRecycled: {
      const itemName = context.getItemName(event.itemId) ?? event.itemId;
      const pokemonName = context.getPokemonName(event.pokemonId);
      const message =
        lang === "fr"
          ? `${pokemonName} recycle son ${itemName} !`
          : `${pokemonName} recycled its ${itemName}!`;
      return { message, color: BattleLogColors.item, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.ItemFlung: {
      const itemName = context.getItemName(event.itemId) ?? event.itemId;
      const pokemonName = context.getPokemonName(event.pokemonId);
      const message =
        lang === "fr"
          ? `${pokemonName} dégomme son ${itemName} !`
          : `${pokemonName} flung its ${itemName}!`;
      return { message, color: BattleLogColors.itemConsumed, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.ItemMoveFailed: {
      const message = lang === "fr" ? "Mais cela échoue !" : "But it failed!";
      return { message, color: BattleLogColors.miss, pokemonIds: [event.pokemonId] };
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

    case BattleEventType.WishPosted: {
      const caster = context.getPokemonName(event.casterId);
      const message =
        lang === "fr" ? `${caster} fait un vœu de guérison.` : `${caster} made a wish.`;
      return { message, color: BattleLogColors.heal, pokemonIds: [event.casterId, event.targetId] };
    }

    case BattleEventType.WishHealed: {
      const name = context.getPokemonName(event.pokemonId);
      const message =
        lang === "fr"
          ? `Le vœu de guérison se réalise, ${name} récupère ${event.amount} PV !`
          : `${name}'s wish came true, restoring ${event.amount} HP!`;
      return { message, color: BattleLogColors.heal, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.MoveFailed: {
      const name = context.getPokemonName(event.attackerId);
      let message: string;
      if (event.reason === MoveFailedReason.Focus) {
        message = lang === "fr" ? `${name} perd sa concentration !` : `${name} lost its focus!`;
      } else if (event.reason === MoveFailedReason.ShellTrap) {
        message =
          lang === "fr"
            ? `Le piège de ${name} ne s'est pas déclenché !`
            : `${name}'s trap was not triggered!`;
      } else {
        message = lang === "fr" ? `Mais cela échoue (${name}) !` : `But it failed (${name})!`;
      }
      return { message, color: BattleLogColors.miss, pokemonIds: [event.attackerId] };
    }

    case BattleEventType.FocusInterrupted: {
      const name = context.getPokemonName(event.pokemonId);
      const message =
        lang === "fr"
          ? `${name} est frappé pendant sa concentration !`
          : `${name} is hit while focusing!`;
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.BeakBlastBurn: {
      const targetName = context.getPokemonName(event.targetId);
      const message =
        lang === "fr"
          ? `${targetName} se brûle sur le bec brûlant !`
          : `${targetName} was burned by the blazing beak!`;
      return { message, color: BattleLogColors.status, pokemonIds: [event.targetId] };
    }

    case BattleEventType.ShellTrapArmed: {
      const name = context.getPokemonName(event.pokemonId);
      const message = lang === "fr" ? `Le piège de ${name} s'arme !` : `${name}'s trap is set!`;
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.Imprisoned: {
      const name = context.getPokemonName(event.pokemonId);
      const message =
        lang === "fr"
          ? `${name} scelle les capacités communes !`
          : `${name} sealed any shared moves!`;
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.HealPrevented: {
      const name = context.getPokemonName(event.pokemonId);
      const message =
        lang === "fr" ? `Le soin de ${name} est bloqué !` : `${name}'s healing was blocked!`;
      return { message, color: BattleLogColors.miss, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.SpiteApplied: {
      const name = context.getPokemonName(event.pokemonId);
      const message =
        lang === "fr"
          ? `${name} subit le Dépit : son prochain tour est retardé !`
          : `${name} is spited: its next turn is delayed!`;
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.FutureSightPosted: {
      const caster = context.getPokemonName(event.casterId);
      const message =
        lang === "fr"
          ? `${caster} concentre une énergie psychique pour plus tard.`
          : `${caster} foresaw a psychic attack.`;
      return { message, color: BattleLogColors.status, pokemonIds: [event.casterId] };
    }

    case BattleEventType.FutureSightFailed: {
      const name = context.getPokemonName(event.attackerId);
      const message =
        lang === "fr"
          ? `Mais une Prescience vise déjà cette zone (${name}) !`
          : `But a Future Sight already targets that spot (${name})!`;
      return { message, color: BattleLogColors.miss, pokemonIds: [event.attackerId] };
    }

    case BattleEventType.FutureSightStruck: {
      const total = event.hits.reduce((sum, hit) => sum + hit.damage, 0);
      const message =
        lang === "fr"
          ? event.hits.length === 0
            ? "La Prescience s'abat dans le vide."
            : `La Prescience s'abat (${total} dégâts) !`
          : event.hits.length === 0
            ? "Future Sight struck nothing."
            : `Future Sight struck for ${total} damage!`;
      return {
        message,
        color: BattleLogColors.damage,
        pokemonIds: event.hits.map((hit) => hit.pokemonId),
      };
    }

    case BattleEventType.PerishAuraPosted: {
      const name = context.getPokemonName(event.casterId);
      const message =
        lang === "fr"
          ? `${name} entonne le Requiem : une aura mortelle l'entoure (${event.turns} tours) !`
          : `${name} sings the Perish Song: a deadly aura surrounds it (${event.turns} turns)!`;
      return { message, color: BattleLogColors.status, pokemonIds: [event.casterId] };
    }

    case BattleEventType.PerishKo: {
      const name = context.getPokemonName(event.pokemonId);
      const message =
        lang === "fr" ? `${name} succombe au Requiem !` : `${name} succumbs to the Perish Song!`;
      return { message, color: BattleLogColors.ko, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.PainSplitApplied: {
      const caster = context.getPokemonName(event.casterId);
      const target = context.getPokemonName(event.targetId);
      const message =
        lang === "fr"
          ? `${caster} et ${target} se partagent leurs PV (${event.pooledHp} chacun).`
          : `${caster} and ${target} split their HP (${event.pooledHp} each).`;
      return {
        message,
        color: BattleLogColors.heal,
        pokemonIds: [event.casterId, event.targetId],
      };
    }

    case BattleEventType.EndeavorApplied: {
      const target = context.getPokemonName(event.targetId);
      const message =
        lang === "fr"
          ? `${target} voit ses PV ramenés au niveau de l'attaquant (-${event.damage}).`
          : `${target}'s HP was cut down to the attacker's (-${event.damage}).`;
      return { message, color: BattleLogColors.damage, pokemonIds: [event.targetId] };
    }

    case BattleEventType.EndeavorFailed: {
      const name = context.getPokemonName(event.attackerId);
      const message = lang === "fr" ? `Mais cela échoue (${name}) !` : `But it failed (${name})!`;
      return { message, color: BattleLogColors.miss, pokemonIds: [event.attackerId] };
    }

    case BattleEventType.SuperFangApplied: {
      const target = context.getPokemonName(event.targetId);
      const message =
        lang === "fr"
          ? `${target} perd la moitié de ses PV (-${event.damage}) !`
          : `${target} lost half its HP (-${event.damage})!`;
      return { message, color: BattleLogColors.damage, pokemonIds: [event.targetId] };
    }

    case BattleEventType.SmackedDown: {
      const target = context.getPokemonName(event.targetId);
      const message =
        lang === "fr" ? `${target} est cloué au sol !` : `${target} was knocked to the ground!`;
      return { message, color: BattleLogColors.status, pokemonIds: [event.targetId] };
    }

    case BattleEventType.HelpingHandPosted: {
      const caster = context.getPokemonName(event.casterId);
      const target = context.getPokemonName(event.targetId);
      const message =
        lang === "fr" ? `${caster} encourage ${target} !` : `${caster} is ready to help ${target}!`;
      return {
        message,
        color: BattleLogColors.status,
        pokemonIds: [event.casterId, event.targetId],
      };
    }

    case BattleEventType.TypeChanged: {
      const name = context.getPokemonName(event.pokemonId);
      let message: string;
      if (event.reason === TypeChangeReason.BurnUp) {
        message =
          lang === "fr" ? `${name} perd son type Feu !` : `${name} burned out its Fire type!`;
      } else if (event.newTypes.length === 0) {
        message = lang === "fr" ? `${name} n'a plus de type !` : `${name} has no type now!`;
      } else {
        const typeLabel = event.newTypes
          .map((type) => TYPE_LABEL[type]?.[lang] ?? type)
          .join(lang === "fr" ? " / " : "/");
        message =
          lang === "fr"
            ? `${name} devient de type ${typeLabel} !`
            : `${name} became ${typeLabel}-type!`;
      }
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.MoveCopied: {
      const name = context.getPokemonName(event.pokemonId);
      const copiedName = context.getMoveName(event.copiedMoveId);
      const message =
        lang === "fr" ? `${name} apprend ${copiedName} !` : `${name} learned ${copiedName}!`;
      return { message, color: BattleLogColors.move, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.MoveCopyFailed: {
      const name = context.getPokemonName(event.pokemonId);
      const moveName = context.getMoveName(event.moveId);
      const message =
        lang === "fr" ? `${moveName} de ${name} échoue !` : `${name}'s ${moveName} failed!`;
      return { message, color: BattleLogColors.move, pokemonIds: [event.pokemonId] };
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

    case BattleEventType.LockInStarted: {
      const name = context.getPokemonName(event.pokemonId);
      const moveName = context.getMoveName(event.moveId);
      const message =
        lang === "fr"
          ? `${name} se déchaîne avec ${moveName} !`
          : `${name} goes on a rampage with ${moveName}!`;
      return { message, color: BattleLogColors.move, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.CritStageRaised: {
      const name = context.getPokemonName(event.targetId);
      const message =
        lang === "fr"
          ? `${name} est plus enclin aux coups critiques !`
          : `${name} is getting pumped for critical hits!`;
      return { message, color: BattleLogColors.move, pokemonIds: [event.targetId] };
    }

    case BattleEventType.GuaranteedCritArmed: {
      const name = context.getPokemonName(event.pokemonId);
      const message =
        lang === "fr"
          ? `${name} se concentre : son prochain coup sera critique !`
          : `${name} focuses — its next hit will be a critical!`;
      return { message, color: BattleLogColors.move, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.AuraPosted: {
      const name = context.getPokemonName(event.casterId);
      const auraLabel = auraKindLabel(event.kind, lang);
      const message =
        lang === "fr"
          ? `${name} pose ${auraLabel} (${event.durationRounds} tours)`
          : `${name} sets up ${auraLabel} (${event.durationRounds} turns)`;
      return { message, color: BattleLogColors.move, pokemonIds: [event.casterId] };
    }

    case BattleEventType.AuraDissipated: {
      const name = context.getPokemonName(event.casterId);
      const auraLabel = auraKindLabel(event.kind, lang);
      const message =
        lang === "fr"
          ? `L'aura ${auraLabel} de ${name} se dissipe`
          : `${name}'s ${auraLabel} aura faded`;
      return { message, color: BattleLogColors.turn, pokemonIds: [event.casterId] };
    }

    case BattleEventType.AuraBroken: {
      const breakerName = context.getPokemonName(event.breakerId);
      const casterName = context.getPokemonName(event.casterId);
      const auraLabel = auraKindLabel(event.kind, lang);
      const message =
        lang === "fr"
          ? `${breakerName} brise l'aura ${auraLabel} de ${casterName} !`
          : `${breakerName} broke ${casterName}'s ${auraLabel} aura!`;
      return {
        message,
        color: BattleLogColors.damage,
        pokemonIds: [event.breakerId, event.casterId],
      };
    }

    case BattleEventType.StatChangeBlocked: {
      const targetName = context.getPokemonName(event.pokemonId);
      let message: string;
      if (event.reason === ProtectionReason.Substitute) {
        message =
          lang === "fr" ? `Le Clone protège ${targetName} !` : `Substitute shields ${targetName}!`;
      } else if (event.reason === ProtectionReason.HeldItem) {
        message =
          lang === "fr"
            ? `L'objet de ${targetName} le protège !`
            : `${targetName}'s item protects it!`;
      } else {
        message = lang === "fr" ? `Brume protège ${targetName} !` : `Mist protects ${targetName}!`;
      }
      return { message, color: BattleLogColors.move, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.StatusBlocked: {
      const targetName = context.getPokemonName(event.pokemonId);
      let message: string;
      if (event.reason === ProtectionReason.Substitute) {
        message =
          lang === "fr" ? `Le Clone protège ${targetName} !` : `Substitute shields ${targetName}!`;
      } else if (event.reason === ProtectionReason.MistyTerrain) {
        message =
          lang === "fr"
            ? `Le Champ Brumeux protège ${targetName} !`
            : `Misty Terrain protects ${targetName}!`;
      } else if (event.reason === ProtectionReason.ElectricTerrain) {
        message =
          lang === "fr"
            ? `Le Champ Électrifié garde ${targetName} éveillé !`
            : `Electric Terrain keeps ${targetName} awake!`;
      } else if (event.reason === ProtectionReason.UproarNoise) {
        message =
          lang === "fr"
            ? `Le Brouhaha garde ${targetName} éveillé !`
            : `The uproar keeps ${targetName} awake!`;
      } else {
        message =
          lang === "fr"
            ? `Rune Protect protège ${targetName} !`
            : `Safeguard protects ${targetName}!`;
      }
      return { message, color: BattleLogColors.move, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.FieldTerrainPosted: {
      const name = context.getPokemonName(event.casterId);
      const label = fieldTerrainLabel(event.kind, lang);
      const message =
        lang === "fr"
          ? `${name} déploie le ${label} (${event.durationTurns} tours)`
          : `${name} sets up ${label} (${event.durationTurns} turns)`;
      return { message, color: BattleLogColors.move, pokemonIds: [event.casterId] };
    }

    case BattleEventType.FieldTerrainExpired: {
      const label = fieldTerrainLabel(event.kind, lang);
      const message = lang === "fr" ? `Le ${label} se dissipe` : `The ${label} faded`;
      return { message, color: BattleLogColors.turn, pokemonIds: [] };
    }

    case BattleEventType.DashBlockedByPsychicTerrain: {
      const name = context.getPokemonName(event.pokemonId);
      const message =
        lang === "fr"
          ? `${name} est repoussé par le Champ Psychique !`
          : `${name} is repelled by Psychic Terrain!`;
      return { message, color: BattleLogColors.move, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.DistortionPosted: {
      const name = context.getPokemonName(event.casterId);
      const message =
        lang === "fr"
          ? `${name} déforme l'espace — Distorsion ! (${event.durationTurns} tours)`
          : `${name} twisted the dimensions — Trick Room! (${event.durationTurns} turns)`;
      return { message, color: BattleLogColors.move, pokemonIds: [event.casterId] };
    }

    case BattleEventType.DistortionExpired: {
      const message =
        lang === "fr" ? "La Distorsion se dissipe" : "The twisted dimensions returned to normal";
      return { message, color: BattleLogColors.turn, pokemonIds: [] };
    }

    case BattleEventType.FieldGlobalPosted: {
      const name = context.getPokemonName(event.casterId);
      const label = fieldGlobalLabel(event.kind, lang);
      const message =
        lang === "fr"
          ? `${name} déploie ${label} (${event.durationTurns} tours)`
          : `${name} sets up ${label} (${event.durationTurns} turns)`;
      return { message, color: BattleLogColors.move, pokemonIds: [event.casterId] };
    }

    case BattleEventType.FieldGlobalExpired: {
      const label = fieldGlobalLabel(event.kind, lang);
      const message = lang === "fr" ? `${label} se dissipe` : `${label} faded`;
      return { message, color: BattleLogColors.turn, pokemonIds: [] };
    }

    case BattleEventType.TailwindSet: {
      const name = context.getPokemonName(event.casterId);
      const direction = directionLabel(event.direction, lang);
      const message =
        lang === "fr"
          ? `${name} lève le Vent Arrière vers le ${direction} (${event.turns} tours)`
          : `${name} whips up a Tailwind to the ${direction} (${event.turns} turns)`;
      return { message, color: BattleLogColors.move, pokemonIds: [event.casterId] };
    }

    case BattleEventType.TailwindEnded: {
      const message = lang === "fr" ? "Le Vent Arrière retombe" : "The Tailwind petered out";
      return { message, color: BattleLogColors.turn, pokemonIds: [] };
    }

    case BattleEventType.GravityMoveBlocked: {
      const name = context.getPokemonName(event.pokemonId);
      const move = context.getMoveName(event.moveId);
      const message =
        lang === "fr"
          ? `${name} ne peut pas utiliser ${move} sous la Gravité !`
          : `${name} can't use ${move} under Gravity!`;
      return { message, color: BattleLogColors.move, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.EntryHazardPosted: {
      const label = entryHazardLabel(event.kind, lang);
      const layerSuffix = event.layers > 1 ? ` ×${event.layers}` : "";
      const message =
        lang === "fr"
          ? `Des ${label}${layerSuffix} sont posés au sol`
          : `${label}${layerSuffix} were set on the ground`;
      return { message, color: BattleLogColors.move, pokemonIds: [] };
    }

    case BattleEventType.EntryHazardTriggered: {
      const name = context.getPokemonName(event.pokemonId);
      const label = entryHazardLabel(event.kind, lang);
      if (event.damage !== undefined) {
        const message =
          lang === "fr"
            ? `${name} est blessé par les ${label} (${event.damage})`
            : `${name} is hurt by ${label} (${event.damage})`;
        return { message, color: BattleLogColors.damage, pokemonIds: [event.pokemonId] };
      }
      if (event.status !== undefined) {
        const badly = event.status === StatusType.BadlyPoisoned;
        const message =
          lang === "fr"
            ? `${name} est ${badly ? "gravement empoisonné" : "empoisonné"} par les ${label}`
            : `${name} is ${badly ? "badly poisoned" : "poisoned"} by ${label}`;
        return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
      }
      const message =
        lang === "fr"
          ? `${name} est ralenti par la ${label} (Vitesse -1)`
          : `${name} is slowed by ${label} (Speed -1)`;
      return { message, color: BattleLogColors.statDown, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.EntryHazardAbsorbed: {
      const name = context.getPokemonName(event.pokemonId);
      const message =
        lang === "fr" ? `${name} absorbe les Pics Toxik` : `${name} absorbed the Toxic Spikes`;
      return { message, color: BattleLogColors.move, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.EntryHazardRemoved: {
      const message =
        lang === "fr" ? "Les pièges au sol sont balayés" : "The hazards were cleared away";
      return { message, color: BattleLogColors.turn, pokemonIds: [] };
    }

    case BattleEventType.SubstitutePosted: {
      const name = context.getPokemonName(event.pokemonId);
      const message = lang === "fr" ? `${name} crée un Clone !` : `${name} created a Substitute!`;
      return { message, color: BattleLogColors.move, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.SubstituteDamaged: {
      const name = context.getPokemonName(event.pokemonId);
      const message =
        lang === "fr"
          ? `Le Clone de ${name} encaisse ${event.damage} !`
          : `${name}'s Substitute took ${event.damage} damage!`;
      return { message, color: BattleLogColors.damage, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.SubstituteBroken: {
      const name = context.getPokemonName(event.pokemonId);
      const breakerName = context.getPokemonName(event.breakerId);
      const message =
        lang === "fr"
          ? `${breakerName} brise le Clone de ${name} !`
          : `${breakerName} broke ${name}'s Substitute!`;
      return {
        message,
        color: BattleLogColors.damage,
        pokemonIds: [event.pokemonId, event.breakerId],
      };
    }

    case BattleEventType.SubstituteFailed: {
      const name = context.getPokemonName(event.pokemonId);
      const message =
        event.reason === SubstituteFailedReason.AlreadyActive
          ? lang === "fr"
            ? `${name} a déjà un Clone !`
            : `${name} already has a Substitute!`
          : lang === "fr"
            ? `${name} n'a pas assez de PV !`
            : `${name} doesn't have enough HP!`;
      return { message, color: BattleLogColors.turn, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.TauntBlocked: {
      const name = context.getPokemonName(event.pokemonId);
      const moveName = context.getMoveName(event.moveId);
      const message =
        lang === "fr"
          ? `${name} ne peut pas utiliser ${moveName} à cause de Provoc !`
          : `${name} can't use ${moveName} after the taunt!`;
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.MoveDisabled: {
      const name = context.getPokemonName(event.pokemonId);
      const moveName = context.getMoveName(event.moveId);
      const message =
        lang === "fr"
          ? `${moveName} de ${name} est sous Entrave !`
          : `${name}'s ${moveName} was disabled!`;
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.MoveEncored: {
      const name = context.getPokemonName(event.pokemonId);
      const moveName = context.getMoveName(event.moveId);
      const message =
        lang === "fr" ? `${name} doit répéter ${moveName} !` : `${name} must repeat ${moveName}!`;
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.DisableBlocked:
    case BattleEventType.EncoreBlocked: {
      const name = context.getPokemonName(event.pokemonId);
      const moveName = context.getMoveName(event.moveId);
      const message =
        lang === "fr"
          ? `${name} ne peut pas utiliser ${moveName} !`
          : `${name} can't use ${moveName}!`;
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.DisableFailed:
    case BattleEventType.EncoreFailed:
    case BattleEventType.ImprisonFailed:
    case BattleEventType.SpiteFailed: {
      const message = lang === "fr" ? "Mais ça échoue !" : "But it failed!";
      return { message, color: BattleLogColors.turn, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.Teleported: {
      const name = context.getPokemonName(event.pokemonId);
      const message = lang === "fr" ? `${name} se téléporte !` : `${name} teleports!`;
      return { message, color: BattleLogColors.move, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.HitAndRunRetreat: {
      const name = context.getPokemonName(event.pokemonId);
      const message = lang === "fr" ? `${name} recule.` : `${name} falls back.`;
      return { message, color: BattleLogColors.move, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.HitAndRunRetreatFallback: {
      if (event.reason === HitAndRunRetreatFallbackReason.Miss) {
        return null;
      }
      const name = context.getPokemonName(event.pokemonId);
      const message = lang === "fr" ? `${name} ne peut pas reculer.` : `${name} can't fall back.`;
      return { message, color: BattleLogColors.move, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.BatonPassed: {
      const casterName = context.getPokemonName(event.casterId);
      const targetName = context.getPokemonName(event.targetId);
      const message =
        lang === "fr"
          ? `${casterName} passe le relais à ${targetName} !`
          : `${casterName} passed the baton to ${targetName}!`;
      return {
        message,
        color: BattleLogColors.move,
        pokemonIds: [event.casterId, event.targetId],
      };
    }

    case BattleEventType.StatStagesReset: {
      const message =
        lang === "fr"
          ? "Les changements de stats de tous les Pokémon sont annulés !"
          : "All stat changes were eliminated!";
      return { message, color: BattleLogColors.status, pokemonIds: event.pokemonIds };
    }

    case BattleEventType.StatStagesCopied: {
      const casterName = context.getPokemonName(event.casterId);
      const targetName = context.getPokemonName(event.targetId);
      const message =
        lang === "fr"
          ? `${casterName} copie les changements de stats de ${targetName} !`
          : `${casterName} copied ${targetName}'s stat changes!`;
      return {
        message,
        color: BattleLogColors.status,
        pokemonIds: [event.casterId, event.targetId],
      };
    }

    case BattleEventType.StatStagesInverted: {
      const name = context.getPokemonName(event.targetId);
      const message =
        lang === "fr"
          ? `Les changements de stats de ${name} sont inversés !`
          : `${name}'s stat changes were inverted!`;
      return { message, color: BattleLogColors.status, pokemonIds: [event.targetId] };
    }

    case BattleEventType.StatStagesSwapped: {
      const casterName = context.getPokemonName(event.casterId);
      const targetName = context.getPokemonName(event.targetId);
      const statLabels = event.stats
        .map((stat) => STAT_NAME_KEY[stat]?.[lang] ?? stat)
        .join(lang === "fr" ? " et " : " and ");
      const message =
        lang === "fr"
          ? `${casterName} et ${targetName} échangent leur ${statLabels} !`
          : `${casterName} and ${targetName} swapped their ${statLabels}!`;
      return {
        message,
        color: BattleLogColors.status,
        pokemonIds: [event.casterId, event.targetId],
      };
    }

    case BattleEventType.SpeedSwapped: {
      const casterName = context.getPokemonName(event.casterId);
      const targetName = context.getPokemonName(event.targetId);
      const message =
        lang === "fr"
          ? `${casterName} et ${targetName} échangent leur Vitesse !`
          : `${casterName} and ${targetName} swapped their Speed!`;
      return {
        message,
        color: BattleLogColors.status,
        pokemonIds: [event.casterId, event.targetId],
      };
    }

    case BattleEventType.FinalGambitApplied: {
      const name = context.getPokemonName(event.attackerId);
      const message =
        lang === "fr" ? `${name} joue le tout pour le tout !` : `${name} risked it all!`;
      return { message, color: BattleLogColors.damage, pokemonIds: [event.attackerId] };
    }

    case BattleEventType.PokemonRevived: {
      const name = context.getPokemonName(event.pokemonId);
      const message = event.revived
        ? lang === "fr"
          ? `${name} revient au combat !`
          : `${name} was brought back!`
        : lang === "fr"
          ? `${name} est régénéré !`
          : `${name} was fully restored!`;
      return { message, color: BattleLogColors.heal, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.ReviveOrHealFailed: {
      const name = context.getPokemonName(event.casterId);
      const message =
        lang === "fr"
          ? `Le vœu de ${name} est resté sans écho...`
          : `${name}'s wish went unanswered...`;
      return { message, color: BattleLogColors.miss, pokemonIds: [event.casterId] };
    }

    case BattleEventType.DestinyBondPosted: {
      const name = context.getPokemonName(event.casterId);
      const message =
        lang === "fr"
          ? `${name} tisse un lien du destin...`
          : `${name} is trying to take its foe down with it!`;
      return { message, color: BattleLogColors.status, pokemonIds: [event.casterId] };
    }

    case BattleEventType.DestinyBondTriggered: {
      const victim = context.getPokemonName(event.victimId);
      const message =
        lang === "fr"
          ? `${victim} est entraîné dans la chute !`
          : `${victim} was dragged down too!`;
      return { message, color: BattleLogColors.ko, pokemonIds: [event.casterId, event.victimId] };
    }

    case BattleEventType.GrudgePosted: {
      const name = context.getPokemonName(event.casterId);
      const message =
        lang === "fr"
          ? `${name} nourrit une rancune...`
          : `${name} wants its foe to bear a grudge!`;
      return { message, color: BattleLogColors.status, pokemonIds: [event.casterId] };
    }

    case BattleEventType.GrudgeTriggered: {
      const attacker = context.getPokemonName(event.attackerId);
      const moveName = context.getMoveName(event.moveId);
      const message =
        lang === "fr"
          ? `La rancune scelle ${moveName} de ${attacker} !`
          : `${attacker}'s ${moveName} was sealed by the grudge!`;
      return { message, color: BattleLogColors.status, pokemonIds: [event.attackerId] };
    }

    case BattleEventType.OneHitKo: {
      const message = lang === "fr" ? "C'est un K.O. direct !" : "It's a one-hit KO!";
      return { message, color: BattleLogColors.ko, pokemonIds: [event.targetId] };
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
