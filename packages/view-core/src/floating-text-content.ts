import {
  type AuraKind,
  type BattleEvent,
  BattleEventType,
  type FieldTerrain,
  type ProtectionReason,
  type StatName,
  StatusImmuneReason,
  SubstituteFailedReason,
  TerrainType,
} from "@pokemon-tactic/core";
import { getMoveName } from "@pokemon-tactic/data";
import {
  BATTLE_TEXT_COLOR_ABILITY,
  BATTLE_TEXT_COLOR_BUFF,
  BATTLE_TEXT_COLOR_CONFUSED,
  BATTLE_TEXT_COLOR_CRITICAL,
  BATTLE_TEXT_COLOR_DAMAGE,
  BATTLE_TEXT_COLOR_DEBUFF,
  BATTLE_TEXT_COLOR_EXTREMELY_EFFECTIVE,
  BATTLE_TEXT_COLOR_FALL_DAMAGE,
  BATTLE_TEXT_COLOR_FLINCH,
  BATTLE_TEXT_COLOR_HEAL,
  BATTLE_TEXT_COLOR_IMMUNE,
  BATTLE_TEXT_COLOR_INFO,
  BATTLE_TEXT_COLOR_ITEM,
  BATTLE_TEXT_COLOR_ITEM_CONSUMED,
  BATTLE_TEXT_COLOR_KO,
  BATTLE_TEXT_COLOR_MISS,
  BATTLE_TEXT_COLOR_MOSTLY_INEFFECTIVE,
  BATTLE_TEXT_COLOR_NOT_VERY_EFFECTIVE,
  BATTLE_TEXT_COLOR_SUPER_EFFECTIVE,
  BATTLE_TEXT_COLOR_TAUNT,
} from "./constants.js";

/** Moves whose charge turn shows a flavour label instead of the bare move name. */
const CHARGING_FLOAT_LABEL_KEYS: Record<string, string> = {
  "solar-beam": "move.charging.solar-beam",
};

/**
 * Core event → combat floating text (plan 122 step 4c-1) — the short, drifting
 * labels that rise off a Pokémon (damage numbers, "Miss!", "Critical!", status…).
 * Pure mapper; the projection lives in `combat-scene.spawnFloatingText`.
 */

/** One floating label. `secondary` shares the primary's beat with a small upward offset. */
export interface FloatingTextSpec {
  /** Pokémon the text floats over (its tile is projected at spawn). */
  readonly pokemonId: string;
  readonly text: string;
  /** CSS colour string (BATTLE_TEXT_COLOR_* constant). */
  readonly color: string;
  /** Shares the preceding primary's beat with a small upward offset — always emitted AFTER a primary. */
  readonly secondary?: boolean;
}

/** Name resolvers for floats that interpolate a name (ability/item/Pokémon). */
export interface FloatingTextContext {
  getPokemonName: (pokemonId: string) => string;
  getAbilityName: (abilityId: string) => string | null;
  getItemName: (itemId: string) => string | null;
  /** Current HP of a Pokémon (to show "K.O.!" instead of a number on a lethal recoil hit). */
  getCurrentHp: (pokemonId: string) => number;
  /** Localise a message key (host-injected via `PresentationContext`, plan 125 décision #4). */
  translate: (key: string, params?: Record<string, string | number>) => string;
  /** Current UI language code (for `getMoveName` lookups). */
  getLanguage: () => string;
}

const STAT_SHORT_KEY: Partial<Record<StatName, string>> = {
  attack: "atk",
  defense: "def",
  spAttack: "spA",
  spDefense: "spD",
  speed: "spd",
  accuracy: "acc",
  evasion: "eva",
};

const AURA_POSTED_KEY: Record<AuraKind, string> = {
  reflect: "aura.posted.reflect",
  "light-screen": "aura.posted.lightScreen",
  mist: "aura.posted.mist",
  safeguard: "aura.posted.safeguard",
};

const AURA_BLOCKED_KEY: Record<ProtectionReason, string> = {
  mist: "aura.blocked.mist",
  safeguard: "aura.blocked.safeguard",
  substitute: "substitute.blocked",
  misty_terrain: "fieldTerrain.blocked.misty",
  electric_terrain: "fieldTerrain.blocked.electric",
};

