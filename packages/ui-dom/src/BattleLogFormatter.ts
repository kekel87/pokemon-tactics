import type {
  AuraKind,
  BattleEvent,
  EntryHazardKind,
  FieldTerrain,
  PokemonType,
} from "@pokemon-tactic/core";
import {
  BattleEventType,
  DefensiveKind,
  HitAndRunRetreatFallbackReason,
  ProtectionReason,
  StatName,
  StatusImmuneReason,
  StatusType,
  SubstituteFailedReason,
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
      const message = lang === "fr" ? `${name} a bronché !` : `${name} flinched!`;
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
      const message = lang === "fr" ? `Mais cela échoue (${name}) !` : `But it failed (${name})!`;
      return { message, color: BattleLogColors.miss, pokemonIds: [event.attackerId] };
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
