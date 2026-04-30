import type { BattleEvent, HeldItemHandler, PokemonInstance } from "@pokemon-tactic/core";
import { BattleEventType, Category, HeldItemId, StatName } from "@pokemon-tactic/core";

const LIFE_ORB_RECOIL_FRACTION = 10;
const LEFTOVERS_HEAL_FRACTION = 16;
const SITRUS_BERRY_HEAL_FRACTION = 4;
const SITRUS_BERRY_THRESHOLD = 0.5;
const CHOICE_BAND_MOD = 1.5;
const CHOICE_SCARF_MOD = 1.5;
const EXPERT_BELT_MOD = 1.2;
const ROCKY_HELMET_FRACTION = 6;
const WEAKNESS_POLICY_STAGES = 2;
const LIGHT_BALL_MOD = 2.0;
const PIKACHU_DEFINITION_ID = "pikachu";

function emitItemActivated(pokemon: PokemonInstance, itemId: string): BattleEvent {
  return {
    type: BattleEventType.HeldItemActivated,
    pokemonId: pokemon.id,
    itemId,
    targetIds: [pokemon.id],
  };
}

export const itemHandlers: HeldItemHandler[] = [
  {
    id: HeldItemId.Leftovers,
    onEndTurn: ({ pokemon }) => {
      if (pokemon.currentHp >= pokemon.maxHp) {
        return [];
      }
      const heal = Math.max(1, Math.floor(pokemon.maxHp / LEFTOVERS_HEAL_FRACTION));
      pokemon.currentHp = Math.min(pokemon.maxHp, pokemon.currentHp + heal);
      return [
        emitItemActivated(pokemon, HeldItemId.Leftovers),
        {
          type: BattleEventType.HpRestored,
          pokemonId: pokemon.id,
          amount: heal,
        },
      ];
    },
  },

  {
    id: HeldItemId.LifeOrb,
    onDamageModify: (context) => (context.isAttacker ? 1.3 : 1.0),
    onAfterMoveDamageDealt: ({ attacker, damageDealt }) => {
      if (damageDealt <= 0) {
        return [];
      }
      const recoil = Math.max(1, Math.floor(attacker.maxHp / LIFE_ORB_RECOIL_FRACTION));
      attacker.currentHp = Math.max(0, attacker.currentHp - recoil);
      const events: BattleEvent[] = [
        emitItemActivated(attacker, HeldItemId.LifeOrb),
        {
          type: BattleEventType.DamageDealt,
          targetId: attacker.id,
          amount: recoil,
          effectiveness: 1,
        },
      ];
      if (attacker.currentHp <= 0) {
        events.push({
          type: BattleEventType.PokemonKo,
          pokemonId: attacker.id,
          countdownStart: 0,
        });
      }
      return events;
    },
  },

  {
    id: HeldItemId.ChoiceBand,
    onMoveLock: () => true,
    onDamageModify: (context) => {
      if (!context.isAttacker || context.move.category !== Category.Physical) {
        return 1.0;
      }
      return CHOICE_BAND_MOD;
    },
  },

  {
    id: HeldItemId.ChoiceScarf,
    onMoveLock: () => true,
    onCtGainModify: () => CHOICE_SCARF_MOD,
  },

  {
    id: HeldItemId.FocusSash,
  },

  {
    id: HeldItemId.ExpertBelt,
    onDamageModify: (context) => {
      if (!context.isAttacker || context.effectiveness <= 1.0) {
        return 1.0;
      }
      return EXPERT_BELT_MOD;
    },
  },

  {
    id: HeldItemId.RockyHelmet,
    onAfterDamageReceived: ({ target, attacker, move, damageDealt }) => {
      if (damageDealt <= 0 || !move.flags?.contact) {
        return { events: [], consumeItem: false };
      }
      const recoil = Math.max(1, Math.floor(attacker.maxHp / ROCKY_HELMET_FRACTION));
      attacker.currentHp = Math.max(0, attacker.currentHp - recoil);
      const events: BattleEvent[] = [
        emitItemActivated(target, HeldItemId.RockyHelmet),
        {
          type: BattleEventType.DamageDealt,
          targetId: attacker.id,
          amount: recoil,
          effectiveness: 1,
        },
      ];
      if (attacker.currentHp <= 0) {
        events.push({
          type: BattleEventType.PokemonKo,
          pokemonId: attacker.id,
          countdownStart: 0,
        });
      }
      return { events, consumeItem: false };
    },
  },

  {
    id: HeldItemId.WeaknessPolicy,
    onAfterDamageReceived: ({ target, isSuperEffective }) => {
      if (!isSuperEffective) {
        return { events: [], consumeItem: false };
      }
      target.statStages[StatName.Attack] = Math.min(
        6,
        (target.statStages[StatName.Attack] ?? 0) + WEAKNESS_POLICY_STAGES,
      );
      target.statStages[StatName.SpAttack] = Math.min(
        6,
        (target.statStages[StatName.SpAttack] ?? 0) + WEAKNESS_POLICY_STAGES,
      );
      return {
        events: [
          emitItemActivated(target, HeldItemId.WeaknessPolicy),
          {
            type: BattleEventType.HeldItemConsumed,
            pokemonId: target.id,
            itemId: HeldItemId.WeaknessPolicy,
          },
        ],
        consumeItem: true,
      };
    },
  },

  {
    id: HeldItemId.ScopeLens,
    onCritStageBoost: () => 1,
  },

  {
    id: HeldItemId.SitrusBerry,
    onAfterDamageReceived: ({ target }) => {
      if (target.currentHp / target.maxHp >= SITRUS_BERRY_THRESHOLD) {
        return { events: [], consumeItem: false };
      }
      const heal = Math.max(1, Math.floor(target.maxHp / SITRUS_BERRY_HEAL_FRACTION));
      target.currentHp = Math.min(target.maxHp, target.currentHp + heal);
      return {
        events: [
          emitItemActivated(target, HeldItemId.SitrusBerry),
          {
            type: BattleEventType.HpRestored,
            pokemonId: target.id,
            amount: heal,
          },
          {
            type: BattleEventType.HeldItemConsumed,
            pokemonId: target.id,
            itemId: HeldItemId.SitrusBerry,
          },
        ],
        consumeItem: true,
      };
    },
  },

  {
    id: HeldItemId.HeavyDutyBoots,
    onTerrainTick: () => ({ blocked: true, events: [] }),
  },

  {
    id: HeldItemId.LightBall,
    onDamageModify: (context) => {
      if (!context.isAttacker || context.self.definitionId !== PIKACHU_DEFINITION_ID) {
        return 1.0;
      }
      return LIGHT_BALL_MOD;
    },
  },
];