const FIELD_TERRAIN_POSTED_KEY: Record<FieldTerrain, string> = {
  grassy: "fieldTerrain.posted.grassy",
  electric: "fieldTerrain.posted.electric",
  misty: "fieldTerrain.posted.misty",
  psychic: "fieldTerrain.posted.psychic",
};

function statText(stat: StatName, stages: number, context: FloatingTextContext): string {
  const statKey = `stat.${STAT_SHORT_KEY[stat] ?? stat}`;
  const statLabel = context.translate(statKey);
  return stages > 0
    ? context.translate("battle.statUp", { stat: statLabel, stages: String(stages) })
    : context.translate("battle.statDown", { stat: statLabel, stages: String(stages) });
}

/** The floating texts a single battle event produces (empty if it shows none). */
export function floatingTextsFor(
  event: BattleEvent,
  context: FloatingTextContext,
): FloatingTextSpec[] {
  switch (event.type) {
    case BattleEventType.DamageDealt: {
      if (event.absorbedBySubstitute !== undefined && event.absorbedBySubstitute > 0) {
        return [];
      }
      if (event.amount < 0) {
        return [
          {
            pokemonId: event.targetId,
            text: `+${Math.abs(event.amount)}`,
            color: BATTLE_TEXT_COLOR_HEAL,
          },
        ];
      }
      if (event.effectiveness === 0) {
        return [
          {
            pokemonId: event.targetId,
            text: context.translate("battle.immune"),
            color: BATTLE_TEXT_COLOR_IMMUNE,
          },
        ];
      }
      if (event.recoil === true && context.getCurrentHp(event.targetId) === 0) {
        // A lethal recoil hit (e.g. Bélier killing its user) shows "K.O.!" instead
        // of the damage number.
        return [
          {
            pokemonId: event.targetId,
            text: context.translate("battle.ko"),
            color: BATTLE_TEXT_COLOR_KO,
          },
        ];
      }
      const texts: FloatingTextSpec[] = [
        { pokemonId: event.targetId, text: `-${event.amount}`, color: BATTLE_TEXT_COLOR_DAMAGE },
      ];
      const effectiveness = effectivenessText(event.effectiveness, context);
      if (effectiveness) {
        texts.push({ pokemonId: event.targetId, ...effectiveness, secondary: true });
      }
      return texts;
    }

    case BattleEventType.WeatherDamage:
      return [
        { pokemonId: event.pokemonId, text: `-${event.amount}`, color: BATTLE_TEXT_COLOR_DAMAGE },
      ];

    case BattleEventType.HpRestored:
    case BattleEventType.WishHealed:
      return [
        { pokemonId: event.pokemonId, text: `+${event.amount}`, color: BATTLE_TEXT_COLOR_HEAL },
      ];

    case BattleEventType.FallDamageDealt:
      return [
        {
          pokemonId: event.pokemonId,
          text: `${context.translate("battle.fall")} -${event.amount}`,
          color: BATTLE_TEXT_COLOR_FALL_DAMAGE,
        },
      ];

    case BattleEventType.WallImpactDealt:
      return [
        {
          pokemonId: event.pokemonId,
          text: `${context.translate("battle.impact")} -${event.amount}`,
          color: BATTLE_TEXT_COLOR_FALL_DAMAGE,
        },
      ];

    case BattleEventType.TerrainDamageDealt:
      return [
        {
          pokemonId: event.pokemonId,
          text: `${context.translate("battle.terrainDamage")} -${event.amount}`,
          color: BATTLE_TEXT_COLOR_FALL_DAMAGE,
        },
      ];

    case BattleEventType.MoveCharging: {
      const labelKey = CHARGING_FLOAT_LABEL_KEYS[event.moveId];
      return [
        {
          pokemonId: event.pokemonId,
          text: labelKey
            ? context.translate(labelKey)
            : getMoveName(event.moveId, context.getLanguage()),
          color: BATTLE_TEXT_COLOR_INFO,
        },
      ];
    }

    case BattleEventType.LethalTerrainKo:
      return [
        {
          pokemonId: event.pokemonId,
          text:
            event.terrain === TerrainType.Lava
              ? context.translate("battle.melted")
              : context.translate("battle.drowned"),
          color: BATTLE_TEXT_COLOR_FALL_DAMAGE,
        },
      ];

    case BattleEventType.SubstituteDamaged:
      return [
        { pokemonId: event.pokemonId, text: `-${event.damage}`, color: BATTLE_TEXT_COLOR_DAMAGE },
      ];

    case BattleEventType.MoveMissed:
      return [
        {
          pokemonId: event.targetId,
          text: context.translate("battle.miss"),
          color: BATTLE_TEXT_COLOR_MISS,
        },
      ];

    case BattleEventType.StatusImmune:
      return [
        {
          pokemonId: event.targetId,
          text:
            event.reason === StatusImmuneReason.Weather
              ? context.translate("weather.float.freezePrevented")
              : context.translate("battle.noEffect"),
          color: BATTLE_TEXT_COLOR_IMMUNE,
        },
      ];

    case BattleEventType.StatChanged:
      return [
        {
          pokemonId: event.targetId,
          text: statText(event.stat, event.stages, context),
          color: event.stages > 0 ? BATTLE_TEXT_COLOR_BUFF : BATTLE_TEXT_COLOR_DEBUFF,
        },
      ];

    case BattleEventType.ConfusionTriggered:
      return [
        {
          pokemonId: event.pokemonId,
          text: context.translate("battle.confused"),
          color: BATTLE_TEXT_COLOR_CONFUSED,
        },
      ];

    case BattleEventType.Flinched:
      return [
        {
          pokemonId: event.pokemonId,
          text: context.translate("status.flinched"),
          color: BATTLE_TEXT_COLOR_FLINCH,
        },
      ];

    case BattleEventType.InfatuationTriggered:
      return [
        {
          pokemonId: event.pokemonId,
          text: context.translate("battle.infatuated"),
          color: BATTLE_TEXT_COLOR_CONFUSED,
        },
      ];

    case BattleEventType.DefenseTriggered:
      return event.blocked
        ? [
            {
              pokemonId: event.defenderId,
              text: context.translate("battle.blocked"),
              color: BATTLE_TEXT_COLOR_BUFF,
            },
          ]
        : [];

    case BattleEventType.MultiHitComplete:
      return [
        {
          pokemonId: event.targetId,
          text: context.translate("battle.hits", { count: String(event.totalHits) }),
          color: BATTLE_TEXT_COLOR_INFO,
        },
      ];

    case BattleEventType.RechargeStarted:
      return [
        {
          pokemonId: event.pokemonId,
          text: context.translate("battle.recharge"),
          color: BATTLE_TEXT_COLOR_INFO,
        },
      ];

    case BattleEventType.CriticalHit:
      return [
        {
          pokemonId: event.targetId,
          text: context.translate("battle.critical"),
          color: BATTLE_TEXT_COLOR_CRITICAL,
        },
      ];

    case BattleEventType.AbilityActivated: {
      const name = context.getAbilityName(event.abilityId);
      return name
        ? [{ pokemonId: event.pokemonId, text: `${name}!`, color: BATTLE_TEXT_COLOR_ABILITY }]
        : [];
    }

    case BattleEventType.HeldItemActivated: {
      const name = context.getItemName(event.itemId);
      return name
        ? [{ pokemonId: event.pokemonId, text: `${name}!`, color: BATTLE_TEXT_COLOR_ITEM }]
        : [];
    }

    case BattleEventType.HeldItemConsumed: {
      const name = context.getItemName(event.itemId);
      return name
        ? [
            {
              pokemonId: event.pokemonId,
              text: context.translate("battle.itemConsumed", { name }),
              color: BATTLE_TEXT_COLOR_ITEM_CONSUMED,
            },
          ]
        : [];
    }

    case BattleEventType.AuraPosted:
      return [
        {
          pokemonId: event.casterId,
          text: context.translate(AURA_POSTED_KEY[event.kind]),
          color: BATTLE_TEXT_COLOR_INFO,
        },
      ];

    case BattleEventType.AuraBroken:
      return [
        {
          pokemonId: event.casterId,
          text: context.translate("aura.broken"),
          color: BATTLE_TEXT_COLOR_DEBUFF,
        },
      ];

    case BattleEventType.FieldTerrainPosted:
      return [
        {
          pokemonId: event.casterId,
          text: context.translate(FIELD_TERRAIN_POSTED_KEY[event.kind]),
          color: BATTLE_TEXT_COLOR_INFO,
        },
      ];

    case BattleEventType.DistortionPosted:
      return [
        {
          pokemonId: event.casterId,
          text: context.translate("distortion.posted"),
          color: BATTLE_TEXT_COLOR_INFO,
        },
      ];

    case BattleEventType.DashBlockedByPsychicTerrain:
      return [
        {
          pokemonId: event.pokemonId,
          text: context.translate("fieldTerrain.dashBlocked"),
          color: BATTLE_TEXT_COLOR_INFO,
        },
      ];

    case BattleEventType.StatChangeBlocked:
    case BattleEventType.StatusBlocked:
      return [
        {
          pokemonId: event.pokemonId,
          text: context.translate(AURA_BLOCKED_KEY[event.reason], {
            name: context.getPokemonName(event.pokemonId),
          }),
          color: BATTLE_TEXT_COLOR_INFO,
        },
      ];

    case BattleEventType.SubstitutePosted:
      return [
        {
          pokemonId: event.pokemonId,
          text: context.translate("substitute.posted", {
            name: context.getPokemonName(event.pokemonId),
          }),
          color: BATTLE_TEXT_COLOR_INFO,
        },
      ];

    case BattleEventType.SubstituteBroken:
      return [
        {
          pokemonId: event.pokemonId,
          text: context.translate("substitute.broken", {
            name: context.getPokemonName(event.pokemonId),
          }),
          color: BATTLE_TEXT_COLOR_DEBUFF,
        },
      ];

    case BattleEventType.TauntBlocked:
      return [
        {
          pokemonId: event.pokemonId,
          text: context.translate("status.taunted"),
          color: BATTLE_TEXT_COLOR_TAUNT,
        },
      ];

    case BattleEventType.MoveDisabled:
      return [
        {
          pokemonId: event.pokemonId,
          text: context.translate("status.disabled"),
          color: BATTLE_TEXT_COLOR_TAUNT,
        },
      ];

    case BattleEventType.MoveEncored:
      return [
        {
          pokemonId: event.pokemonId,
          text: context.translate("status.encored"),
          color: BATTLE_TEXT_COLOR_TAUNT,
        },
      ];

    case BattleEventType.SubstituteFailed:
      return [
        {
          pokemonId: event.pokemonId,
          text:
            event.reason === SubstituteFailedReason.AlreadyActive
              ? context.translate("substitute.failed.active", {
                  name: context.getPokemonName(event.pokemonId),
                })
              : context.translate("substitute.failed.lowHp", {
                  name: context.getPokemonName(event.pokemonId),
                }),
          color: BATTLE_TEXT_COLOR_INFO,
        },
      ];

    case BattleEventType.DisableBlocked:
      return [
        {
          pokemonId: event.pokemonId,
          text: context.translate("status.disabled"),
          color: BATTLE_TEXT_COLOR_TAUNT,
        },
      ];

    case BattleEventType.EncoreBlocked:
      return [
        {
          pokemonId: event.pokemonId,
          text: context.translate("status.encored"),
          color: BATTLE_TEXT_COLOR_TAUNT,
        },
      ];

    case BattleEventType.DisableFailed:
    case BattleEventType.EncoreFailed:
      return [
        {
          pokemonId: event.pokemonId,
          text: context.translate("battle.noEffect"),
          color: BATTLE_TEXT_COLOR_IMMUNE,
        },
      ];

    default:
      return [];
  }
}

function effectivenessText(
  effectiveness: number,
  context: FloatingTextContext,
): { text: string; color: string } | null {
  if (effectiveness >= 4) {
    return {
      text: context.translate("battle.extremelyEffective"),
      color: BATTLE_TEXT_COLOR_EXTREMELY_EFFECTIVE,
    };
  }
  if (effectiveness >= 2) {
    return {
      text: context.translate("battle.superEffective"),
      color: BATTLE_TEXT_COLOR_SUPER_EFFECTIVE,
    };
  }
  if (effectiveness <= 0.25) {
    return {
      text: context.translate("battle.mostlyIneffective"),
      color: BATTLE_TEXT_COLOR_MOSTLY_INEFFECTIVE,
    };
  }
  if (effectiveness <= 0.5) {
    return {
      text: context.translate("battle.notVeryEffective"),
      color: BATTLE_TEXT_COLOR_NOT_VERY_EFFECTIVE,
    };
  }
  return null;
}
