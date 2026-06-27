import type {
  AbilityHandler,
  BattleEvent,
  PokemonInstance,
  StatusType as StatusTypeAlias,
} from "@pokemon-tactic/core";
import {
  BattleEventType,
  Category,
  EffectKind,
  isImmuneToStatusByType,
  isMajorStatus,
  isProtectedFromStatDecrease,
  manhattanDistance,
  moveHasSecondaryEffect,
  PokemonGender,
  PokemonType,
  ProtectionReason,
  StatName,
  StatusType,
  Weather,
} from "@pokemon-tactic/core";

const SYNC_STATUSES: ReadonlySet<StatusTypeAlias> = new Set<StatusTypeAlias>([
  StatusType.Burned,
  StatusType.Paralyzed,
  StatusType.Poisoned,
  StatusType.BadlyPoisoned,
]);

function hasMajorStatus(pokemon: PokemonInstance): boolean {
  return pokemon.statusEffects.some((s) => isMajorStatus(s.type));
}

function chebyshev(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

const PINCH_THRESHOLD = 1 / 3;

function checkPinchThresholdCross(pokemon: PokemonInstance, abilityId: string): BattleEvent[] {
  const ratio = pokemon.currentHp / pokemon.maxHp;
  if (ratio > PINCH_THRESHOLD) {
    pokemon.abilityFirstTriggered = false;
    return [];
  }
  if (pokemon.abilityFirstTriggered) {
    return [];
  }
  pokemon.abilityFirstTriggered = true;
  return [
    {
      type: BattleEventType.AbilityActivated,
      pokemonId: pokemon.id,
      abilityId,
      targetIds: [pokemon.id],
    },
  ];
}

function pinchBooster(id: string, moveType: PokemonType): AbilityHandler {
  return {
    id,
    onDamageModify: (context) => {
      if (
        context.isAttacker &&
        context.move.type === moveType &&
        context.self.currentHp / context.self.maxHp <= PINCH_THRESHOLD
      ) {
        return 1.5;
      }
      return 1.0;
    },
    onAfterDamageReceived: (context) => checkPinchThresholdCross(context.self, id),
    onBattleStart: (context) => checkPinchThresholdCross(context.self, id),
  };
}

const overgrow = pinchBooster("overgrow", PokemonType.Grass);
const blaze = pinchBooster("blaze", PokemonType.Fire);
const torrent = pinchBooster("torrent", PokemonType.Water);

const keenEye: AbilityHandler = {
  id: "keen-eye",
  onStatChangeBlocked: (context) => {
    if (context.stat !== StatName.Accuracy || context.stages >= 0) {
      return { blocked: false, events: [] };
    }
    return {
      blocked: true,
      events: [
        {
          type: BattleEventType.AbilityActivated,
          pokemonId: context.self.id,
          abilityId: "keen-eye",
          targetIds: [context.self.id],
        },
      ],
    };
  },
};

const staticAbility: AbilityHandler = {
  id: "static",
  onAfterDamageReceived: (context) => {
    if (!context.move.flags?.contact || context.contactNullified) {
      return [];
    }
    if (context.random() >= 0.3) {
      return [];
    }
    if (hasMajorStatus(context.attacker)) {
      return [];
    }
    context.attacker.statusEffects.push({ type: StatusType.Paralyzed, remainingTurns: null });
    return [
      {
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "static",
        targetIds: [context.attacker.id],
      },
      {
        type: BattleEventType.StatusApplied,
        targetId: context.attacker.id,
        status: StatusType.Paralyzed,
      },
    ];
  },
};

const guts: AbilityHandler = {
  id: "guts",
  onDamageModify: (context) => {
    if (
      context.isAttacker &&
      context.move.category === Category.Physical &&
      // Guts boosts the user's Attack stat only; moves that draw from another stat
      // (attackStatSource set) are not affected.
      context.move.attackStatSource === undefined &&
      hasMajorStatus(context.self)
    ) {
      return 1.5;
    }
    return 1.0;
  },
  onAfterStatusReceived: (context) => {
    if (!isMajorStatus(context.status)) {
      return [];
    }
    return [
      {
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "guts",
        targetIds: [context.self.id],
      },
    ];
  },
};

const synchronize: AbilityHandler = {
  id: "synchronize",
  onAfterStatusReceived: (context) => {
    if (!SYNC_STATUSES.has(context.status)) {
      return [];
    }
    if (!context.source) {
      return [];
    }
    if (hasMajorStatus(context.source)) {
      return [];
    }
    if (isImmuneToStatusByType(context.sourceTypes, context.status)) {
      return [];
    }
    context.source.statusEffects.push({ type: context.status, remainingTurns: null });
    return [
      {
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "synchronize",
        targetIds: [context.source.id],
      },
      {
        type: BattleEventType.StatusApplied,
        targetId: context.source.id,
        status: context.status,
      },
    ];
  },
};

const levitate: AbilityHandler = {
  id: "levitate",
  onTypeImmunity: (context) => {
    if (context.moveType !== PokemonType.Ground) {
      return { blocked: false, events: [] };
    }
    return {
      blocked: true,
      events: [
        {
          type: BattleEventType.AbilityActivated,
          pokemonId: context.self.id,
          abilityId: "levitate",
          targetIds: [context.self.id],
        },
      ],
    };
  },
};

const sturdy: AbilityHandler = {
  id: "sturdy",
};

const intimidate: AbilityHandler = {
  id: "intimidate",
  onAuraCheck: (context) => {
    const events: BattleEvent[] = [];
    const targetIds: string[] = [];

    for (const pokemon of context.state.pokemon.values()) {
      if (pokemon.playerId === context.self.playerId) {
        continue;
      }
      if (pokemon.currentHp <= 0) {
        continue;
      }
      if (chebyshev(context.self.position, pokemon.position) > 1) {
        continue;
      }

      const alreadyIntimidated = pokemon.volatileStatuses.some(
        (v) => v.type === StatusType.Intimidated && v.sourceId === context.self.id,
      );
      if (alreadyIntimidated) {
        continue;
      }

      if (pokemon.abilityId === "own-tempo") {
        events.push({
          type: BattleEventType.AbilityActivated,
          pokemonId: pokemon.id,
          abilityId: "own-tempo",
          targetIds: [pokemon.id],
        });
        continue;
      }

      const mistProtection = isProtectedFromStatDecrease(context.state, context.self, pokemon);
      let statChangeApplied = false;

      if (mistProtection.protected) {
        events.push({
          type: BattleEventType.StatChangeBlocked,
          pokemonId: pokemon.id,
          stat: StatName.Attack,
          reason: ProtectionReason.Mist,
          protectingCasterId: mistProtection.casterId,
        });
      } else {
        const currentStage = pokemon.statStages[StatName.Attack];
        const newStage = Math.max(-6, currentStage - 1);
        statChangeApplied = newStage !== currentStage;
        pokemon.statStages[StatName.Attack] = newStage;
        if (statChangeApplied) {
          events.push({
            type: BattleEventType.StatChanged,
            targetId: pokemon.id,
            stat: StatName.Attack,
            stages: -1,
          });
        }
      }
      pokemon.volatileStatuses.push({
        type: StatusType.Intimidated,
        remainingTurns: -1,
        sourceId: context.self.id,
        statChangeApplied,
      });
      targetIds.push(pokemon.id);
      events.push({
        type: BattleEventType.StatusApplied,
        targetId: pokemon.id,
        status: StatusType.Intimidated,
      });
    }

    if (targetIds.length > 0) {
      events.unshift({
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "intimidate",
        targetIds,
      });
    }

    return events;
  },
};

const cuteCharm: AbilityHandler = {
  id: "cute-charm",
  onAfterDamageReceived: (context) => {
    if (!context.move.flags?.contact || context.contactNullified) {
      return [];
    }
    if (
      context.self.gender === PokemonGender.Genderless ||
      context.attacker.gender === PokemonGender.Genderless ||
      context.self.gender === context.attacker.gender
    ) {
      return [];
    }
    if (context.random() >= 0.3) {
      return [];
    }
    const alreadyInfatuated = context.attacker.volatileStatuses.some(
      (v) => v.type === StatusType.Infatuated,
    );
    if (alreadyInfatuated) {
      return [];
    }
    context.attacker.volatileStatuses.push({
      type: StatusType.Infatuated,
      remainingTurns: -1,
      sourceId: context.self.id,
    });
    return [
      {
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "cute-charm",
        targetIds: [context.attacker.id],
      },
      {
        type: BattleEventType.StatusApplied,
        targetId: context.attacker.id,
        status: StatusType.Infatuated,
      },
    ];
  },
};

const thickFat: AbilityHandler = {
  id: "thick-fat",
  onDamageModify: (context) => {
    if (
      !context.isAttacker &&
      (context.move.type === PokemonType.Fire || context.move.type === PokemonType.Ice)
    ) {
      return 0.5;
    }
    return 1.0;
  },
  onAfterDamageReceived: (context) => {
    if (context.self.currentHp <= 0) {
      return [];
    }
    if (context.move.type !== PokemonType.Fire && context.move.type !== PokemonType.Ice) {
      return [];
    }
    if (context.damageDealt <= 0) {
      return [];
    }
    return [
      {
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "thick-fat",
        targetIds: [context.self.id],
      },
    ];
  },
};

const adaptability: AbilityHandler = {
  id: "adaptability",
};

const clearBody: AbilityHandler = {
  id: "clear-body",
  onStatChangeBlocked: (context) => {
    if (context.stages >= 0) {
      return { blocked: false, events: [] };
    }
    return {
      blocked: true,
      events: [
        {
          type: BattleEventType.AbilityActivated,
          pokemonId: context.self.id,
          abilityId: "clear-body",
          targetIds: [context.self.id],
        },
      ],
    };
  },
};

const poisonPoint: AbilityHandler = {
  id: "poison-point",
  onAfterDamageReceived: (context) => {
    if (!context.move.flags?.contact || context.contactNullified) {
      return [];
    }
    if (context.random() >= 0.3) {
      return [];
    }
    if (hasMajorStatus(context.attacker)) {
      return [];
    }
    context.attacker.statusEffects.push({ type: StatusType.Poisoned, remainingTurns: null });
    return [
      {
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "poison-point",
        targetIds: [context.attacker.id],
      },
      {
        type: BattleEventType.StatusApplied,
        targetId: context.attacker.id,
        status: StatusType.Poisoned,
      },
    ];
  },
};

const technician: AbilityHandler = {
  id: "technician",
  onDamageModify: (context) => {
    if (
      context.isAttacker &&
      context.move.power !== undefined &&
      context.move.power > 0 &&
      context.move.power <= 60
    ) {
      return 1.5;
    }
    return 1.0;
  },
};

const magnetPull: AbilityHandler = {
  id: "magnet-pull",
  onAuraCheck: (context) => {
    const events: BattleEvent[] = [];
    const targetIds: string[] = [];

    for (const pokemon of context.state.pokemon.values()) {
      if (pokemon.playerId === context.self.playerId) {
        continue;
      }
      if (pokemon.currentHp <= 0) {
        continue;
      }
      if (chebyshev(context.self.position, pokemon.position) > 1) {
        continue;
      }

      const types = context.pokemonTypesMap.get(pokemon.definitionId) ?? [];
      if (!types.includes(PokemonType.Steel)) {
        continue;
      }

      const alreadyTrapped = pokemon.volatileStatuses.some(
        (v) =>
          v.type === StatusType.Trapped &&
          v.remainingTurns === -1 &&
          v.sourceId === context.self.id,
      );
      if (alreadyTrapped) {
        continue;
      }

      pokemon.volatileStatuses.push({
        type: StatusType.Trapped,
        remainingTurns: -1,
        sourceId: context.self.id,
      });
      targetIds.push(pokemon.id);
      events.push({
        type: BattleEventType.StatusApplied,
        targetId: pokemon.id,
        status: StatusType.Trapped,
      });
    }

    if (targetIds.length > 0) {
      events.unshift({
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "magnet-pull",
        targetIds,
      });
    }

    return events;
  },
};

const sandVeil: AbilityHandler = {
  id: "sand-veil",
  weatherEvasionBoost: { weather: Weather.Sandstorm, stages: 1 },
};

const ownTempo: AbilityHandler = {
  id: "own-tempo",
  onStatusBlocked: (context) => {
    if (context.status !== StatusType.Confused && context.status !== StatusType.Intimidated) {
      return { blocked: false, events: [] };
    }
    return {
      blocked: true,
      events: [
        {
          type: BattleEventType.AbilityActivated,
          pokemonId: context.self.id,
          abilityId: "own-tempo",
          targetIds: [context.self.id],
        },
      ],
    };
  },
};

const earlyBird: AbilityHandler = {
  id: "early-bird",
  onStatusDurationModify: (context) => {
    if (context.status !== StatusType.Asleep) {
      return { duration: context.duration, events: [] };
    }
    return { duration: Math.ceil(context.duration / 2), events: [] };
  },
};

// Glu (sticky-hold): a marker ability. Its effect — blocking item removal / theft / swap — is read
// directly by the item-manipulation guard in the core (isItemProtectedByStickyHold); no hook needed.
const stickyHold: AbilityHandler = {
  id: "sticky-hold",
};

const lightningRod: AbilityHandler = {
  id: "lightning-rod",
  onTypeImmunity: (context) => {
    if (context.moveType !== PokemonType.Electric) {
      return { blocked: false, events: [] };
    }
    const events: BattleEvent[] = [
      {
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "lightning-rod",
        targetIds: [context.self.id],
      },
    ];
    const healAmount = Math.min(
      context.self.maxHp - context.self.currentHp,
      Math.floor(context.self.maxHp * 0.25),
    );
    if (healAmount > 0) {
      context.self.currentHp += healAmount;
      events.push({
        type: BattleEventType.HpRestored,
        pokemonId: context.self.id,
        amount: healAmount,
      });
    }
    const currentStage = context.self.statStages[StatName.SpAttack];
    const newStage = Math.min(6, currentStage + 1);
    if (newStage > currentStage) {
      context.self.statStages[StatName.SpAttack] = newStage;
      events.push({
        type: BattleEventType.StatChanged,
        targetId: context.self.id,
        stat: StatName.SpAttack,
        stages: 1,
      });
    }
    return { blocked: true, events };
  },
};

const magicGuard: AbilityHandler = {
  id: "magic-guard",
  blocksIndirectDamage: true,
};

const noGuard: AbilityHandler = {
  id: "no-guard",
  onAccuracyOverride: () => true,
};

const moxie: AbilityHandler = {
  id: "moxie",
  onAfterKO: (context) => {
    const currentStage = context.self.statStages[StatName.Attack];
    const newStage = Math.min(6, currentStage + 1);
    if (newStage === currentStage) {
      return [];
    }
    context.self.statStages[StatName.Attack] = newStage;
    return [
      {
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "moxie",
        targetIds: [context.self.id],
      },
      {
        type: BattleEventType.StatChanged,
        targetId: context.self.id,
        stat: StatName.Attack,
        stages: 1,
      },
    ];
  },
};

const multiscale: AbilityHandler = {
  id: "multiscale",
  onDamageModify: (context) => {
    if (!context.isAttacker && context.self.currentHp === context.self.maxHp) {
      return 0.5;
    }
    return 1.0;
  },
};

const waterAbsorb: AbilityHandler = {
  id: "water-absorb",
  onTypeImmunity: (context) => {
    if (context.moveType !== PokemonType.Water) {
      return { blocked: false, events: [] };
    }
    const events: BattleEvent[] = [
      {
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "water-absorb",
        targetIds: [context.self.id],
      },
    ];
    const healAmount = Math.min(
      context.self.maxHp - context.self.currentHp,
      Math.floor(context.self.maxHp * 0.25),
    );
    if (healAmount > 0) {
      context.self.currentHp += healAmount;
      events.push({
        type: BattleEventType.HpRestored,
        pokemonId: context.self.id,
        amount: healAmount,
      });
    }
    return { blocked: true, events };
  },
};

const flashFire: AbilityHandler = {
  id: "flash-fire",
  onTypeImmunity: (context) => {
    if (context.moveType !== PokemonType.Fire) {
      return { blocked: false, events: [] };
    }
    context.self.abilityFirstTriggered = true;
    return {
      blocked: true,
      events: [
        {
          type: BattleEventType.AbilityActivated,
          pokemonId: context.self.id,
          abilityId: "flash-fire",
          targetIds: [context.self.id],
        },
      ],
    };
  },
  onDamageModify: (context) => {
    if (
      context.isAttacker &&
      context.move.type === PokemonType.Fire &&
      context.self.abilityFirstTriggered
    ) {
      return 1.5;
    }
    return 1.0;
  },
};

const voltAbsorb: AbilityHandler = {
  id: "volt-absorb",
  onTypeImmunity: (context) => {
    if (context.moveType !== PokemonType.Electric) {
      return { blocked: false, events: [] };
    }
    const events: BattleEvent[] = [
      {
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "volt-absorb",
        targetIds: [context.self.id],
      },
    ];
    const healAmount = Math.min(
      context.self.maxHp - context.self.currentHp,
      Math.floor(context.self.maxHp * 0.25),
    );
    if (healAmount > 0) {
      context.self.currentHp += healAmount;
      events.push({
        type: BattleEventType.HpRestored,
        pokemonId: context.self.id,
        amount: healAmount,
      });
    }
    return { blocked: true, events };
  },
};

// Batch B abilities

const vitalSpirit: AbilityHandler = {
  id: "vital-spirit",
  onStatusBlocked: (context) => {
    if (context.status !== StatusType.Asleep) {
      return { blocked: false, events: [] };
    }
    return {
      blocked: true,
      events: [
        {
          type: BattleEventType.AbilityActivated,
          pokemonId: context.self.id,
          abilityId: "vital-spirit",
          targetIds: [context.self.id],
        },
      ],
    };
  },
};

const insomnia: AbilityHandler = {
  id: "insomnia",
  onStatusBlocked: (context) => {
    if (context.status !== StatusType.Asleep) {
      return { blocked: false, events: [] };
    }
    return {
      blocked: true,
      events: [
        {
          type: BattleEventType.AbilityActivated,
          pokemonId: context.self.id,
          abilityId: "insomnia",
          targetIds: [context.self.id],
        },
      ],
    };
  },
};

const cursedBody: AbilityHandler = {
  id: "cursed-body",
  onAfterDamageReceived: (context) => {
    if (context.self.currentHp <= 0) {
      return [];
    }
    if (!context.move.flags?.contact || context.contactNullified) {
      return [];
    }
    if (context.random() >= 0.3) {
      return [];
    }
    const alreadyConfused = context.attacker.volatileStatuses.some(
      (s) => s.type === StatusType.Confused,
    );
    if (alreadyConfused) {
      return [];
    }
    const duration = Math.floor(context.random() * 4) + 1;
    context.attacker.volatileStatuses.push({ type: StatusType.Confused, remainingTurns: duration });
    return [
      {
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "cursed-body",
        targetIds: [context.attacker.id],
      },
      {
        type: BattleEventType.StatusApplied,
        targetId: context.attacker.id,
        status: StatusType.Confused,
      },
    ];
  },
};

const rockHead: AbilityHandler = {
  id: "rock-head",
  blocksRecoil: true,
};

const limber: AbilityHandler = {
  id: "limber",
  onStatusBlocked: (context) => {
    if (context.status !== StatusType.Paralyzed) {
      return { blocked: false, events: [] };
    }
    return {
      blocked: true,
      events: [
        {
          type: BattleEventType.AbilityActivated,
          pokemonId: context.self.id,
          abilityId: "limber",
          targetIds: [context.self.id],
        },
      ],
    };
  },
};

const ironFist: AbilityHandler = {
  id: "iron-fist",
  onDamageModify: (context) => {
    if (context.isAttacker && context.move.flags?.punch) {
      return 1.2;
    }
    return 1.0;
  },
};

const MAJOR_STATUSES_FOR_CURE: ReadonlySet<StatusTypeAlias> = new Set<StatusTypeAlias>([
  StatusType.Burned,
  StatusType.Frozen,
  StatusType.Paralyzed,
  StatusType.Poisoned,
  StatusType.BadlyPoisoned,
  StatusType.Asleep,
]);

const naturalCure: AbilityHandler = {
  id: "natural-cure",
  onEndTurn: (context) => {
    const cured = context.self.statusEffects.filter((s) => MAJOR_STATUSES_FOR_CURE.has(s.type));
    if (cured.length === 0) {
      return [];
    }
    context.self.statusEffects = context.self.statusEffects.filter(
      (s) => !MAJOR_STATUSES_FOR_CURE.has(s.type),
    );
    return [
      ...cured.map((s) => ({
        type: BattleEventType.StatusRemoved as typeof BattleEventType.StatusRemoved,
        targetId: context.self.id,
        status: s.type,
      })),
      {
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "natural-cure",
        targetIds: [context.self.id],
      },
    ];
  },
};

const battleArmor: AbilityHandler = {
  id: "battle-armor",
  preventsCrit: true,
};

// Batch C abilities

const effectSpore: AbilityHandler = {
  id: "effect-spore",
  onAfterDamageReceived: (context) => {
    if (!context.move.flags?.contact || context.contactNullified) {
      return [];
    }
    if (hasMajorStatus(context.attacker)) {
      return [];
    }
    if (context.random() >= 0.3) {
      return [];
    }
    const roll = context.random();
    const status =
      roll < 1 / 3 ? StatusType.Asleep : roll < 2 / 3 ? StatusType.Poisoned : StatusType.Paralyzed;
    context.attacker.statusEffects.push({ type: status, remainingTurns: null });
    return [
      {
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "effect-spore",
        targetIds: [context.attacker.id],
      },
      { type: BattleEventType.StatusApplied, targetId: context.attacker.id, status },
    ];
  },
};

const cloudNine: AbilityHandler = {
  id: "cloud-nine",
  suppressesWeatherEffects: true,
};

const shellArmor: AbilityHandler = {
  id: "shell-armor",
  preventsCrit: true,
};

const hyperCutter: AbilityHandler = {
  id: "hyper-cutter",
  onStatChangeBlocked: (context) => {
    if (context.stat !== StatName.Attack || context.stages >= 0) {
      return { blocked: false, events: [] };
    }
    return {
      blocked: true,
      events: [
        {
          type: BattleEventType.AbilityActivated,
          pokemonId: context.self.id,
          abilityId: "hyper-cutter",
          targetIds: [context.self.id],
        },
      ],
    };
  },
};

const oblivious: AbilityHandler = {
  id: "oblivious",
  onStatusBlocked: (context) => {
    if (context.status !== StatusType.Infatuated) {
      return { blocked: false, events: [] };
    }
    return {
      blocked: true,
      events: [
        {
          type: BattleEventType.AbilityActivated,
          pokemonId: context.self.id,
          abilityId: "oblivious",
          targetIds: [context.self.id],
        },
      ],
    };
  },
};

const flameBody: AbilityHandler = {
  id: "flame-body",
  onAfterDamageReceived: (context) => {
    if (!context.move.flags?.contact || context.contactNullified) {
      return [];
    }
    if (context.random() >= 0.3) {
      return [];
    }
    if (hasMajorStatus(context.attacker)) {
      return [];
    }
    context.attacker.statusEffects.push({ type: StatusType.Burned, remainingTurns: null });
    return [
      {
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "flame-body",
        targetIds: [context.attacker.id],
      },
      {
        type: BattleEventType.StatusApplied,
        targetId: context.attacker.id,
        status: StatusType.Burned,
      },
    ];
  },
};

const trace: AbilityHandler = {
  id: "trace",
  onBattleStart: (context) => {
    const enemies = [...context.state.pokemon.values()].filter(
      (p) => p.playerId !== context.self.playerId && p.currentHp > 0,
    );
    if (enemies.length === 0) {
      return [];
    }
    const nearest = enemies.reduce((a, b) =>
      chebyshev(context.self.position, a.position) <= chebyshev(context.self.position, b.position)
        ? a
        : b,
    );
    const copiedId = nearest.abilityId;
    if (!copiedId) {
      return [];
    }
    context.self.abilityId = copiedId;
    return [
      {
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "trace",
        targetIds: [nearest.id],
      },
      {
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: copiedId,
        targetIds: [context.self.id],
      },
    ];
  },
};

const swiftSwim: AbilityHandler = {
  id: "swift-swim",
  weatherSpeedBoost: { weather: Weather.Rain, multiplier: 2 },
};

// Batch D abilities

const poisonTouch: AbilityHandler = {
  id: "poison-touch",
  onAfterDamageDealt: (context) => {
    if (!context.move.flags?.contact) {
      return [];
    }
    if (hasMajorStatus(context.target)) {
      return [];
    }
    if (context.random() >= 0.3) {
      return [];
    }
    context.target.statusEffects.push({ type: StatusType.BadlyPoisoned, remainingTurns: null });
    return [
      {
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "poison-touch",
        targetIds: [context.target.id],
      },
      {
        type: BattleEventType.StatusApplied,
        targetId: context.target.id,
        status: StatusType.BadlyPoisoned,
      },
    ];
  },
};

const filter: AbilityHandler = {
  id: "filter",
  onDamageModify: (context) => {
    if (context.isAttacker) {
      return 1.0;
    }
    if (context.effectiveness <= 1.0) {
      return 1.0;
    }
    return 0.75;
  },
};

const compoundEyes: AbilityHandler = {
  id: "compound-eyes",
  accuracyMultiplier: 1.3,
};

const swarm = pinchBooster("swarm", PokemonType.Bug);

const waterVeil: AbilityHandler = {
  id: "water-veil",
  onStatusBlocked: (context) => {
    if (context.status !== StatusType.Burned) {
      return { blocked: false, events: [] };
    }
    return {
      blocked: true,
      events: [
        {
          type: BattleEventType.AbilityActivated,
          pokemonId: context.self.id,
          abilityId: "water-veil",
          targetIds: [context.self.id],
        },
      ],
    };
  },
};

const pressure: AbilityHandler = {
  id: "pressure",
  targetedCtBonus: 50,
};

const shieldDust: AbilityHandler = {
  id: "shield-dust",
};

const innerFocus: AbilityHandler = {
  id: "inner-focus",
};

const chlorophyll: AbilityHandler = {
  id: "chlorophyll",
  weatherSpeedBoost: { weather: Weather.Sun, multiplier: 2 },
};

// Téméraire (reckless): +20% damage on moves that inflict recoil. Silent (damage modifier).
const reckless: AbilityHandler = {
  id: "reckless",
  onDamageModify: (context) => {
    if (!context.isAttacker) {
      return 1.0;
    }
    const hasRecoil = context.move.effects.some((effect) => effect.kind === EffectKind.Recoil);
    return hasRecoil ? 1.2 : 1.0;
  },
};

// Rivalité (rivalry): +25% vs same-gender target, -25% vs opposite gender, neutral if either is
// genderless. Silent (damage modifier).
const rivalry: AbilityHandler = {
  id: "rivalry",
  onDamageModify: (context) => {
    if (!context.isAttacker) {
      return 1.0;
    }
    const selfGender = context.self.gender;
    const opponentGender = context.opponent.gender;
    if (selfGender === PokemonGender.Genderless || opponentGender === PokemonGender.Genderless) {
      return 1.0;
    }
    return selfGender === opponentGender ? 1.25 : 0.75;
  },
};

// Lentiteintée (tinted-lens): "not very effective" hits deal double damage. Silent.
const tintedLens: AbilityHandler = {
  id: "tinted-lens",
  onDamageModify: (context) => {
    if (context.isAttacker && context.effectiveness < 1) {
      return 2.0;
    }
    return 1.0;
  },
};

// Régé-Force (regenerator): no switch mechanic in this tactical game (cf. plan 136), reinterpreted
// as a small passive heal (1/16 max HP) at end of turn.
const regenerator: AbilityHandler = {
  id: "regenerator",
  onEndTurn: (context) => {
    if (context.self.currentHp <= 0) {
      return [];
    }
    const healAmount = Math.min(
      context.self.maxHp - context.self.currentHp,
      Math.max(1, Math.floor(context.self.maxHp / 16)),
    );
    if (healAmount <= 0) {
      return [];
    }
    context.self.currentHp += healAmount;
    return [
      {
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "regenerator",
        targetIds: [context.self.id],
      },
      {
        type: BattleEventType.HpRestored,
        pokemonId: context.self.id,
        amount: healAmount,
      },
    ];
  },
};

// Sniper (sniper): critical hits deal 1.5x more (stacks with the 1.5x crit mod → 2.25x). Silent.
const sniper: AbilityHandler = {
  id: "sniper",
  onDamageModify: (context) => (context.isAttacker && context.isCrit ? 1.5 : 1.0),
};

// Colérique (anger-point): taking a critical hit maximizes Attack (+6 stages).
const angerPoint: AbilityHandler = {
  id: "anger-point",
  onAfterDamageReceived: (context) => {
    if (context.self.currentHp <= 0 || !context.isCrit) {
      return [];
    }
    const currentStage = context.self.statStages[StatName.Attack];
    if (currentStage >= 6) {
      return [];
    }
    context.self.statStages[StatName.Attack] = 6;
    return [
      {
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "anger-point",
        targetIds: [context.self.id],
      },
      {
        type: BattleEventType.StatChanged,
        targetId: context.self.id,
        stat: StatName.Attack,
        stages: 6 - currentStage,
      },
    ];
  },
};

// Acharné (defiant): when an opponent lowers one of our stats, raise Attack +2.
const defiant: AbilityHandler = {
  id: "defiant",
  onAfterStatLowered: (context) => {
    const currentStage = context.self.statStages[StatName.Attack];
    const newStage = Math.min(6, currentStage + 2);
    if (newStage === currentStage) {
      return [];
    }
    context.self.statStages[StatName.Attack] = newStage;
    return [
      {
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "defiant",
        targetIds: [context.self.id],
      },
      {
        type: BattleEventType.StatChanged,
        targetId: context.self.id,
        stat: StatName.Attack,
        stages: newStage - currentStage,
      },
    ];
  },
};

// Battant (competitive): when an opponent lowers one of our stats, raise Sp. Atk +2.
const competitive: AbilityHandler = {
  id: "competitive",
  onAfterStatLowered: (context) => {
    const currentStage = context.self.statStages[StatName.SpAttack];
    const newStage = Math.min(6, currentStage + 2);
    if (newStage === currentStage) {
      return [];
    }
    context.self.statStages[StatName.SpAttack] = newStage;
    return [
      {
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "competitive",
        targetIds: [context.self.id],
      },
      {
        type: BattleEventType.StatChanged,
        targetId: context.self.id,
        stat: StatName.SpAttack,
        stages: newStage - currentStage,
      },
    ];
  },
};

// Inconscient (unaware): ignores the opponent's stat stages in the damage formula.
// Implemented by id in damage-calculator.ts (marker handler).
const unaware: AbilityHandler = {
  id: "unaware",
};

// Querelleur (scrappy): Normal/Fighting moves ignore Ghost's type immunity.
// Implemented by id in damage-calculator.ts + effect-processor.ts (marker handler).
const scrappy: AbilityHandler = {
  id: "scrappy",
};

// Multi-Coups (skill-link): variable-hit moves always land the maximum number of hits.
// Implemented by id in handle-damage.ts (marker handler).
const skillLink: AbilityHandler = {
  id: "skill-link",
};

// ===== Plan 137 — Tier B =====

/** Raise one stat stage by +1 (clamped at +6), emitting AbilityActivated + StatChanged. */
function raiseStatByOne(self: PokemonInstance, stat: StatName, abilityId: string): BattleEvent[] {
  const currentStage = self.statStages[stat];
  if (currentStage >= 6) {
    return [];
  }
  self.statStages[stat] = currentStage + 1;
  return [
    {
      type: BattleEventType.AbilityActivated,
      pokemonId: self.id,
      abilityId,
      targetIds: [self.id],
    },
    {
      type: BattleEventType.StatChanged,
      targetId: self.id,
      stat,
      stages: 1,
    },
  ];
}

/** End-of-turn heal of max(1, floor(maxHp/16)), gated on the given effective weather. */
function makeWeatherHeal(abilityId: string, weather: Weather): AbilityHandler {
  return {
    id: abilityId,
    onEndTurn: (context) => {
      if (context.weather !== weather || context.self.currentHp <= 0) {
        return [];
      }
      const healAmount = Math.min(
        context.self.maxHp - context.self.currentHp,
        Math.max(1, Math.floor(context.self.maxHp / 16)),
      );
      if (healAmount <= 0) {
        return [];
      }
      context.self.currentHp += healAmount;
      return [
        {
          type: BattleEventType.AbilityActivated,
          pokemonId: context.self.id,
          abilityId,
          targetIds: [context.self.id],
        },
        {
          type: BattleEventType.HpRestored,
          pokemonId: context.self.id,
          amount: healAmount,
        },
      ];
    },
  };
}

// Cœur de Coq (big-pecks): blocks Defense drops.
const bigPecks: AbilityHandler = {
  id: "big-pecks",
  onStatChangeBlocked: (context) => {
    if (context.stat !== StatName.Defense || context.stages >= 0) {
      return { blocked: false, events: [] };
    }
    return {
      blocked: true,
      events: [
        {
          type: BattleEventType.AbilityActivated,
          pokemonId: context.self.id,
          abilityId: "big-pecks",
          targetIds: [context.self.id],
        },
      ],
    };
  },
};

// Lumiattirance (illuminate): blocks Accuracy drops (Gen 9 effect).
const illuminate: AbilityHandler = {
  id: "illuminate",
  onStatChangeBlocked: (context) => {
    if (context.stat !== StatName.Accuracy || context.stages >= 0) {
      return { blocked: false, events: [] };
    }
    return {
      blocked: true,
      events: [
        {
          type: BattleEventType.AbilityActivated,
          pokemonId: context.self.id,
          abilityId: "illuminate",
          targetIds: [context.self.id],
        },
      ],
    };
  },
};

// Vaccin (immunity): immune to poison (Poisoned + BadlyPoisoned).
const immunity: AbilityHandler = {
  id: "immunity",
  onStatusBlocked: (context) => {
    if (context.status !== StatusType.Poisoned && context.status !== StatusType.BadlyPoisoned) {
      return { blocked: false, events: [] };
    }
    return {
      blocked: true,
      events: [
        {
          type: BattleEventType.AbilityActivated,
          pokemonId: context.self.id,
          abilityId: "immunity",
          targetIds: [context.self.id],
        },
      ],
    };
  },
};

// Baigne Sable (sand-rush): doubles speed (CT gain) under Sandstorm.
const sandRush: AbilityHandler = {
  id: "sand-rush",
  weatherSpeedBoost: { weather: Weather.Sandstorm, multiplier: 2 },
};

// Rideau Neige (snow-cloak): +1 evasion under Snow.
const snowCloak: AbilityHandler = {
  id: "snow-cloak",
  weatherEvasionBoost: { weather: Weather.Snow, stages: 1 },
};

// Phobique (rattled): hit by a Dark/Ghost/Bug move → +1 Speed.
const RATTLED_TRIGGER_TYPES: ReadonlySet<PokemonType> = new Set<PokemonType>([
  PokemonType.Dark,
  PokemonType.Ghost,
  PokemonType.Bug,
]);
const rattled: AbilityHandler = {
  id: "rattled",
  onAfterDamageReceived: (context) => {
    if (
      context.self.currentHp <= 0 ||
      !RATTLED_TRIGGER_TYPES.has(context.move.type) ||
      context.damageDealt <= 0
    ) {
      return [];
    }
    return raiseStatByOne(context.self, StatName.Speed, "rattled");
  },
};

// Mue (shed-skin): 33% chance to cure a major status at end of turn.
const shedSkin: AbilityHandler = {
  id: "shed-skin",
  onEndTurn: (context) => {
    const cured = context.self.statusEffects.filter((s) => MAJOR_STATUSES_FOR_CURE.has(s.type));
    if (cured.length === 0 || context.random() >= 1 / 3) {
      return [];
    }
    context.self.statusEffects = context.self.statusEffects.filter(
      (s) => !MAJOR_STATUSES_FOR_CURE.has(s.type),
    );
    return [
      ...cured.map((s) => ({
        type: BattleEventType.StatusRemoved as typeof BattleEventType.StatusRemoved,
        targetId: context.self.id,
        status: s.type,
      })),
      {
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "shed-skin",
        targetIds: [context.self.id],
      },
    ];
  },
};

// Hydratation (hydration): cures major status at end of turn under Rain.
const hydration: AbilityHandler = {
  id: "hydration",
  onEndTurn: (context) => {
    if (context.weather !== Weather.Rain) {
      return [];
    }
    const cured = context.self.statusEffects.filter((s) => MAJOR_STATUSES_FOR_CURE.has(s.type));
    if (cured.length === 0) {
      return [];
    }
    context.self.statusEffects = context.self.statusEffects.filter(
      (s) => !MAJOR_STATUSES_FOR_CURE.has(s.type),
    );
    return [
      ...cured.map((s) => ({
        type: BattleEventType.StatusRemoved as typeof BattleEventType.StatusRemoved,
        targetId: context.self.id,
        status: s.type,
      })),
      {
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "hydration",
        targetIds: [context.self.id],
      },
    ];
  },
};

// Cuvette (rain-dish): heals ~1/16 max HP per turn under Rain.
const rainDish = makeWeatherHeal("rain-dish", Weather.Rain);

// Corps Gel (ice-body): heals ~1/16 max HP per turn under Snow.
const iceBody = makeWeatherHeal("ice-body", Weather.Snow);

// Écaille Spéciale (marvel-scale): physical damage taken ÷1.5 while a major status is active.
const marvelScale: AbilityHandler = {
  id: "marvel-scale",
  onDamageModify: (context) => {
    if (
      context.isAttacker ||
      context.move.category !== Category.Physical ||
      !hasMajorStatus(context.self)
    ) {
      return 1.0;
    }
    return 1 / 1.5;
  },
};

// Cœur Noble (justified): hit by a Dark move → +1 Attack.
const justified: AbilityHandler = {
  id: "justified",
  onAfterDamageReceived: (context) => {
    if (
      context.self.currentHp <= 0 ||
      context.move.type !== PokemonType.Dark ||
      context.damageDealt <= 0
    ) {
      return [];
    }
    return raiseStatByOne(context.self, StatName.Attack, "justified");
  },
};

// Sécheresse (drought): summons harsh sunlight on entry (5 turns).
const drought: AbilityHandler = {
  id: "drought",
  weatherAutoSetter: { weather: Weather.Sun, turns: 5 },
};

// Impassible (steadfast): +1 Speed whenever the bearer flinches.
const steadfast: AbilityHandler = {
  id: "steadfast",
  onFlinch: (context) => raiseStatByOne(context.self, StatName.Speed, "steadfast"),
};

// ===== Plan 138 — Tier C =====
// (Groupe A — Engrais/Brasier/Torrent/Essaim — déjà implémenté via `pinchBooster`.)

/** End-of-turn HP loss of max(1, floor(maxHp * fraction)); may KO (indirect-damage model). */
function weatherEndTurnLoss(
  self: PokemonInstance,
  abilityId: string,
  fraction: number,
): BattleEvent[] {
  if (self.currentHp <= 0) {
    return [];
  }
  const loss = Math.min(self.currentHp, Math.max(1, Math.floor(self.maxHp * fraction)));
  self.currentHp -= loss;
  const events: BattleEvent[] = [
    { type: BattleEventType.AbilityActivated, pokemonId: self.id, abilityId, targetIds: [self.id] },
    { type: BattleEventType.DamageDealt, targetId: self.id, amount: loss, effectiveness: 1 },
  ];
  if (self.currentHp <= 0) {
    events.push({ type: BattleEventType.PokemonKo, pokemonId: self.id, countdownStart: 0 });
  }
  return events;
}

/** Apply several signed stat-stage changes with a single AbilityActivated, clamped to [-6, 6]. */
function applyStatChanges(
  self: PokemonInstance,
  abilityId: string,
  changes: { stat: StatName; delta: number }[],
): BattleEvent[] {
  const events: BattleEvent[] = [
    { type: BattleEventType.AbilityActivated, pokemonId: self.id, abilityId, targetIds: [self.id] },
  ];
  let anyApplied = false;
  for (const { stat, delta } of changes) {
    const current = self.statStages[stat];
    const next = Math.max(-6, Math.min(6, current + delta));
    if (next !== current) {
      self.statStages[stat] = next;
      anyApplied = true;
      events.push({
        type: BattleEventType.StatChanged,
        targetId: self.id,
        stat,
        stages: next - current,
      });
    }
  }
  return anyApplied ? events : [];
}

// --- B : météo-dégâts ---

// Force Soleil (solar-power): ×1.5 special damage in harsh sunlight; loses 1/8 max HP each sunny turn.
const solarPower: AbilityHandler = {
  id: "solar-power",
  onDamageModify: (context) => {
    if (
      context.isAttacker &&
      context.weather === Weather.Sun &&
      context.move.category === Category.Special
    ) {
      return 1.5;
    }
    return 1.0;
  },
  onEndTurn: (context) =>
    context.weather === Weather.Sun ? weatherEndTurnLoss(context.self, "solar-power", 1 / 8) : [],
};

// Force Sable (sand-force): ×1.3 to Rock/Ground/Steel moves during a Sandstorm.
const SAND_FORCE_TYPES: ReadonlySet<PokemonType> = new Set<PokemonType>([
  PokemonType.Rock,
  PokemonType.Ground,
  PokemonType.Steel,
]);
const sandForce: AbilityHandler = {
  id: "sand-force",
  onDamageModify: (context) => {
    if (
      context.isAttacker &&
      context.weather === Weather.Sandstorm &&
      SAND_FORCE_TYPES.has(context.move.type)
    ) {
      return 1.3;
    }
    return 1.0;
  },
};

// Peau Sèche (dry-skin): Rain heals 1/8, Sun burns 1/8; Fire hits ×1.25; Water is absorbed as heal.
const drySkin: AbilityHandler = {
  id: "dry-skin",
  onTypeImmunity: (context) => {
    if (context.moveType !== PokemonType.Water) {
      return { blocked: false, events: [] };
    }
    const events: BattleEvent[] = [
      {
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "dry-skin",
        targetIds: [context.self.id],
      },
    ];
    const heal = Math.min(
      context.self.maxHp - context.self.currentHp,
      Math.floor(context.self.maxHp * 0.25),
    );
    if (heal > 0) {
      context.self.currentHp += heal;
      events.push({
        type: BattleEventType.HpRestored,
        pokemonId: context.self.id,
        amount: heal,
      });
    }
    return { blocked: true, events };
  },
  onDamageModify: (context) => {
    if (!context.isAttacker && context.move.type === PokemonType.Fire) {
      return 1.25;
    }
    return 1.0;
  },
  onEndTurn: (context) => {
    if (context.self.currentHp <= 0) {
      return [];
    }
    if (context.weather === Weather.Rain) {
      const heal = Math.min(
        context.self.maxHp - context.self.currentHp,
        Math.max(1, Math.floor(context.self.maxHp / 8)),
      );
      if (heal <= 0) {
        return [];
      }
      context.self.currentHp += heal;
      return [
        {
          type: BattleEventType.AbilityActivated,
          pokemonId: context.self.id,
          abilityId: "dry-skin",
          targetIds: [context.self.id],
        },
        { type: BattleEventType.HpRestored, pokemonId: context.self.id, amount: heal },
      ];
    }
    if (context.weather === Weather.Sun) {
      return weatherEndTurnLoss(context.self, "dry-skin", 1 / 8);
    }
    return [];
  },
};

// Feuille Garde (leaf-guard): blocks major-status infliction in harsh sunlight.
const leafGuard: AbilityHandler = {
  id: "leaf-guard",
  onStatusBlocked: (context) => {
    if (context.weather !== Weather.Sun || !MAJOR_STATUSES_FOR_CURE.has(context.status)) {
      return { blocked: false, events: [] };
    }
    return {
      blocked: true,
      events: [
        {
          type: BattleEventType.AbilityActivated,
          pokemonId: context.self.id,
          abilityId: "leaf-guard",
          targetIds: [context.self.id],
        },
      ],
    };
  },
};

// Envelocape (overcoat): immune to powder moves.
const overcoat: AbilityHandler = {
  id: "overcoat",
  onMoveImmunity: (context) => {
    if (context.move.flags?.powder !== true) {
      return { blocked: false, events: [] };
    }
    return {
      blocked: true,
      events: [
        {
          type: BattleEventType.AbilityActivated,
          pokemonId: context.self.id,
          abilityId: "overcoat",
          targetIds: [context.self.id],
        },
      ],
    };
  },
};

// --- C : réactif / stat ---

// Armurouillée (weak-armor): hit by a physical move → Defense -1, Speed +2.
const weakArmor: AbilityHandler = {
  id: "weak-armor",
  onAfterDamageReceived: (context) => {
    if (
      context.self.currentHp <= 0 ||
      context.move.category !== Category.Physical ||
      context.damageDealt <= 0
    ) {
      return [];
    }
    return applyStatChanges(context.self, "weak-armor", [
      { stat: StatName.Defense, delta: -1 },
      { stat: StatName.Speed, delta: 2 },
    ]);
  },
};

// Pieds Confus (tangled-feet): incoming accuracy halved while the holder is confused.
const tangledFeet: AbilityHandler = {
  id: "tangled-feet",
  onEvasionModify: (context) =>
    context.self.volatileStatuses.some((v) => v.type === StatusType.Confused) ? 0.5 : 1.0,
};

// Pied Véloce (quick-feet): ×1.5 Speed (and ignores the paralysis cut) while a major status is active.
const quickFeet: AbilityHandler = {
  id: "quick-feet",
  statusSpeedBoost: { multiplier: 1.5 },
};

// Anti-Bruit (soundproof): immune to sound-based moves.
const soundproof: AbilityHandler = {
  id: "soundproof",
  onMoveImmunity: (context) => {
    if (context.move.flags?.sound !== true) {
      return { blocked: false, events: [] };
    }
    return {
      blocked: true,
      events: [
        {
          type: BattleEventType.AbilityActivated,
          pokemonId: context.self.id,
          abilityId: "soundproof",
          targetIds: [context.self.id],
        },
      ],
    };
  },
};

// Télécharge (download): on entry, +1 Attack or +1 Sp. Atk vs the nearest foe's lower defense.
const download: AbilityHandler = {
  id: "download",
  onBattleStart: (context) => {
    let nearest: PokemonInstance | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const pokemon of context.state.pokemon.values()) {
      if (pokemon.playerId === context.self.playerId || pokemon.currentHp <= 0) {
        continue;
      }
      const distance = chebyshev(context.self.position, pokemon.position);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = pokemon;
      }
    }
    if (nearest === undefined) {
      return [];
    }
    const boostedStat =
      nearest.combatStats.defense <= nearest.combatStats.spDefense
        ? StatName.Attack
        : StatName.SpAttack;
    return raiseStatByOne(context.self, boostedStat, "download");
  },
};

