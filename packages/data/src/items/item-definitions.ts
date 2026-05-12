import type { BattleEvent, HeldItemHandler, PokemonInstance } from "@pokemon-tactic/core";
import {
  BattleEventType,
  Category,
  HeldItemId,
  PokemonType,
  StatName,
  StatusType,
} from "@pokemon-tactic/core";

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

const CHOICE_SPECS_MOD = 1.5;
const EVIOLITE_DEFENSE_MOD = 1 / 1.5;
const BLACK_SLUDGE_HEAL_FRACTION = 16;
const BLACK_SLUDGE_DAMAGE_FRACTION = 8;
const LEEK_CRIT_STAGES = 2;
const THICK_CLUB_MOD = 2.0;
const SALAC_THRESHOLD = 0.25;
const SALAC_SPEED_STAGES = 1;
const NORMAL_GEM_MOD = 1.3;
const FARFETCH_D_DEFINITION_ID = "farfetch-d";
const MAROWAK_DEFINITION_ID = "marowak";

const EVIOLITE_NFE_POKEMON_IDS = new Set<string>([
  "chansey",
  "electabuzz",
  "lickitung",
  "magmar",
  "onix",
  "porygon",
  "rhydon",
  "scyther",
  "seadra",
  "tangela",
]);

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

  {
    id: HeldItemId.ChoiceSpecs,
    onMoveLock: () => true,
    onDamageModify: (context) => {
      if (!context.isAttacker || context.move.category !== Category.Special) {
        return 1.0;
      }
      return CHOICE_SPECS_MOD;
    },
  },

  {
    id: HeldItemId.Eviolite,
    onDamageModify: (context) => {
      if (context.isAttacker) {
        return 1.0;
      }
      if (!EVIOLITE_NFE_POKEMON_IDS.has(context.self.definitionId)) {
        return 1.0;
      }
      return EVIOLITE_DEFENSE_MOD;
    },
  },

  {
    id: HeldItemId.BlackSludge,
    onEndTurn: ({ pokemon, selfTypes }) => {
      const isPoison = selfTypes.includes(PokemonType.Poison);
      if (isPoison) {
        if (pokemon.currentHp >= pokemon.maxHp) {
          return [];
        }
        const heal = Math.max(1, Math.floor(pokemon.maxHp / BLACK_SLUDGE_HEAL_FRACTION));
        pokemon.currentHp = Math.min(pokemon.maxHp, pokemon.currentHp + heal);
        return [
          emitItemActivated(pokemon, HeldItemId.BlackSludge),
          { type: BattleEventType.HpRestored, pokemonId: pokemon.id, amount: heal },
        ];
      }
      const damage = Math.max(1, Math.floor(pokemon.maxHp / BLACK_SLUDGE_DAMAGE_FRACTION));
      pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
      const events: BattleEvent[] = [
        emitItemActivated(pokemon, HeldItemId.BlackSludge),
        {
          type: BattleEventType.DamageDealt,
          targetId: pokemon.id,
          amount: damage,
          effectiveness: 1,
        },
      ];
      if (pokemon.currentHp <= 0) {
        events.push({
          type: BattleEventType.PokemonKo,
          pokemonId: pokemon.id,
          countdownStart: 0,
        });
      }
      return events;
    },
  },

  {
    id: HeldItemId.Leek,
    onCritStageBoost: ({ self }) => {
      if (self.definitionId !== FARFETCH_D_DEFINITION_ID) {
        return 0;
      }
      return LEEK_CRIT_STAGES;
    },
  },

  {
    id: HeldItemId.ThickClub,
    onDamageModify: (context) => {
      if (!context.isAttacker || context.self.definitionId !== MAROWAK_DEFINITION_ID) {
        return 1.0;
      }
      if (context.move.category !== Category.Physical) {
        return 1.0;
      }
      return THICK_CLUB_MOD;
    },
  },

  {
    id: HeldItemId.WhiteHerb,
    onStatLowered: ({ pokemon, stat, stages }) => {
      const negativeStages: { stat: StatName; stages: number }[] = [];
      for (const [statName, stageValue] of Object.entries(pokemon.statStages) as [
        StatName,
        number,
      ][]) {
        if (stageValue < 0) {
          negativeStages.push({ stat: statName, stages: stageValue });
        }
      }
      if (!negativeStages.some((entry) => entry.stat === stat)) {
        negativeStages.push({ stat, stages });
      }
      if (negativeStages.length === 0) {
        return { events: [], consumeItem: false };
      }
      const events: BattleEvent[] = [emitItemActivated(pokemon, HeldItemId.WhiteHerb)];
      for (const entry of negativeStages) {
        const restoreAmount = -entry.stages;
        pokemon.statStages[entry.stat] = 0;
        events.push({
          type: BattleEventType.StatChanged,
          targetId: pokemon.id,
          stat: entry.stat,
          stages: restoreAmount,
        });
      }
      events.push({
        type: BattleEventType.HeldItemConsumed,
        pokemonId: pokemon.id,
        itemId: HeldItemId.WhiteHerb,
      });
      return { events, consumeItem: true };
    },
  },

  {
    id: HeldItemId.FlameOrb,
    onEndTurn: ({ pokemon }) => {
      if (pokemon.statusEffects.some((s) => s.type === StatusType.Burned)) {
        return [];
      }
      if (
        pokemon.statusEffects.some(
          (s) =>
            s.type === StatusType.Frozen ||
            s.type === StatusType.Paralyzed ||
            s.type === StatusType.Poisoned ||
            s.type === StatusType.BadlyPoisoned ||
            s.type === StatusType.Asleep,
        )
      ) {
        return [];
      }
      pokemon.statusEffects.push({ type: StatusType.Burned, remainingTurns: null });
      return [
        emitItemActivated(pokemon, HeldItemId.FlameOrb),
        {
          type: BattleEventType.StatusApplied,
          targetId: pokemon.id,
          status: StatusType.Burned,
        },
      ];
    },
  },

  {
    id: HeldItemId.SalacBerry,
    onAfterDamageReceived: ({ target }) => {
      if (target.currentHp <= 0) {
        return { events: [], consumeItem: false };
      }
      if (target.currentHp / target.maxHp > SALAC_THRESHOLD) {
        return { events: [], consumeItem: false };
      }
      const currentSpeedStage = target.statStages[StatName.Speed] ?? 0;
      const newSpeedStage = Math.min(6, currentSpeedStage + SALAC_SPEED_STAGES);
      const actualBoost = newSpeedStage - currentSpeedStage;
      if (actualBoost === 0) {
        return { events: [], consumeItem: false };
      }
      target.statStages[StatName.Speed] = newSpeedStage;
      return {
        events: [
          emitItemActivated(target, HeldItemId.SalacBerry),
          {
            type: BattleEventType.StatChanged,
            targetId: target.id,
            stat: StatName.Speed,
            stages: actualBoost,
          },
          {
            type: BattleEventType.HeldItemConsumed,
            pokemonId: target.id,
            itemId: HeldItemId.SalacBerry,
          },
        ],
        consumeItem: true,
      };
    },
    onEndTurn: ({ pokemon }) => {
      if (pokemon.currentHp <= 0) {
        return [];
      }
      if (pokemon.currentHp / pokemon.maxHp > SALAC_THRESHOLD) {
        return [];
      }
      const currentSpeedStage = pokemon.statStages[StatName.Speed] ?? 0;
      const newSpeedStage = Math.min(6, currentSpeedStage + SALAC_SPEED_STAGES);
      const actualBoost = newSpeedStage - currentSpeedStage;
      if (actualBoost === 0) {
        return [];
      }
      pokemon.statStages[StatName.Speed] = newSpeedStage;
      pokemon.heldItemId = undefined;
      return [
        emitItemActivated(pokemon, HeldItemId.SalacBerry),
        {
          type: BattleEventType.StatChanged,
          targetId: pokemon.id,
          stat: StatName.Speed,
          stages: actualBoost,
        },
        {
          type: BattleEventType.HeldItemConsumed,
          pokemonId: pokemon.id,
          itemId: HeldItemId.SalacBerry,
        },
      ];
    },
  },

  {
    id: HeldItemId.NormalGem,
    onDamageModify: (context) => {
      if (!context.isAttacker || context.move.type !== PokemonType.Normal) {
        return 1.0;
      }
      return NORMAL_GEM_MOD;
    },
    onAfterMoveDamageDealt: ({ attacker, move, damageDealt }) => {
      if (damageDealt <= 0 || move.type !== PokemonType.Normal) {
        return [];
      }
      attacker.heldItemId = undefined;
      return [
        emitItemActivated(attacker, HeldItemId.NormalGem),
        {
          type: BattleEventType.HeldItemConsumed,
          pokemonId: attacker.id,
          itemId: HeldItemId.NormalGem,
        },
      ];
    },
  },
];
