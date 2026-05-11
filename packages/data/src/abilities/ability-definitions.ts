import type {
  AbilityHandler,
  BattleEvent,
  PokemonInstance,
  StatusType as StatusTypeAlias,
} from "@pokemon-tactic/core";
import {
  BattleEventType,
  Category,
  isImmuneToStatusByType,
  isMajorStatus,
  PokemonGender,
  PokemonType,
  StatName,
  StatusType,
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
    if (!context.move.flags?.contact) {
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

      const currentStage = pokemon.statStages[StatName.Attack];
      const newStage = Math.max(-6, currentStage - 1);
      const statChangeApplied = newStage !== currentStage;
      pokemon.statStages[StatName.Attack] = newStage;
      pokemon.volatileStatuses.push({
        type: StatusType.Intimidated,
        remainingTurns: -1,
        sourceId: context.self.id,
        statChangeApplied,
      });
      targetIds.push(pokemon.id);
      if (statChangeApplied) {
        events.push({
          type: BattleEventType.StatChanged,
          targetId: pokemon.id,
          stat: StatName.Attack,
          stages: -1,
        });
      }
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
    if (!context.move.flags?.contact) {
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
    if (!context.move.flags?.contact) {
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
    if (!context.move.flags?.contact) {
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
    if (!context.move.flags?.contact) {
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
    if (!context.move.flags?.contact) {
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
];