// Peau Miracle (wonder-skin): incoming status moves have their accuracy halved.
const wonderSkin: AbilityHandler = {
  id: "wonder-skin",
  onEvasionModify: (context) => (context.move.category === Category.Status ? 0.5 : 1.0),
};

// --- D : medium ---

// Agitation (hustle): +50% physical damage, -20% physical accuracy.
const hustle: AbilityHandler = {
  id: "hustle",
  onDamageModify: (context) => {
    if (context.isAttacker && context.move.category === Category.Physical) {
      return 1.5;
    }
    return 1.0;
  },
  onAccuracyModify: (context) => (context.move.category === Category.Physical ? 0.8 : 1.0),
};

// Analyste (analytic): ×1.3 damage when the holder acts after the target.
const analytic: AbilityHandler = {
  id: "analytic",
  onDamageModify: (context) => (context.isAttacker && context.targetAlreadyActed ? 1.3 : 1.0),
};

// Puanteur (stench): 10% chance to flinch the target on a damaging hit.
const stench: AbilityHandler = {
  id: "stench",
  onAfterDamageDealt: (context) => {
    if (context.damageDealt <= 0 || context.random() >= 0.1) {
      return [];
    }
    if (context.target.volatileStatuses.some((v) => v.type === StatusType.Flinch)) {
      return [];
    }
    context.target.volatileStatuses.push({ type: StatusType.Flinch, remainingTurns: 1 });
    return [
      {
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "stench",
        targetIds: [context.target.id],
      },
      {
        type: BattleEventType.StatusApplied,
        targetId: context.target.id,
        status: StatusType.Flinch,
      },
    ];
  },
};

