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
} from "../constants.js";
import { getLanguage, t } from "../i18n/index.js";
import type { TranslationKey } from "../i18n/types.js";

/** Moves whose charge turn shows a flavour label instead of the bare move name. */
const CHARGING_FLOAT_LABEL_KEYS: Record<string, TranslationKey> = {
  "solar-beam": "move.charging.solar-beam",
};

/**
 * Core event → combat floating text (plan 122 step 4c-1) — the short, drifting
 * labels that rise off a Pokémon (damage numbers, "Miss!", "Critical!", status…).
 * Pure mapper, ported from the Phaser `GameController` `showBattleText` calls; the
 * DOM/projection lives in `combat-scene.spawnFloatingText`. Mirrors the colours
 * and i18n of the 2D renderer so the two stay at parity.
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

const AURA_POSTED_KEY: Record<AuraKind, TranslationKey> = {
  reflect: "aura.posted.reflect",
  "light-screen": "aura.posted.lightScreen",
  mist: "aura.posted.mist",
  safeguard: "aura.posted.safeguard",
};

const AURA_BLOCKED_KEY: Record<ProtectionReason, TranslationKey> = {
  mist: "aura.blocked.mist",
  safeguard: "aura.blocked.safeguard",
  substitute: "substitute.blocked",
  misty_terrain: "fieldTerrain.blocked.misty",
  electric_terrain: "fieldTerrain.blocked.electric",
};

const FIELD_TERRAIN_POSTED_KEY: Record<FieldTerrain, TranslationKey> = {
  grassy: "fieldTerrain.posted.grassy",
  electric: "fieldTerrain.posted.electric",
  misty: "fieldTerrain.posted.misty",
  psychic: "fieldTerrain.posted.psychic",
};

function statText(stat: StatName, stages: number): string {
  const statKey = `stat.${STAT_SHORT_KEY[stat] ?? stat}` as TranslationKey;
  const statLabel = t(statKey);
  return stages > 0
    ? t("battle.statUp", { stat: statLabel, stages: String(stages) })
    : t("battle.statDown", { stat: statLabel, stages: String(stages) });
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
          { pokemonId: event.targetId, text: t("battle.immune"), color: BATTLE_TEXT_COLOR_IMMUNE },
        ];
      }
      if (event.recoil === true && context.getCurrentHp(event.targetId) === 0) {
        // A lethal recoil hit (e.g. Bélier killing its user) shows "K.O.!" instead
        // of the damage number (parity with Phaser GameController DamageDealt).
        return [{ pokemonId: event.targetId, text: t("battle.ko"), color: BATTLE_TEXT_COLOR_KO }];
      }
      const texts: FloatingTextSpec[] = [
        { pokemonId: event.targetId, text: `-${event.amount}`, color: BATTLE_TEXT_COLOR_DAMAGE },
      ];
      const effectiveness = effectivenessText(event.effectiveness);
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
          text: `${t("battle.fall")} -${event.amount}`,
          color: BATTLE_TEXT_COLOR_FALL_DAMAGE,
        },
      ];

    case BattleEventType.WallImpactDealt:
      return [
        {
          pokemonId: event.pokemonId,
          text: `${t("battle.impact")} -${event.amount}`,
          color: BATTLE_TEXT_COLOR_FALL_DAMAGE,
        },
      ];

    case BattleEventType.TerrainDamageDealt:
      return [
        {
          pokemonId: event.pokemonId,
          text: `${t("battle.terrainDamage")} -${event.amount}`,
          color: BATTLE_TEXT_COLOR_FALL_DAMAGE,
        },
      ];

    case BattleEventType.MoveCharging: {
      const labelKey = CHARGING_FLOAT_LABEL_KEYS[event.moveId];
      return [
        {
          pokemonId: event.pokemonId,
          text: labelKey ? t(labelKey) : getMoveName(event.moveId, getLanguage()),
          color: BATTLE_TEXT_COLOR_INFO,
        },
      ];
    }

    case BattleEventType.LethalTerrainKo:
      return [
        {
          pokemonId: event.pokemonId,
          text: event.terrain === TerrainType.Lava ? t("battle.melted") : t("battle.drowned"),
          color: BATTLE_TEXT_COLOR_FALL_DAMAGE,
        },
      ];

    case BattleEventType.SubstituteDamaged:
      return [
        { pokemonId: event.pokemonId, text: `-${event.damage}`, color: BATTLE_TEXT_COLOR_DAMAGE },
      ];

    case BattleEventType.MoveMissed:
      return [{ pokemonId: event.targetId, text: t("battle.miss"), color: BATTLE_TEXT_COLOR_MISS }];

    case BattleEventType.StatusImmune:
      return [
        {
          pokemonId: event.targetId,
          text:
            event.reason === StatusImmuneReason.Weather
              ? t("weather.float.freezePrevented")
              : t("battle.noEffect"),
          color: BATTLE_TEXT_COLOR_IMMUNE,
        },
      ];

    case BattleEventType.StatChanged:
      return [
        {
          pokemonId: event.targetId,
          text: statText(event.stat, event.stages),
          color: event.stages > 0 ? BATTLE_TEXT_COLOR_BUFF : BATTLE_TEXT_COLOR_DEBUFF,
        },
      ];

    case BattleEventType.ConfusionTriggered:
      return [
        {
          pokemonId: event.pokemonId,
          text: t("battle.confused"),
          color: BATTLE_TEXT_COLOR_CONFUSED,
        },
      ];

    case BattleEventType.Flinched:
      return [
        { pokemonId: event.pokemonId, text: t("status.flinched"), color: BATTLE_TEXT_COLOR_FLINCH },
      ];

    case BattleEventType.InfatuationTriggered:
      return [
        {
          pokemonId: event.pokemonId,
          text: t("battle.infatuated"),
          color: BATTLE_TEXT_COLOR_CONFUSED,
        },
      ];

    case BattleEventType.DefenseTriggered:
      return event.blocked
        ? [
            {
              pokemonId: event.defenderId,
              text: t("battle.blocked"),
              color: BATTLE_TEXT_COLOR_BUFF,
            },
          ]
        : [];

    case BattleEventType.MultiHitComplete:
      return [
        {
          pokemonId: event.targetId,
          text: t("battle.hits", { count: String(event.totalHits) }),
          color: BATTLE_TEXT_COLOR_INFO,
        },
      ];

    case BattleEventType.RechargeStarted:
      return [
        { pokemonId: event.pokemonId, text: t("battle.recharge"), color: BATTLE_TEXT_COLOR_INFO },
      ];

    case BattleEventType.CriticalHit:
      return [
        {
          pokemonId: event.targetId,
          text: t("battle.critical"),
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
              text: t("battle.itemConsumed", { name }),
              color: BATTLE_TEXT_COLOR_ITEM_CONSUMED,
            },
          ]
        : [];
    }

    case BattleEventType.AuraPosted:
      return [
        {
          pokemonId: event.casterId,
          text: t(AURA_POSTED_KEY[event.kind]),
          color: BATTLE_TEXT_COLOR_INFO,
        },
      ];

    case BattleEventType.AuraBroken:
      return [
        { pokemonId: event.casterId, text: t("aura.broken"), color: BATTLE_TEXT_COLOR_DEBUFF },
      ];

    case BattleEventType.FieldTerrainPosted:
      return [
        {
          pokemonId: event.casterId,
          text: t(FIELD_TERRAIN_POSTED_KEY[event.kind]),
          color: BATTLE_TEXT_COLOR_INFO,
        },
      ];

    case BattleEventType.DashBlockedByPsychicTerrain:
      return [
        {
          pokemonId: event.pokemonId,
          text: t("fieldTerrain.dashBlocked"),
          color: BATTLE_TEXT_COLOR_INFO,
        },
      ];

    case BattleEventType.StatChangeBlocked:
    case BattleEventType.StatusBlocked:
      return [
        {
          pokemonId: event.pokemonId,
          text: t(AURA_BLOCKED_KEY[event.reason], {
            name: context.getPokemonName(event.pokemonId),
          }),
          color: BATTLE_TEXT_COLOR_INFO,
        },
      ];

    case BattleEventType.SubstitutePosted:
      return [
        {
          pokemonId: event.pokemonId,
          text: t("substitute.posted", { name: context.getPokemonName(event.pokemonId) }),
          color: BATTLE_TEXT_COLOR_INFO,
        },
      ];

    case BattleEventType.SubstituteBroken:
      return [
        {
          pokemonId: event.pokemonId,
          text: t("substitute.broken", { name: context.getPokemonName(event.pokemonId) }),
          color: BATTLE_TEXT_COLOR_DEBUFF,
        },
      ];

    case BattleEventType.TauntBlocked:
      return [
        { pokemonId: event.pokemonId, text: t("status.taunted"), color: BATTLE_TEXT_COLOR_TAUNT },
      ];

    case BattleEventType.MoveDisabled:
      return [
        { pokemonId: event.pokemonId, text: t("status.disabled"), color: BATTLE_TEXT_COLOR_TAUNT },
      ];

    case BattleEventType.MoveEncored:
      return [
        { pokemonId: event.pokemonId, text: t("status.encored"), color: BATTLE_TEXT_COLOR_TAUNT },
      ];

    case BattleEventType.SubstituteFailed:
      return [
        {
          pokemonId: event.pokemonId,
          text:
            event.reason === SubstituteFailedReason.AlreadyActive
              ? t("substitute.failed.active", { name: context.getPokemonName(event.pokemonId) })
              : t("substitute.failed.lowHp", { name: context.getPokemonName(event.pokemonId) }),
          color: BATTLE_TEXT_COLOR_INFO,
        },
      ];

    case BattleEventType.DisableBlocked:
      return [
        { pokemonId: event.pokemonId, text: t("status.disabled"), color: BATTLE_TEXT_COLOR_TAUNT },
      ];

    case BattleEventType.EncoreBlocked:
      return [
        { pokemonId: event.pokemonId, text: t("status.encored"), color: BATTLE_TEXT_COLOR_TAUNT },
      ];

    case BattleEventType.DisableFailed:
    case BattleEventType.EncoreFailed:
      return [
        { pokemonId: event.pokemonId, text: t("battle.noEffect"), color: BATTLE_TEXT_COLOR_IMMUNE },
      ];

    default:
      return [];
  }
}

function effectivenessText(effectiveness: number): { text: string; color: string } | null {
  if (effectiveness >= 4) {
    return { text: t("battle.extremelyEffective"), color: BATTLE_TEXT_COLOR_EXTREMELY_EFFECTIVE };
  }
  if (effectiveness >= 2) {
    return { text: t("battle.superEffective"), color: BATTLE_TEXT_COLOR_SUPER_EFFECTIVE };
  }
  if (effectiveness <= 0.25) {
    return { text: t("battle.mostlyIneffective"), color: BATTLE_TEXT_COLOR_MOSTLY_INEFFECTIVE };
  }
  if (effectiveness <= 0.5) {
    return { text: t("battle.notVeryEffective"), color: BATTLE_TEXT_COLOR_NOT_VERY_EFFECTIVE };
  }
  return null;
}
