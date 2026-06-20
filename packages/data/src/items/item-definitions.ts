import type { BattleEvent, HeldItemHandler, PokemonInstance } from "@pokemon-tactic/core";
import {
  BattleEventType,
  Category,
  FieldTerrain,
  HeldItemId,
  isOnFieldTerrain,
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
const NORMAL_GEM_MOD = 1.3;
const MUSCLE_BAND_MOD = 1.1;
const WISE_GLASSES_MOD = 1.1;
const SHELL_BELL_HEAL_FRACTION = 8;

const MAJOR_STATUSES: readonly StatusType[] = [
  StatusType.Burned,
  StatusType.Frozen,
  StatusType.Paralyzed,
  StatusType.Poisoned,
  StatusType.BadlyPoisoned,
  StatusType.Asleep,
];
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

const TYPE_BOOST_MOD = 1.2;
const TYPE_RESIST_MOD = 0.5;
const PINCH_BERRY_THRESHOLD = 0.25;
const PINCH_BERRY_STAGES = 1;

function typeBoostItem(id: HeldItemId, boostType: PokemonType): HeldItemHandler {
  return {
    id,
    onDamageModify: (context) => {
      if (!context.isAttacker || context.move.type !== boostType) {
        return 1.0;
      }
      return TYPE_BOOST_MOD;
    },
  };
}

function typeResistBerryTriggers(
  moveType: PokemonType,
  resistType: PokemonType,
  superEffective: boolean,
): boolean {
  if (moveType !== resistType) {
    return false;
  }
  return resistType === PokemonType.Normal || superEffective;
}

function typeResistBerry(id: HeldItemId, resistType: PokemonType): HeldItemHandler {
  return {
    id,
    onDamageModify: (context) => {
      if (context.isAttacker) {
        return 1.0;
      }
      return typeResistBerryTriggers(context.move.type, resistType, context.effectiveness > 1)
        ? TYPE_RESIST_MOD
        : 1.0;
    },
    onAfterDamageReceived: ({ target, move, isSuperEffective }) => {
      if (!typeResistBerryTriggers(move.type, resistType, isSuperEffective)) {
        return { events: [], consumeItem: false };
      }
      return {
        events: [
          emitItemActivated(target, id),
          { type: BattleEventType.HeldItemConsumed, pokemonId: target.id, itemId: id },
        ],
        consumeItem: true,
      };
    },
  };
}

function raiseStatStage(pokemon: PokemonInstance, stat: StatName, stages = 1): number {
  const current = pokemon.statStages[stat] ?? 0;
  const next = Math.min(6, current + stages);
  const applied = next - current;
  if (applied > 0) {
    pokemon.statStages[stat] = next;
  }
  return applied;
}

function pinchStatBerry(id: HeldItemId, stat: StatName): HeldItemHandler {
  const isInPinch = (pokemon: PokemonInstance): boolean =>
    pokemon.currentHp > 0 && pokemon.currentHp / pokemon.maxHp <= PINCH_BERRY_THRESHOLD;
  return {
    id,
    onAfterDamageReceived: ({ target }) => {
      if (!isInPinch(target)) {
        return { events: [], consumeItem: false };
      }
      const applied = raiseStatStage(target, stat, PINCH_BERRY_STAGES);
      if (applied === 0) {
        return { events: [], consumeItem: false };
      }
      return {
        events: [
          emitItemActivated(target, id),
          { type: BattleEventType.StatChanged, targetId: target.id, stat, stages: applied },
          { type: BattleEventType.HeldItemConsumed, pokemonId: target.id, itemId: id },
        ],
        consumeItem: true,
      };
    },
    onEndTurn: ({ pokemon }) => {
      if (!isInPinch(pokemon)) {
        return [];
      }
      const applied = raiseStatStage(pokemon, stat, PINCH_BERRY_STAGES);
      if (applied === 0) {
        return [];
      }
      pokemon.heldItemId = undefined;
      return [
        emitItemActivated(pokemon, id),
        { type: BattleEventType.StatChanged, targetId: pokemon.id, stat, stages: applied },
        { type: BattleEventType.HeldItemConsumed, pokemonId: pokemon.id, itemId: id },
      ];
    },
  };
}

function typeReactionItem(
  id: HeldItemId,
  triggerType: PokemonType,
  stat: StatName,
): HeldItemHandler {
  return {
    id,
    onAfterDamageReceived: ({ target, move }) => {
      if (move.type !== triggerType) {
        return { events: [], consumeItem: false };
      }
      const applied = raiseStatStage(target, stat);
      if (applied === 0) {
        return { events: [], consumeItem: false };
      }
      return {
        events: [
          emitItemActivated(target, id),
          { type: BattleEventType.StatChanged, targetId: target.id, stat, stages: applied },
          { type: BattleEventType.HeldItemConsumed, pokemonId: target.id, itemId: id },
        ],
        consumeItem: true,
      };
    },
  };
}

function terrainSeedItem(id: HeldItemId, terrain: FieldTerrain, stat: StatName): HeldItemHandler {
  return {
    id,
    onEndTurn: ({ pokemon, state, selfTypes }) => {
      if (!isOnFieldTerrain(state, pokemon, selfTypes, terrain)) {
        return [];
      }
      const applied = raiseStatStage(pokemon, stat);
      if (applied === 0) {
        return [];
      }
      pokemon.heldItemId = undefined;
      return [
        emitItemActivated(pokemon, id),
        { type: BattleEventType.StatChanged, targetId: pokemon.id, stat, stages: applied },
        { type: BattleEventType.HeldItemConsumed, pokemonId: pokemon.id, itemId: id },
      ];
    },
  };
}

function selfStatusOrb(id: HeldItemId, status: StatusType): HeldItemHandler {
  return {
    id,
    onEndTurn: ({ pokemon }) => {
      if (pokemon.statusEffects.some((s) => MAJOR_STATUSES.includes(s.type))) {
        return [];
      }
      pokemon.statusEffects.push({ type: status, remainingTurns: null });
      if (status === StatusType.BadlyPoisoned) {
        pokemon.toxicCounter = 0;
      }
      return [
        emitItemActivated(pokemon, id),
        { type: BattleEventType.StatusApplied, targetId: pokemon.id, status },
      ];
    },
  };
}

function cureBerry(
  id: HeldItemId,
  statuses: StatusType[],
  curesConfusion: boolean,
): HeldItemHandler {
  const cureSet = new Set<StatusType>(statuses);
  return {
    id,
    onEndTurn: ({ pokemon }) => {
      if (pokemon.currentHp <= 0) {
        return [];
      }
      const removed: StatusType[] = [];
      for (let i = pokemon.statusEffects.length - 1; i >= 0; i--) {
        const status = pokemon.statusEffects[i];
        if (status && cureSet.has(status.type)) {
          removed.push(status.type);
          pokemon.statusEffects.splice(i, 1);
        }
      }
      if (curesConfusion) {
        const confusionIndex = pokemon.volatileStatuses.findIndex(
          (v) => v.type === StatusType.Confused,
        );
        if (confusionIndex !== -1) {
          pokemon.volatileStatuses.splice(confusionIndex, 1);
          removed.push(StatusType.Confused);
        }
      }
      if (removed.length === 0) {
        return [];
      }
      pokemon.heldItemId = undefined;
      const events: BattleEvent[] = [emitItemActivated(pokemon, id)];
      for (const status of removed) {
        events.push({ type: BattleEventType.StatusRemoved, targetId: pokemon.id, status });
      }
      events.push({
        type: BattleEventType.HeldItemConsumed,
        pokemonId: pokemon.id,
        itemId: id,
      });
      return events;
    },
  };
}

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

  selfStatusOrb(HeldItemId.FlameOrb, StatusType.Burned),

  pinchStatBerry(HeldItemId.SalacBerry, StatName.Speed),

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

  {
    id: HeldItemId.HeatRock,
  },

  {
    id: HeldItemId.DampRock,
  },

  {
    id: HeldItemId.SmoothRock,
  },

  {
    id: HeldItemId.IcyRock,
  },

  {
    id: HeldItemId.LightClay,
  },

  {
    id: HeldItemId.TerrainExtender,
  },

  typeBoostItem(HeldItemId.SilkScarf, PokemonType.Normal),
  typeBoostItem(HeldItemId.Charcoal, PokemonType.Fire),
  typeBoostItem(HeldItemId.MysticWater, PokemonType.Water),
  typeBoostItem(HeldItemId.MiracleSeed, PokemonType.Grass),
  typeBoostItem(HeldItemId.Magnet, PokemonType.Electric),
  typeBoostItem(HeldItemId.NeverMeltIce, PokemonType.Ice),
  typeBoostItem(HeldItemId.BlackBelt, PokemonType.Fighting),
  typeBoostItem(HeldItemId.PoisonBarb, PokemonType.Poison),
  typeBoostItem(HeldItemId.SoftSand, PokemonType.Ground),
  typeBoostItem(HeldItemId.SharpBeak, PokemonType.Flying),
  typeBoostItem(HeldItemId.TwistedSpoon, PokemonType.Psychic),
  typeBoostItem(HeldItemId.SilverPowder, PokemonType.Bug),
  typeBoostItem(HeldItemId.HardStone, PokemonType.Rock),
  typeBoostItem(HeldItemId.SpellTag, PokemonType.Ghost),
  typeBoostItem(HeldItemId.DragonFang, PokemonType.Dragon),
  typeBoostItem(HeldItemId.BlackGlasses, PokemonType.Dark),
  typeBoostItem(HeldItemId.MetalCoat, PokemonType.Steel),
  typeBoostItem(HeldItemId.FairyFeather, PokemonType.Fairy),

  typeResistBerry(HeldItemId.OccaBerry, PokemonType.Fire),
  typeResistBerry(HeldItemId.PasshoBerry, PokemonType.Water),
  typeResistBerry(HeldItemId.WacanBerry, PokemonType.Electric),
  typeResistBerry(HeldItemId.RindoBerry, PokemonType.Grass),
  typeResistBerry(HeldItemId.YacheBerry, PokemonType.Ice),
  typeResistBerry(HeldItemId.ChopleBerry, PokemonType.Fighting),
  typeResistBerry(HeldItemId.KebiaBerry, PokemonType.Poison),
  typeResistBerry(HeldItemId.ShucaBerry, PokemonType.Ground),
  typeResistBerry(HeldItemId.CobaBerry, PokemonType.Flying),
  typeResistBerry(HeldItemId.PayapaBerry, PokemonType.Psychic),
  typeResistBerry(HeldItemId.TangaBerry, PokemonType.Bug),
  typeResistBerry(HeldItemId.ChartiBerry, PokemonType.Rock),
  typeResistBerry(HeldItemId.KasibBerry, PokemonType.Ghost),
  typeResistBerry(HeldItemId.HabanBerry, PokemonType.Dragon),
  typeResistBerry(HeldItemId.ColburBerry, PokemonType.Dark),
  typeResistBerry(HeldItemId.BabiriBerry, PokemonType.Steel),
  typeResistBerry(HeldItemId.ChilanBerry, PokemonType.Normal),
  typeResistBerry(HeldItemId.RoseliBerry, PokemonType.Fairy),

  pinchStatBerry(HeldItemId.LiechiBerry, StatName.Attack),
  pinchStatBerry(HeldItemId.GanlonBerry, StatName.Defense),
  pinchStatBerry(HeldItemId.PetayaBerry, StatName.SpAttack),
  pinchStatBerry(HeldItemId.ApicotBerry, StatName.SpDefense),

  cureBerry(HeldItemId.CheriBerry, [StatusType.Paralyzed], false),
  cureBerry(HeldItemId.ChestoBerry, [StatusType.Asleep], false),
  cureBerry(HeldItemId.PechaBerry, [StatusType.Poisoned, StatusType.BadlyPoisoned], false),
  cureBerry(HeldItemId.RawstBerry, [StatusType.Burned], false),
  cureBerry(HeldItemId.AspearBerry, [StatusType.Frozen], false),
  cureBerry(HeldItemId.PersimBerry, [], true),
  cureBerry(
    HeldItemId.LumBerry,
    [
      StatusType.Burned,
      StatusType.Paralyzed,
      StatusType.Poisoned,
      StatusType.BadlyPoisoned,
      StatusType.Frozen,
      StatusType.Asleep,
    ],
    true,
  ),

  selfStatusOrb(HeldItemId.ToxicOrb, StatusType.BadlyPoisoned),

  typeReactionItem(HeldItemId.AbsorbBulb, PokemonType.Water, StatName.SpAttack),
  typeReactionItem(HeldItemId.CellBattery, PokemonType.Electric, StatName.Attack),
  typeReactionItem(HeldItemId.Snowball, PokemonType.Ice, StatName.Attack),
  typeReactionItem(HeldItemId.LuminousMoss, PokemonType.Water, StatName.SpDefense),

  terrainSeedItem(HeldItemId.ElectricSeed, FieldTerrain.Electric, StatName.Defense),
  terrainSeedItem(HeldItemId.GrassySeed, FieldTerrain.Grassy, StatName.Defense),
  terrainSeedItem(HeldItemId.PsychicSeed, FieldTerrain.Psychic, StatName.SpDefense),
  terrainSeedItem(HeldItemId.MistySeed, FieldTerrain.Misty, StatName.SpDefense),

  {
    id: HeldItemId.MuscleBand,
    onDamageModify: (context) => {
      if (!context.isAttacker || context.move.category !== Category.Physical) {
        return 1.0;
      }
      return MUSCLE_BAND_MOD;
    },
  },

  {
    id: HeldItemId.WiseGlasses,
    onDamageModify: (context) => {
      if (!context.isAttacker || context.move.category !== Category.Special) {
        return 1.0;
      }
      return WISE_GLASSES_MOD;
    },
  },

  {
    id: HeldItemId.ShellBell,
    onAfterMoveDamageDealt: ({ attacker, damageDealt }) => {
      if (damageDealt <= 0 || attacker.currentHp >= attacker.maxHp) {
        return [];
      }
      const heal = Math.max(1, Math.floor(damageDealt / SHELL_BELL_HEAL_FRACTION));
      attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + heal);
      return [
        emitItemActivated(attacker, HeldItemId.ShellBell),
        {
          type: BattleEventType.HpRestored,
          pokemonId: attacker.id,
          amount: heal,
        },
      ];
    },
  },
];