// Suintement (liquid-ooze): draining the holder backfires — the drainer takes the heal as damage.
const liquidOoze: AbilityHandler = {
  id: "liquid-ooze",
  onDrainAttempt: (context) => ({
    redirect: true,
    events: [
      {
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "liquid-ooze",
        targetIds: [context.attacker.id],
      },
    ],
  }),
};

// Boom Final (aftermath): KO'd by a contact move → the attacker loses 1/4 of its max HP.
const aftermath: AbilityHandler = {
  id: "aftermath",
  onAfterDamageReceived: (context) => {
    if (
      context.self.currentHp > 0 ||
      context.move.flags?.contact !== true ||
      context.contactNullified
    ) {
      return [];
    }
    if (context.attacker.currentHp <= 0) {
      return [];
    }
    // Moiteur (damp) on the attacker cancels the Boom Final recoil it would otherwise take (Gen 4+,
    // relational: the recoil recipient carries Moiteur — mirrors the explosion gate, not field-wide).
    if (context.attacker.abilityId === "damp") {
      return [];
    }
    const loss = Math.min(
      context.attacker.currentHp,
      Math.max(1, Math.floor(context.attacker.maxHp / 4)),
    );
    context.attacker.currentHp -= loss;
    const events: BattleEvent[] = [
      {
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "aftermath",
        targetIds: [context.attacker.id],
      },
      {
        type: BattleEventType.DamageDealt,
        targetId: context.attacker.id,
        amount: loss,
        effectiveness: 1,
      },
    ];
    if (context.attacker.currentHp <= 0) {
      events.push({
        type: BattleEventType.PokemonKo,
        pokemonId: context.attacker.id,
        countdownStart: 0,
      });
    }
    return events;
  },
};

