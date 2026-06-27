import type { BattleEvent, HeldItemHandler, PokemonInstance } from "@pokemon-tactic/core";
import {
  BattleEventType,
  Category,
  consumeHeldItem,
  FieldTerrain,
  HeldItemId,
  isOnFieldTerrain,
  metronomeDamageMultiplier,
  PokemonType,
  ProtectionReason,
  pendingMetronomeSteps,
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
const EVASION_MOD = 0.9;
const FLINCH_CHANCE = 10;
const ASSAULT_VEST_SPDEF_MOD = 1 / 1.5;
const BIG_ROOT_DRAIN_MOD = 1.3;
const PUNCHING_GLOVE_MOD = 1.1;

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
const GLUTTONY_BERRY_THRESHOLD = 0.5;
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
    isBerry: true,
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

// Gloutonnerie (gluttony): the holder eats its pinch berry at 50% HP instead of 25%.
function isInBerryPinch(pokemon: PokemonInstance): boolean {
  const threshold =
    pokemon.abilityId === "gluttony" ? GLUTTONY_BERRY_THRESHOLD : PINCH_BERRY_THRESHOLD;
  return pokemon.currentHp > 0 && pokemon.currentHp / pokemon.maxHp <= threshold;
}

const PINCH_BERRY_SPECIAL_STAGES = 2;
const FRISTA_STATS: StatName[] = [
  StatName.Attack,
  StatName.Defense,
  StatName.SpAttack,
  StatName.SpDefense,
  StatName.Speed,
];

function raiseCritStage(pokemon: PokemonInstance, stages = PINCH_BERRY_SPECIAL_STAGES): void {
  pokemon.critStageBoost = (pokemon.critStageBoost ?? 0) + stages;
}

/** Baie Lansat: at ≤25% HP (or 50% with Gloutonnerie) the holder gains +2 crit stages. */
function lansatBerry(): HeldItemHandler {
  const id = HeldItemId.LansatBerry;
  return {
    id,
    isBerry: true,
    onEaten: (eater) => {
      raiseCritStage(eater);
      return [];
    },
    onAfterDamageReceived: ({ target }) => {
      if (!isInBerryPinch(target)) {
        return { events: [], consumeItem: false };
      }
      raiseCritStage(target);
      return {
        events: [
          emitItemActivated(target, id),
          { type: BattleEventType.HeldItemConsumed, pokemonId: target.id, itemId: id },
        ],
        consumeItem: true,
      };
    },
    onEndTurn: ({ pokemon }) => {
      if (!isInBerryPinch(pokemon)) {
        return [];
      }
      raiseCritStage(pokemon);
      consumeHeldItem(pokemon, { isBerry: true });
      return [
        emitItemActivated(pokemon, id),
        { type: BattleEventType.HeldItemConsumed, pokemonId: pokemon.id, itemId: id },
      ];
    },
  };
}

function pickFristaStat(seed: number): StatName {
  const index = Math.abs(Math.trunc(seed)) % FRISTA_STATS.length;
  return FRISTA_STATS[index] ?? StatName.Attack;
}

/** Baie Frista: at ≤25% HP (or 50% with Gloutonnerie) the holder gains +2 to a deterministic stat. */
function starfBerry(): HeldItemHandler {
  const id = HeldItemId.StarfBerry;
  const boost = (pokemon: PokemonInstance, seed: number) => {
    const stat = pickFristaStat(seed);
    const applied = raiseStatStage(pokemon, stat, PINCH_BERRY_SPECIAL_STAGES);
    return { stat, applied };
  };
  return {
    id,
    isBerry: true,
    onEaten: (eater) => {
      const { stat, applied } = boost(eater, eater.currentHp);
      return applied > 0
        ? [{ type: BattleEventType.StatChanged, targetId: eater.id, stat, stages: applied }]
        : [];
    },
    onAfterDamageReceived: ({ target }) => {
      if (!isInBerryPinch(target)) {
        return { events: [], consumeItem: false };
      }
      const { stat, applied } = boost(target, target.currentHp);
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
    onEndTurn: ({ pokemon, state }) => {
      if (!isInBerryPinch(pokemon)) {
        return [];
      }
      const { stat, applied } = boost(pokemon, state.actionCounter ?? 0);
      if (applied === 0) {
        return [];
      }
      consumeHeldItem(pokemon, { isBerry: true });
      return [
        emitItemActivated(pokemon, id),
        { type: BattleEventType.StatChanged, targetId: pokemon.id, stat, stages: applied },
        { type: BattleEventType.HeldItemConsumed, pokemonId: pokemon.id, itemId: id },
      ];
    },
  };
}

function pinchStatBerry(id: HeldItemId, stat: StatName): HeldItemHandler {
  const isInPinch = isInBerryPinch;
  return {
    id,
    isBerry: true,
    onEaten: (eater) => {
      const applied = raiseStatStage(eater, stat, PINCH_BERRY_STAGES);
      return applied > 0
        ? [{ type: BattleEventType.StatChanged, targetId: eater.id, stat, stages: applied }]
        : [];
    },
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
      consumeHeldItem(pokemon, { isBerry: true });
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
      consumeHeldItem(pokemon);
      return [
        emitItemActivated(pokemon, id),
        { type: BattleEventType.StatChanged, targetId: pokemon.id, stat, stages: applied },
        { type: BattleEventType.HeldItemConsumed, pokemonId: pokemon.id, itemId: id },
      ];
    },
  };
}

function accuracyBoostItem(id: HeldItemId, multiplier: number): HeldItemHandler {
  return {
    id,
    onAccuracyModify: () => multiplier,
  };
}

function evasionItem(id: HeldItemId, multiplier: number): HeldItemHandler {
  return {
    id,
    onEvasionModify: () => multiplier,
  };
}

function flinchItem(id: HeldItemId, chance: number): HeldItemHandler {
  return {
    id,
    onFlinchChance: () => chance,
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
  const cureStatuses = (pokemon: PokemonInstance): StatusType[] => {
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
    return removed;
  };
  return {
    id,
    isBerry: true,
    onEaten: (eater) =>
      cureStatuses(eater).map((status) => ({
        type: BattleEventType.StatusRemoved,
        targetId: eater.id,
        status,
      })),
    onEndTurn: ({ pokemon }) => {
      if (pokemon.currentHp <= 0) {
        return [];
      }
      const removed = cureStatuses(pokemon);
      if (removed.length === 0) {
        return [];
      }
      consumeHeldItem(pokemon, { isBerry: true });
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

function flingStatus(status: StatusType) {
  return (target: PokemonInstance): BattleEvent[] => {
    if (target.statusEffects.some((s) => MAJOR_STATUSES.includes(s.type))) {
      return [];
    }
    target.statusEffects.push({ type: status, remainingTurns: null });
    if (status === StatusType.BadlyPoisoned) {
      target.toxicCounter = 0;
    }
    return [{ type: BattleEventType.StatusApplied, targetId: target.id, status }];
  };
}

function flingFlinch(target: PokemonInstance): BattleEvent[] {
  if (target.volatileStatuses.some((v) => v.type === StatusType.Flinch)) {
    return [];
  }
  target.volatileStatuses.push({ type: StatusType.Flinch, remainingTurns: 1 });
  return [{ type: BattleEventType.StatusApplied, targetId: target.id, status: StatusType.Flinch }];
}

/** Secondary effect a thrown non-berry item inflicts on the target (Dégommage). */
const FLING_EFFECT: Partial<Record<HeldItemId, (target: PokemonInstance) => BattleEvent[]>> = {
  [HeldItemId.FlameOrb]: flingStatus(StatusType.Burned),
  [HeldItemId.ToxicOrb]: flingStatus(StatusType.BadlyPoisoned),
  [HeldItemId.PoisonBarb]: flingStatus(StatusType.Poisoned),
  [HeldItemId.LightBall]: flingStatus(StatusType.Paralyzed),
  [HeldItemId.KingsRock]: flingFlinch,
  [HeldItemId.RazorFang]: flingFlinch,
};

/** Stamp each held item with its optional fling secondary (Dégommage); fling power comes from the
 * reference data merge (load-items). */
function withFlingMetadata(handler: HeldItemHandler): HeldItemHandler {
  // A handler's id is always a HeldItemId at runtime (the registry is keyed by it).
  const onFling = FLING_EFFECT[handler.id as HeldItemId];
  return onFling ? { ...handler, onFling } : handler;
}

const baseItemHandlers: HeldItemHandler[] = [
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
    onAfterDamageReceived: ({ target, attacker, isContact, damageDealt }) => {
      // isContact already accounts for Pare-Effet (protective-pads) on the attacker.
      if (damageDealt <= 0 || !isContact) {
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
    isBerry: true,
    onEaten: (eater) => {
      const heal = Math.max(1, Math.floor(eater.maxHp / SITRUS_BERRY_HEAL_FRACTION));
      const before = eater.currentHp;
      eater.currentHp = Math.min(eater.maxHp, eater.currentHp + heal);
      const restored = eater.currentHp - before;
      if (restored <= 0) {
        return [];
      }
      return [{ type: BattleEventType.HpRestored, pokemonId: eater.id, amount: restored }];
    },
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
      consumeHeldItem(attacker);
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
  lansatBerry(),
  starfBerry(),

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

  accuracyBoostItem(HeldItemId.WideLens, 1.1),
  {
    id: HeldItemId.ZoomLens,
    onAccuracyModify: ({ self, target }) =>
      (target.lastActedAtAction ?? -1) > (self.lastActedAtAction ?? -1) ? 1.2 : 1,
  },

  evasionItem(HeldItemId.BrightPowder, EVASION_MOD),
  evasionItem(HeldItemId.LaxIncense, EVASION_MOD),
  flinchItem(HeldItemId.KingsRock, FLINCH_CHANCE),
  flinchItem(HeldItemId.RazorFang, FLINCH_CHANCE),

  {
    id: HeldItemId.AssaultVest,
    // Sp. Def ×1.5 — equivalent to reducing incoming special damage by the same factor. Physical
    // moves and special moves that target Defense (hitsPhysicalDefense) are unaffected.
    forbidsStatusMoves: true,
    onDamageModify: (context) => {
      if (context.isAttacker) {
        return 1.0;
      }
      const usesSpecialDefense =
        context.move.category === Category.Special && context.move.hitsPhysicalDefense !== true;
      return usesSpecialDefense ? ASSAULT_VEST_SPDEF_MOD : 1.0;
    },
  },

  {
    id: HeldItemId.BigRoot,
    onDrainHealModify: () => BIG_ROOT_DRAIN_MOD,
  },

  {
    id: HeldItemId.MentalHerb,
    curesMoveRestriction: true,
  },

  {
    // Ballon (air-balloon): immune to Sol moves while held; pops (consumed) on the first
    // damaging hit, after which the holder is grounded again.
    id: HeldItemId.AirBalloon,
    onTypeImmunity: ({ moveType }) => ({
      blocked: moveType === PokemonType.Ground,
      events: [],
    }),
    onAfterDamageReceived: ({ target }) => ({
      events: [
        emitItemActivated(target, HeldItemId.AirBalloon),
        {
          type: BattleEventType.HeldItemConsumed,
          pokemonId: target.id,
          itemId: HeldItemId.AirBalloon,
        },
      ],
      consumeItem: true,
    }),
  },

  {
    // Lunettes Filtre (safety-goggles): immune to Poudre moves and to weather chip damage.
    id: HeldItemId.SafetyGoggles,
    immuneToWeatherDamage: true,
    onMoveImmunity: ({ self, move }) => {
      if (move.flags?.powder !== true) {
        return { blocked: false, events: [] };
      }
      return { blocked: true, events: [emitItemActivated(self, HeldItemId.SafetyGoggles)] };
    },
  },

  {
    // Pare-Effet (protective-pads): the holder's contact moves ignore the target's
    // contact-triggered reactions. Pure flag — wired in handle-damage.
    id: HeldItemId.ProtectivePads,
    protectsFromContactEffects: true,
  },

  {
    // Talisman Sain (clear-amulet): blocks any opponent-inflicted stat drop on the holder.
    id: HeldItemId.ClearAmulet,
    onStatChangeBlocked: ({ self, stat }) => ({
      blocked: true,
      events: [
        emitItemActivated(self, HeldItemId.ClearAmulet),
        {
          type: BattleEventType.StatChangeBlocked,
          pokemonId: self.id,
          stat,
          reason: ProtectionReason.HeldItem,
        },
      ],
    }),
  },

  {
    // Gant de Boxe (punching-glove): the holder's Poing moves hit ×1.1 and lose contact, so the
    // target's contact reactions (Casque Brut, Statik, Peau Dure…) are muted. Contact removal is
    // wired in handle-damage via nullifiesContactForMove.
    id: HeldItemId.PunchingGlove,
    onDamageModify: (context) => {
      if (!context.isAttacker || context.move.flags?.punch !== true) {
        return 1.0;
      }
      return PUNCHING_GLOVE_MOD;
    },
    nullifiesContactForMove: (move) => move.flags?.punch === true,
  },

  {
    // Spray Gorge (throat-spray): raises the holder's Sp. Atk by 1 stage after it uses a Son move
    // (damaging or status), then is consumed. Consumed on any Son-move use, faithful to Showdown's
    // useItem-on-sound trigger; the stat event is emitted only when the boost actually applies.
    id: HeldItemId.ThroatSpray,
    onAfterMoveUse: ({ self, move }) => {
      if (move.flags?.sound !== true) {
        return { events: [], consumeItem: false };
      }
      const applied = raiseStatStage(self, StatName.SpAttack);
      const events: BattleEvent[] = [emitItemActivated(self, HeldItemId.ThroatSpray)];
      if (applied > 0) {
        events.push({
          type: BattleEventType.StatChanged,
          targetId: self.id,
          stat: StatName.SpAttack,
          stages: applied,
        });
      }
      events.push({
        type: BattleEventType.HeldItemConsumed,
        pokemonId: self.id,
        itemId: HeldItemId.ThroatSpray,
      });
      return { events, consumeItem: true };
    },
  },

  {
    // Métronome (objet) : chaque usage consécutif du MÊME move (succès au tour précédent) ajoute
    // +10% de dégâts, cumulatif jusqu'à +100% (×2.0, 10 paliers). Le compteur est tenu sur le
    // PokemonInstance (metronomeStreak) et lu en pré-update via pendingMetronomeSteps — même source
    // que le commit dans recordLastUsedMove. Reset si le move change ou si l'usage précédent a échoué.
    id: HeldItemId.Metronome,
    onDamageModify: (context) => {
      if (!context.isAttacker) {
        return 1.0;
      }
      return metronomeDamageMultiplier(pendingMetronomeSteps(context.self, context.move.id));
    },
  },

  {
    // Bouton Fuite (eject-button) : le porteur touché est téléporté sur une case sûre de sa zone de
    // spawn, puis l'objet est consommé. Pas de banc dans ce jeu tactique → le téléport au spawn est
    // l'analogue du switch-out canon. Résolu côté moteur (handle-damage + forced-teleport).
    id: HeldItemId.EjectButton,
    ejectsHolderOnHit: true,
  },

  {
    // Carton Rouge (red-card) : quand le porteur est touché, c'est l'ATTAQUANT qui est téléporté sur
    // sa propre zone de spawn, puis l'objet est consommé. Analogue tactique du « force switch ».
    id: HeldItemId.RedCard,
    ejectsAttackerOnHit: true,
  },

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

export const itemHandlers: HeldItemHandler[] = baseItemHandlers.map(withFlingMetadata);