// Infiltration (infiltrator): handled engine-side via `abilityId` checks (substitute / screens /
// Voile Sacré / Brume bypass). The data entry only needs to register the id for the team builder.
const infiltrator: AbilityHandler = {
  id: "infiltrator",
};

// ===== Plan 139 — Modèle effet secondaire =====

// Sérénité (serene-grace): doubles the chance of a move's secondary effects (capped at 100%).
// Implemented by id in effect-processor.ts (marker handler).
const sereneGrace: AbilityHandler = {
  id: "serene-grace",
};

// Sans Limite (sheer-force): a move carrying secondary effects loses them but gains ×1.3 power.
// Suppression is handled by id in effect-processor.ts; the boost is the onDamageModify below.
const sheerForce: AbilityHandler = {
  id: "sheer-force",
  onDamageModify: (context) => {
    if (context.isAttacker && moveHasSecondaryEffect(context.move)) {
      return 1.3;
    }
    return 1.0;
  },
};

// ===== Plan 140 — Brise Moule =====

// Brise Moule (mold-breaker): while attacking, the target's breakable abilities are ignored.
// Handled engine-side in `resolveDefensiveAbility` (id-check + `breakable` flag); the data entry
// only registers the id for the team builder. Silent (no AbilityActivated).
const moldBreaker: AbilityHandler = {
  id: "mold-breaker",
};

// ===== Plan 141 — Talents soutien & couplage objet =====

const HEALER_RADIUS = 2;
const HEALER_CURE_CHANCE = 0.3;

// Gloutonnerie (gluttony): pinch berries trigger at 50% HP instead of 25%. Handled in the
// `pinchStatBerry` item factory via `pokemon.abilityId`; the data entry only registers the id.
const gluttony: AbilityHandler = {
  id: "gluttony",
};

// Tension (unnerve): while this holder is alive, enemies cannot eat their berries. Enforced
// engine-side (berry-suppression) at each berry-consumption site; marker handler only.
const unnerve: AbilityHandler = {
  id: "unnerve",
};

// Moiteur (damp): blocks explosion moves (Destruction) and Boom Final (aftermath) recoil from any
// field position. Enforced engine-side (damp-system); marker handler only.
const damp: AbilityHandler = {
  id: "damp",
};

// Cœur Soin (healer): each end of turn, 30% chance (independent per ally) to cure the major
// statuses of each living ally within Manhattan r2. Volatile statuses are never cured.
const healer: AbilityHandler = {
  id: "healer",
  onEndTurn: (context) => {
    if (context.self.currentHp <= 0) {
      return [];
    }
    const events: BattleEvent[] = [];
    for (const ally of context.state.pokemon.values()) {
      if (
        ally.id === context.self.id ||
        ally.currentHp <= 0 ||
        ally.playerId !== context.self.playerId ||
        manhattanDistance(context.self.position, ally.position) > HEALER_RADIUS
      ) {
        continue;
      }
      const cured = ally.statusEffects.filter((s) => MAJOR_STATUSES_FOR_CURE.has(s.type));
      if (cured.length === 0 || context.random() >= HEALER_CURE_CHANCE) {
        continue;
      }
      ally.statusEffects = ally.statusEffects.filter((s) => !MAJOR_STATUSES_FOR_CURE.has(s.type));
      for (const status of cured) {
        events.push({
          type: BattleEventType.StatusRemoved,
          targetId: ally.id,
          status: status.type,
        });
      }
      events.push({
        type: BattleEventType.AbilityActivated,
        pokemonId: context.self.id,
        abilityId: "healer",
        targetIds: [ally.id],
      });
    }
    return events;
  },
};

// Garde Amie (friend-guard): allies within Manhattan r2 take ×0.75 damage. Applied engine-side in
// handle-damage (friend-guard-system); marker handler only.
const friendGuard: AbilityHandler = {
  id: "friend-guard",
};

export const abilityHandlers: AbilityHandler[] = [
  overgrow,
  blaze,
  torrent,
  keenEye,
  staticAbility,
  guts,
  synchronize,
  levitate,
  sturdy,
  intimidate,
  cuteCharm,
  thickFat,
  adaptability,
  clearBody,
  poisonPoint,
  technician,
  magnetPull,
  sandVeil,
  ownTempo,
  earlyBird,
  stickyHold,
  lightningRod,
  magicGuard,
  noGuard,
  moxie,
  multiscale,
  waterAbsorb,
  flashFire,
  voltAbsorb,
  vitalSpirit,
  insomnia,
  cursedBody,
  rockHead,
  limber,
  ironFist,
  naturalCure,
  battleArmor,
  effectSpore,
  cloudNine,
  shellArmor,
  hyperCutter,
  oblivious,
  flameBody,
  trace,
  swiftSwim,
  poisonTouch,
  filter,
  compoundEyes,
  swarm,
  waterVeil,
  pressure,
  shieldDust,
  innerFocus,
  chlorophyll,
  reckless,
  rivalry,
  tintedLens,
  regenerator,
  sniper,
  angerPoint,
  defiant,
  competitive,
  unaware,
  scrappy,
  skillLink,
  bigPecks,
  illuminate,
  immunity,
  sandRush,
  snowCloak,
  rattled,
  shedSkin,
  hydration,
  rainDish,
  iceBody,
  marvelScale,
  justified,
  drought,
  steadfast,
  solarPower,
  sandForce,
  drySkin,
  leafGuard,
  overcoat,
  weakArmor,
  tangledFeet,
  quickFeet,
  soundproof,
  download,
  wonderSkin,
  hustle,
  analytic,
  stench,
  liquidOoze,
  aftermath,
  infiltrator,
  sereneGrace,
  sheerForce,
  moldBreaker,
  gluttony,
  unnerve,
  damp,
  healer,
  friendGuard,
];
