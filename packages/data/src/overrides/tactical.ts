import type {
  Effect,
  MoveFlags,
  SemiInvulnerableState as SemiInvulnerableStateType,
  TargetingPattern,
  Weather as WeatherType,
} from "@pokemon-tactic/core";
import {
  AuraKind,
  DefensiveKind,
  EffectKind,
  EffectTarget,
  EffectTier,
  SemiInvulnerableState,
  StatName,
  StatusType,
  TargetingKind,
  Weather,
} from "@pokemon-tactic/core";

export interface TacticalOverride {
  targeting: TargetingPattern;
  effects: Effect[];
  recharge?: boolean;
  effectTier?: EffectTier;
  flags?: Partial<MoveFlags>;
  bypassAccuracy?: boolean;
  bypassProtect?: boolean;
  weatherSetter?: { type: WeatherType; turns: number };
  weatherBoostedType?: boolean;
  twoTurnCharge?: boolean;
  sunSkipsCharge?: boolean;
  semiInvulnerableState?: SemiInvulnerableStateType;
  chargeEffects?: Effect[];
  critRatio?: number;
  targetsAlly?: boolean;
}

export const tacticalOverrides: Record<string, TacticalOverride> = {
  "u-turn": {
    targeting: {
      kind: TargetingKind.HitAndRun,
      hitRange: { min: 1, max: 1 },
      retreatRange: { min: 1, max: 4 },
    },
    effects: [{ kind: EffectKind.Damage }],
  },
  "volt-switch": {
    targeting: {
      kind: TargetingKind.HitAndRun,
      hitRange: { min: 1, max: 2 },
      retreatRange: { min: 1, max: 4 },
    },
    effects: [{ kind: EffectKind.Damage }],
    flags: { contact: false },
  },
  "flip-turn": {
    targeting: {
      kind: TargetingKind.HitAndRun,
      hitRange: { min: 1, max: 1 },
      retreatRange: { min: 1, max: 4 },
    },
    effects: [{ kind: EffectKind.Damage }],
  },
  "razor-leaf": {
    targeting: { kind: TargetingKind.Slash },
    effects: [{ kind: EffectKind.Damage }],
  },
  "sleep-powder": {
    targeting: { kind: TargetingKind.Zone, radius: 1 },
    effects: [{ kind: EffectKind.Status, status: StatusType.Asleep, chance: 75 }],
    effectTier: EffectTier.MajorStatus,
  },
  "leech-seed": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      {
        kind: EffectKind.Status,
        status: StatusType.Seeded,
        chance: 100,
      },
    ],
  },
  "sludge-bomb": {
    targeting: { kind: TargetingKind.Blast, range: { min: 2, max: 4 }, radius: 1 },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Poisoned, chance: 30 },
    ],
  },
  ember: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Burned, chance: 10 },
    ],
  },
  scratch: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  smokescreen: {
    targeting: { kind: TargetingKind.Zone, radius: 1 },
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.Accuracy,
        stages: -1,
        target: EffectTarget.Targets,
      },
    ],
  },
  "dragon-breath": {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 2 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Paralyzed, chance: 30 },
    ],
  },
  "water-gun": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  tackle: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  withdraw: {
    targeting: { kind: TargetingKind.Self },
    effects: [
      { kind: EffectKind.StatChange, stat: StatName.Defense, stages: 1, target: EffectTarget.Self },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpDefense,
        stages: 1,
        target: EffectTarget.Self,
      },
    ],
    effectTier: EffectTier.DoubleBuff,
  },
  "bubble-beam": {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 2 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  gust: {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  "quick-attack": {
    targeting: { kind: TargetingKind.Dash, maxDistance: 2 },
    effects: [{ kind: EffectKind.Damage }],
  },
  "sand-attack": {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 2 } },
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.Accuracy,
        stages: -1,
        target: EffectTarget.Targets,
      },
    ],
  },
  "wing-attack": {
    targeting: { kind: TargetingKind.Slash },
    effects: [{ kind: EffectKind.Damage }],
  },

  thunderbolt: {
    targeting: { kind: TargetingKind.Line, length: 4 },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Paralyzed, chance: 10 },
    ],
  },
  "thunder-wave": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Status, status: StatusType.Paralyzed, chance: 100 }],
    effectTier: EffectTier.MajorStatus,
  },
  "double-team": {
    targeting: { kind: TargetingKind.Self },
    effects: [
      { kind: EffectKind.StatChange, stat: StatName.Evasion, stages: 1, target: EffectTarget.Self },
    ],
  },
  "volt-tackle": {
    targeting: { kind: TargetingKind.Dash, maxDistance: 3 },
    effects: [{ kind: EffectKind.Damage }],
  },

  "karate-chop": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  "seismic-toss": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  "bulk-up": {
    targeting: { kind: TargetingKind.Self },
    effects: [
      { kind: EffectKind.StatChange, stat: StatName.Attack, stages: 1, target: EffectTarget.Self },
      { kind: EffectKind.StatChange, stat: StatName.Defense, stages: 1, target: EffectTarget.Self },
    ],
    effectTier: EffectTier.DoubleBuff,
  },
  "rock-smash": {
    targeting: { kind: TargetingKind.Cross, size: 3 },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Defense,
        stages: -1,
        target: EffectTarget.Targets,
      },
    ],
  },

  psybeam: {
    targeting: { kind: TargetingKind.Line, length: 5 },
    effects: [{ kind: EffectKind.Damage }],
  },
  confusion: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 4 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  kinesis: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.Accuracy,
        stages: -1,
        target: EffectTarget.Targets,
      },
    ],
  },
  "calm-mind": {
    targeting: { kind: TargetingKind.Self },
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpAttack,
        stages: 1,
        target: EffectTarget.Self,
      },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpDefense,
        stages: 1,
        target: EffectTarget.Self,
      },
    ],
    effectTier: EffectTier.DoubleBuff,
  },

  lick: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Paralyzed, chance: 30 },
    ],
  },
  hypnosis: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Status, status: StatusType.Asleep, chance: 100 }],
    effectTier: EffectTier.MajorStatus,
  },
  "night-shade": {
    targeting: { kind: TargetingKind.Cross, size: 3 },
    effects: [{ kind: EffectKind.Damage }],
  },
  minimize: {
    targeting: { kind: TargetingKind.Self },
    effects: [
      { kind: EffectKind.StatChange, stat: StatName.Evasion, stages: 2, target: EffectTarget.Self },
    ],
    effectTier: EffectTier.MajorBuff,
  },

  "rock-throw": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  magnitude: {
    targeting: { kind: TargetingKind.Zone, radius: 2 },
    effects: [{ kind: EffectKind.Damage }],
  },
  "defense-curl": {
    targeting: { kind: TargetingKind.Self },
    effects: [
      { kind: EffectKind.StatChange, stat: StatName.Defense, stages: 1, target: EffectTarget.Self },
    ],
  },
  rollout: {
    targeting: { kind: TargetingKind.Dash, maxDistance: 4 },
    effects: [{ kind: EffectKind.Damage }],
  },

  bite: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  flamethrower: {
    targeting: { kind: TargetingKind.Line, length: 3 },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Burned, chance: 10 },
    ],
  },
  agility: {
    targeting: { kind: TargetingKind.Self },
    effects: [
      { kind: EffectKind.StatChange, stat: StatName.Speed, stages: 2, target: EffectTarget.Self },
    ],
    effectTier: EffectTier.MajorBuff,
  },
  "flame-wheel": {
    targeting: { kind: TargetingKind.Dash, maxDistance: 3 },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Burned, chance: 10 },
    ],
  },

  pound: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  sing: {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Status, status: StatusType.Asleep, chance: 100 }],
    effectTier: EffectTier.MajorStatus,
  },
  "body-slam": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Paralyzed, chance: 30 },
    ],
  },
  stockpile: {
    targeting: { kind: TargetingKind.Self },
    effects: [
      { kind: EffectKind.StatChange, stat: StatName.Defense, stages: 1, target: EffectTarget.Self },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpDefense,
        stages: 1,
        target: EffectTarget.Self,
      },
    ],
    effectTier: EffectTier.DoubleBuff,
  },

  "aurora-beam": {
    targeting: { kind: TargetingKind.Line, length: 3 },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Attack,
        stages: -1,
        target: EffectTarget.Targets,
      },
    ],
  },
  blizzard: {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 3 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Frozen, chance: 10 },
    ],
  },
  headbutt: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  "icy-wind": {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 2 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Speed,
        stages: -1,
        target: EffectTarget.Targets,
      },
    ],
  },

  protect: {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.Defensive, defenseKind: DefensiveKind.Protect }],
    effectTier: EffectTier.Reactive,
  },
  detect: {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.Defensive, defenseKind: DefensiveKind.Detect }],
    effectTier: EffectTier.Reactive,
  },
  "wide-guard": {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.Defensive, defenseKind: DefensiveKind.WideGuard }],
    effectTier: EffectTier.Reactive,
  },
  "quick-guard": {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.Defensive, defenseKind: DefensiveKind.QuickGuard }],
    effectTier: EffectTier.Reactive,
  },
  counter: {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.Defensive, defenseKind: DefensiveKind.Counter }],
    effectTier: EffectTier.Reactive,
  },
  "mirror-coat": {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.Defensive, defenseKind: DefensiveKind.MirrorCoat }],
    effectTier: EffectTier.Reactive,
  },
  "metal-burst": {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.Defensive, defenseKind: DefensiveKind.MetalBurst }],
    effectTier: EffectTier.Reactive,
  },
  endure: {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.Defensive, defenseKind: DefensiveKind.Endure }],
    effectTier: EffectTier.Reactive,
  },
  toxic: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 2 } },
    effects: [{ kind: EffectKind.Status, status: StatusType.BadlyPoisoned, chance: 100 }],
    effectTier: EffectTier.MajorStatus,
  },
  supersonic: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Status, status: StatusType.Confused, chance: 100 }],
  },
  "swords-dance": {
    targeting: { kind: TargetingKind.Self },
    effects: [
      { kind: EffectKind.StatChange, stat: StatName.Attack, stages: 2, target: EffectTarget.Self },
    ],
    effectTier: EffectTier.MajorBuff,
  },
  "iron-defense": {
    targeting: { kind: TargetingKind.Self },
    effects: [
      { kind: EffectKind.StatChange, stat: StatName.Defense, stages: 2, target: EffectTarget.Self },
    ],
    effectTier: EffectTier.MajorBuff,
  },
  growl: {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 3 } },
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.Attack,
        stages: -1,
        target: EffectTarget.Targets,
      },
    ],
  },
  roar: {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 3 } },
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.Attack,
        stages: -1,
        target: EffectTarget.Targets,
      },
    ],
  },
  flash: {
    targeting: { kind: TargetingKind.Zone, radius: 2 },
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.Accuracy,
        stages: -1,
        target: EffectTarget.Targets,
      },
    ],
  },
  acid: {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 2 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpDefense,
        stages: -1,
        target: EffectTarget.Targets,
      },
    ],
  },
  earthquake: {
    targeting: { kind: TargetingKind.Zone, radius: 2 },
    effects: [{ kind: EffectKind.Damage }],
  },
  "mega-punch": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  slash: {
    targeting: { kind: TargetingKind.Slash },
    effects: [{ kind: EffectKind.Damage }],
  },
  "poison-sting": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Poisoned, chance: 30 },
    ],
  },
  "hyper-beam": {
    targeting: { kind: TargetingKind.Line, length: 5 },
    effects: [{ kind: EffectKind.Damage }],
    recharge: true,
  },
  "double-kick": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage, hits: 2 }],
  },
  "fury-swipes": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage, hits: { min: 2, max: 5 } }],
  },
  "dragon-tail": {
    targeting: { kind: TargetingKind.Slash },
    effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.Knockback, distance: 1 }],
  },
  wrap: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.Status,
        status: StatusType.Trapped,
        chance: 100,
        damagePerTurn: 0.125,
      },
    ],
  },

  // --- Batch A moves ---

  "petal-blizzard": {
    targeting: { kind: TargetingKind.Zone, radius: 2 },
    effects: [{ kind: EffectKind.Damage }],
  },
  synthesis: {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.HealSelf, percent: 0.5 }],
  },
  growth: {
    targeting: { kind: TargetingKind.Self },
    effects: [
      { kind: EffectKind.StatChange, stat: StatName.Attack, stages: 1, target: EffectTarget.Self },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpAttack,
        stages: 1,
        target: EffectTarget.Self,
      },
    ],
    effectTier: EffectTier.DoubleBuff,
  },

  "fire-blast": {
    targeting: { kind: TargetingKind.Blast, range: { min: 3, max: 3 }, radius: 1 },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Burned, chance: 10 },
    ],
  },
  "flare-blitz": {
    targeting: { kind: TargetingKind.Dash, maxDistance: 3 },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Burned, chance: 10 },
      { kind: EffectKind.Recoil, fraction: 1 / 3 },
    ],
  },
  "lava-plume": {
    targeting: { kind: TargetingKind.Zone, radius: 1 },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Burned, chance: 30 },
    ],
  },

  "dragon-claw": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  "dragon-dance": {
    targeting: { kind: TargetingKind.Self },
    effects: [
      { kind: EffectKind.StatChange, stat: StatName.Attack, stages: 1, target: EffectTarget.Self },
      { kind: EffectKind.StatChange, stat: StatName.Speed, stages: 1, target: EffectTarget.Self },
    ],
    effectTier: EffectTier.DoubleBuff,
  },

  "air-slash": {
    targeting: { kind: TargetingKind.Slash },
    effects: [{ kind: EffectKind.Damage }],
  },

  surf: {
    targeting: { kind: TargetingKind.Zone, radius: 2 },
    effects: [{ kind: EffectKind.Damage }],
  },
  "hydro-pump": {
    targeting: { kind: TargetingKind.Line, length: 4 },
    effects: [{ kind: EffectKind.Damage }],
  },
  waterfall: {
    targeting: { kind: TargetingKind.Dash, maxDistance: 3 },
    effects: [{ kind: EffectKind.Damage }],
  },
  "aqua-tail": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  },

  "ice-beam": {
    targeting: { kind: TargetingKind.Line, length: 4 },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Frozen, chance: 10 },
    ],
  },

  thunder: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 4 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Paralyzed, chance: 30 },
    ],
  },
  "iron-tail": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Defense,
        stages: -1,
        target: EffectTarget.Targets,
      },
    ],
  },
  "charge-beam": {
    targeting: { kind: TargetingKind.Line, length: 3 },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpAttack,
        stages: 1,
        target: EffectTarget.Self,
        chance: 70,
      },
    ],
  },

  psychic: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 4 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpDefense,
        stages: -1,
        target: EffectTarget.Targets,
        chance: 10,
      },
    ],
  },
  recover: {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.HealSelf, percent: 0.5 }],
  },
  rest: {
    targeting: { kind: TargetingKind.Self },
    effects: [
      { kind: EffectKind.HealSelf, percent: 1.0 },
      {
        kind: EffectKind.Status,
        status: StatusType.Asleep,
        chance: 100,
        target: EffectTarget.Self,
      },
    ],
  },
  amnesia: {
    targeting: { kind: TargetingKind.Self },
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpDefense,
        stages: 2,
        target: EffectTarget.Self,
      },
    ],
    effectTier: EffectTier.MajorBuff,
  },

  "dynamic-punch": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Confused, chance: 100 },
    ],
  },
  "close-combat": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Defense,
        stages: -1,
        target: EffectTarget.Self,
      },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpDefense,
        stages: -1,
        target: EffectTarget.Self,
      },
    ],
  },
  "brick-break": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  },

  "shadow-ball": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 4 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpDefense,
        stages: -1,
        target: EffectTarget.Targets,
        chance: 20,
      },
    ],
  },
  crunch: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Defense,
        stages: -1,
        target: EffectTarget.Targets,
        chance: 20,
      },
    ],
  },

  outrage: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.Status,
        status: StatusType.Confused,
        chance: 100,
        target: EffectTarget.Self,
      },
    ],
  },

  "extreme-speed": {
    targeting: { kind: TargetingKind.Dash, maxDistance: 2 },
    effects: [{ kind: EffectKind.Damage }],
  },
  "acid-armor": {
    targeting: { kind: TargetingKind.Self },
    effects: [
      { kind: EffectKind.StatChange, stat: StatName.Defense, stages: 2, target: EffectTarget.Self },
    ],
    effectTier: EffectTier.MajorBuff,
  },

  // Batch B moves
  "cross-chop": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  "rock-slide": {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 2 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  "confuse-ray": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Status, status: StatusType.Confused, chance: 100 }],
    effectTier: EffectTier.MajorStatus,
  },
  "energy-ball": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 4 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  bonemerang: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage, hits: 2 }],
  },
  "blaze-kick": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Burned, chance: 10 },
    ],
  },
  "thunder-punch": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Paralyzed, chance: 10 },
    ],
  },
  "ice-punch": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Frozen, chance: 10 },
    ],
  },
  "fire-punch": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Burned, chance: 10 },
    ],
  },
  "double-edge": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.Recoil, fraction: 1 / 3 }],
  },

  // Batch C moves
  "will-o-wisp": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Status, status: StatusType.Burned, chance: 100 }],
    effectTier: EffectTier.MajorStatus,
  },
  "nasty-plot": {
    targeting: { kind: TargetingKind.Self },
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpAttack,
        stages: 2,
        target: EffectTarget.Self,
      },
    ],
    effectTier: EffectTier.MajorBuff,
  },
  "sludge-wave": {
    targeting: { kind: TargetingKind.Zone, radius: 2 },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Poisoned, chance: 10 },
    ],
  },
  "flash-cannon": {
    targeting: { kind: TargetingKind.Line, length: 3 },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpDefense,
        stages: -1,
        target: EffectTarget.Targets,
        chance: 10,
      },
    ],
  },
  discharge: {
    targeting: { kind: TargetingKind.Zone, radius: 2 },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Paralyzed, chance: 30 },
    ],
  },
  screech: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.Defense,
        stages: -2,
        target: EffectTarget.Targets,
      },
    ],
  },
  "icicle-spear": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage, hits: { min: 2, max: 5 } }],
  },
  "lovely-kiss": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Status, status: StatusType.Asleep, chance: 100 }],
    effectTier: EffectTier.MajorStatus,
    flags: { contact: true },
  },
  crabhammer: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  "self-destruct": {
    targeting: { kind: TargetingKind.Zone, radius: 2 },
    effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.Recoil, fraction: 999 }],
  },
  "tri-attack": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 4 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.Status,
        statuses: [StatusType.Paralyzed, StatusType.Burned, StatusType.Frozen],
        chance: 20,
      },
    ],
  },
  "lock-on": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 4 } },
    effects: [
      {
        kind: EffectKind.Status,
        status: StatusType.LockedOn,
        chance: 100,
        target: EffectTarget.Self,
      },
    ],
  },
  moonblast: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 4 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpAttack,
        stages: -1,
        target: EffectTarget.Targets,
        chance: 30,
      },
    ],
  },
  "ancient-power": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Attack,
        stages: 1,
        target: EffectTarget.Self,
        chance: 10,
        chanceGroup: 1,
      },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Defense,
        stages: 1,
        target: EffectTarget.Self,
        chance: 10,
        chanceGroup: 1,
      },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpAttack,
        stages: 1,
        target: EffectTarget.Self,
        chance: 10,
        chanceGroup: 1,
      },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpDefense,
        stages: 1,
        target: EffectTarget.Self,
        chance: 10,
        chanceGroup: 1,
      },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Speed,
        stages: 1,
        target: EffectTarget.Self,
        chance: 10,
        chanceGroup: 1,
      },
    ],
  },
  "shell-smash": {
    targeting: { kind: TargetingKind.Self },
    effects: [
      { kind: EffectKind.StatChange, stat: StatName.Attack, stages: 2, target: EffectTarget.Self },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpAttack,
        stages: 2,
        target: EffectTarget.Self,
      },
      { kind: EffectKind.StatChange, stat: StatName.Speed, stages: 2, target: EffectTarget.Self },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Defense,
        stages: -1,
        target: EffectTarget.Self,
      },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpDefense,
        stages: -1,
        target: EffectTarget.Self,
      },
    ],
    effectTier: EffectTier.MajorBuff,
  },

  // Batch D moves
  "poison-fang": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.BadlyPoisoned, chance: 50 },
    ],
  },
  coil: {
    targeting: { kind: TargetingKind.Self },
    effects: [
      { kind: EffectKind.StatChange, stat: StatName.Attack, stages: 1, target: EffectTarget.Self },
      { kind: EffectKind.StatChange, stat: StatName.Defense, stages: 1, target: EffectTarget.Self },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Accuracy,
        stages: 1,
        target: EffectTarget.Self,
      },
    ],
    effectTier: EffectTier.DoubleBuff,
  },
  glare: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Status, status: StatusType.Paralyzed, chance: 100 }],
    effectTier: EffectTier.MajorStatus,
  },
  "cosmic-power": {
    targeting: { kind: TargetingKind.Self },
    effects: [
      { kind: EffectKind.StatChange, stat: StatName.Defense, stages: 1, target: EffectTarget.Self },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpDefense,
        stages: 1,
        target: EffectTarget.Self,
      },
    ],
    effectTier: EffectTier.DoubleBuff,
  },
  spore: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Status, status: StatusType.Asleep, chance: 100 }],
    effectTier: EffectTier.MajorStatus,
  },
  "leaf-blade": {
    targeting: { kind: TargetingKind.Slash },
    effects: [{ kind: EffectKind.Damage }],
  },
  "drill-peck": {
    targeting: { kind: TargetingKind.Line, length: 2 },
    effects: [{ kind: EffectKind.Damage }],
  },
  barrier: {
    targeting: { kind: TargetingKind.Self },
    effects: [
      { kind: EffectKind.StatChange, stat: StatName.Defense, stages: 2, target: EffectTarget.Self },
    ],
    effectTier: EffectTier.MajorBuff,
  },
  "leech-life": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.Drain, fraction: 0.5 }],
  },
  "mega-drain": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 4 } },
    effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.Drain, fraction: 0.5 }],
  },
  twineedle: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage, hits: 2 },
      { kind: EffectKind.Status, status: StatusType.Poisoned, chance: 36 },
    ],
  },
  "aerial-ace": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 2 } },
    effects: [{ kind: EffectKind.Damage }],
    flags: { slicing: true },
    bypassAccuracy: true,
  },
  "feather-dance": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.Attack,
        stages: -2,
        target: EffectTarget.Targets,
      },
    ],
    effectTier: EffectTier.MajorBuff,
  },
  "hyper-fang": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  "quiver-dance": {
    targeting: { kind: TargetingKind.Self },
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpAttack,
        stages: 1,
        target: EffectTarget.Self,
      },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpDefense,
        stages: 1,
        target: EffectTarget.Self,
      },
      { kind: EffectKind.StatChange, stat: StatName.Speed, stages: 1, target: EffectTarget.Self },
    ],
    effectTier: EffectTier.MajorBuff,
  },
  roost: {
    targeting: { kind: TargetingKind.Self },
    effects: [
      { kind: EffectKind.HealSelf, percent: 0.5 },
      {
        kind: EffectKind.Status,
        status: StatusType.Roosted,
        chance: 100,
        target: EffectTarget.Self,
      },
    ],
    effectTier: EffectTier.MajorBuff,
  },
  "giga-drain": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 4 } },
    effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.Drain, fraction: 0.5 }],
  },
  "focus-blast": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 4 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpDefense,
        stages: -1,
        target: EffectTarget.Targets,
        chance: 10,
      },
    ],
  },
  "sunny-day": {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.SetWeather, weather: Weather.Sun, turns: 5 }],
    weatherSetter: { type: Weather.Sun, turns: 5 },
  },
  "rain-dance": {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.SetWeather, weather: Weather.Rain, turns: 5 }],
    weatherSetter: { type: Weather.Rain, turns: 5 },
  },
  sandstorm: {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.SetWeather, weather: Weather.Sandstorm, turns: 5 }],
    weatherSetter: { type: Weather.Sandstorm, turns: 5 },
  },
  snowscape: {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.SetWeather, weather: Weather.Snow, turns: 5 }],
    weatherSetter: { type: Weather.Snow, turns: 5 },
  },
  reflect: {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.PostAura, aura: AuraKind.Reflect }],
  },
  "light-screen": {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.PostAura, aura: AuraKind.LightScreen }],
  },
  mist: {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.PostAura, aura: AuraKind.Mist }],
  },
  safeguard: {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.PostAura, aura: AuraKind.Safeguard }],
  },
  "weather-ball": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 4 } },
    effects: [{ kind: EffectKind.Damage }],
    weatherBoostedType: true,
  },
  "solar-beam": {
    targeting: { kind: TargetingKind.Line, length: 5 },
    effects: [{ kind: EffectKind.Damage }],
    twoTurnCharge: true,
    sunSkipsCharge: true,
  },
  teleport: {
    targeting: { kind: TargetingKind.Teleport, range: { min: 1, max: 6 } },
    effects: [],
  },
  fly: {
    targeting: { kind: TargetingKind.Teleport, range: { min: 2, max: 4 }, aoeRadius: 1 },
    effects: [{ kind: EffectKind.Damage }],
    twoTurnCharge: true,
    semiInvulnerableState: SemiInvulnerableState.Flying,
  },
  dig: {
    targeting: { kind: TargetingKind.Teleport, range: { min: 1, max: 3 }, aoeRadius: 1 },
    effects: [{ kind: EffectKind.Damage }],
    twoTurnCharge: true,
    semiInvulnerableState: SemiInvulnerableState.Burrowing,
  },
  bounce: {
    targeting: { kind: TargetingKind.Teleport, range: { min: 1, max: 3 }, aoeRadius: 1 },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Paralyzed, chance: 30 },
    ],
    twoTurnCharge: true,
    semiInvulnerableState: SemiInvulnerableState.Flying,
  },
  "phantom-force": {
    targeting: { kind: TargetingKind.Teleport, range: { min: 1, max: 4 }, aoeRadius: 1 },
    effects: [{ kind: EffectKind.Damage }],
    bypassProtect: true,
    twoTurnCharge: true,
    semiInvulnerableState: SemiInvulnerableState.Vanished,
  },
  "shadow-force": {
    targeting: { kind: TargetingKind.Teleport, range: { min: 1, max: 4 }, aoeRadius: 1 },
    effects: [{ kind: EffectKind.Damage }],
    bypassProtect: true,
    twoTurnCharge: true,
    semiInvulnerableState: SemiInvulnerableState.Vanished,
  },
  dive: {
    targeting: { kind: TargetingKind.Teleport, range: { min: 1, max: 3 }, aoeRadius: 1 },
    effects: [{ kind: EffectKind.Damage }],
    twoTurnCharge: true,
    semiInvulnerableState: SemiInvulnerableState.Diving,
  },
  "baton-pass": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.TransferStatStages }],
    targetsAlly: true,
  },
  "skull-bash": {
    targeting: { kind: TargetingKind.Dash, maxDistance: 3 },
    effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.Knockback, distance: 1 }],
    twoTurnCharge: true,
    chargeEffects: [
      { kind: EffectKind.StatChange, stat: StatName.Defense, stages: 1, target: EffectTarget.Self },
    ],
  },
  "sky-attack": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 2 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Flinch, chance: 30 },
    ],
    twoTurnCharge: true,
    critRatio: 1,
  },
  "razor-wind": {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Damage }],
    twoTurnCharge: true,
    critRatio: 1,
  },
  substitute: {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.PostSubstitute }],
    effectTier: EffectTier.Reactive,
  },
  taunt: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Status, status: StatusType.Taunted, chance: 100 }],
    effectTier: EffectTier.MajorStatus,
  },
  disable: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Disable }],
    effectTier: EffectTier.MajorStatus,
  },
  encore: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Encore }],
    effectTier: EffectTier.MajorStatus,
  },
  // --- Content Batch G1 moves (dégâts pur physique, plan 102) ---
  // Riders complexes différés (cf. plan 102) : throat-chop sound-lock, lash-out/temper-flare/
  // fury-cutter power conditionnel, ice-spinner/steel-roller terrain, supercell-slam crash,
  // fell-stinger KO-boost, psychic-fangs/raging-bull screen-break, poltergeist item-check.
  "throat-chop": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  trailblaze: {
    targeting: { kind: TargetingKind.Dash, maxDistance: 3 },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.StatChange, stat: StatName.Speed, stages: 1, target: EffectTarget.Self },
    ],
  },
  "mega-kick": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  "brutal-swing": {
    targeting: { kind: TargetingKind.Zone, radius: 1 },
    effects: [{ kind: EffectKind.Damage }],
  },
  "high-horsepower": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  "seed-bomb": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  superpower: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.StatChange, stat: StatName.Attack, stages: -1, target: EffectTarget.Self },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Defense,
        stages: -1,
        target: EffectTarget.Self,
      },
    ],
  },
  "smart-strike": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 2 } },
    effects: [{ kind: EffectKind.Damage }],
    bypassAccuracy: true,
  },
  "x-scissor": {
    targeting: { kind: TargetingKind.Slash },
    effects: [{ kind: EffectKind.Damage }],
  },
  "lash-out": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  "flame-charge": {
    targeting: { kind: TargetingKind.Dash, maxDistance: 3 },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.StatChange, stat: StatName.Speed, stages: 1, target: EffectTarget.Self },
    ],
  },
  "ice-spinner": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  "fire-fang": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Burned, chance: 10 },
      { kind: EffectKind.Status, status: StatusType.Flinch, chance: 10 },
    ],
  },
  "temper-flare": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  "steel-wing": {
    targeting: { kind: TargetingKind.Slash },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Defense,
        stages: 1,
        target: EffectTarget.Self,
        chance: 10,
      },
    ],
  },
  "supercell-slam": {
    targeting: { kind: TargetingKind.Dash, maxDistance: 3 },
    effects: [{ kind: EffectKind.Damage }],
  },
  "thunder-fang": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Paralyzed, chance: 10 },
      { kind: EffectKind.Status, status: StatusType.Flinch, chance: 10 },
    ],
  },
  peck: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 2 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  "aqua-jet": {
    targeting: { kind: TargetingKind.Dash, maxDistance: 2 },
    effects: [{ kind: EffectKind.Damage }],
  },
  megahorn: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 2 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  "power-whip": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 2 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  "ice-fang": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Frozen, chance: 10 },
      { kind: EffectKind.Status, status: StatusType.Flinch, chance: 10 },
    ],
  },
  "fury-cutter": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  "hammer-arm": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.StatChange, stat: StatName.Speed, stages: -1, target: EffectTarget.Self },
    ],
  },
  "ice-shard": {
    targeting: { kind: TargetingKind.Dash, maxDistance: 2 },
    effects: [{ kind: EffectKind.Damage }],
  },
  "pay-day": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  slam: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  "psychic-fangs": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  "metal-claw": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Attack,
        stages: 1,
        target: EffectTarget.Self,
        chance: 10,
      },
    ],
  },
  "horn-attack": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  poltergeist: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  "bullet-punch": {
    targeting: { kind: TargetingKind.Dash, maxDistance: 2 },
    effects: [{ kind: EffectKind.Damage }],
  },
  "fell-stinger": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  "mach-punch": {
    targeting: { kind: TargetingKind.Dash, maxDistance: 2 },
    effects: [{ kind: EffectKind.Damage }],
  },
  "shadow-punch": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
    bypassAccuracy: true,
  },
  "vine-whip": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 2 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  cut: {
    targeting: { kind: TargetingKind.Slash },
    effects: [{ kind: EffectKind.Damage }],
  },
  "raging-bull": {
    targeting: { kind: TargetingKind.Dash, maxDistance: 2 },
    effects: [{ kind: EffectKind.Damage }],
  },
  "meteor-mash": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Attack,
        stages: 1,
        target: EffectTarget.Self,
        chance: 20,
      },
    ],
  },
  "steel-roller": {
    targeting: { kind: TargetingKind.Dash, maxDistance: 3 },
    effects: [{ kind: EffectKind.Damage }],
  },

  // --- Content Batch G2 moves (dégâts spécial + multi-hit, plan 103) ---
  // Spéciaux. Flags sound/bullet/pulse fournis par la reference (ne pas les
  // redéclarer ici : un override flags écrase la reference, cf. backlog aerial-ace).
  swift: {
    targeting: { kind: TargetingKind.Blast, range: { min: 1, max: 5 }, radius: 1 },
    effects: [{ kind: EffectKind.Damage }],
    bypassAccuracy: true,
  },
  "dragon-pulse": {
    targeting: { kind: TargetingKind.Line, length: 4 },
    effects: [{ kind: EffectKind.Damage }],
  },
  "dazzling-gleam": {
    targeting: { kind: TargetingKind.Zone, radius: 2 },
    effects: [{ kind: EffectKind.Damage }],
  },
  "hyper-voice": {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  overheat: {
    targeting: { kind: TargetingKind.Zone, radius: 2 },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpAttack,
        stages: -2,
        target: EffectTarget.Self,
      },
    ],
  },
  "vacuum-wave": {
    targeting: { kind: TargetingKind.Dash, maxDistance: 2 },
    effects: [{ kind: EffectKind.Damage }],
  },
  "leaf-storm": {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 3 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpAttack,
        stages: -2,
        target: EffectTarget.Self,
      },
    ],
  },
  "aura-sphere": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 4 } },
    effects: [{ kind: EffectKind.Damage }],
    bypassAccuracy: true,
  },
  "magical-leaf": {
    targeting: { kind: TargetingKind.Slash },
    effects: [{ kind: EffectKind.Damage }],
    bypassAccuracy: true,
  },
  "power-gem": {
    targeting: { kind: TargetingKind.Line, length: 3 },
    effects: [{ kind: EffectKind.Damage }],
  },
  "disarming-voice": {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 2 } },
    effects: [{ kind: EffectKind.Damage }],
    bypassAccuracy: true,
  },
  "draco-meteor": {
    targeting: { kind: TargetingKind.Blast, range: { min: 1, max: 5 }, radius: 1 },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpAttack,
        stages: -2,
        target: EffectTarget.Self,
      },
    ],
  },
  "shock-wave": {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 2 } },
    effects: [{ kind: EffectKind.Damage }],
    bypassAccuracy: true,
  },

  // Multi-hit (hits déjà supporté : double-kick/fury-swipes).
  "dual-wingbeat": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage, hits: 2 }],
  },
  "rock-blast": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Damage, hits: { min: 2, max: 5 } }],
  },
  "scale-shot": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      { kind: EffectKind.Damage, hits: { min: 2, max: 5 } },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Defense,
        stages: -1,
        target: EffectTarget.Self,
      },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Speed,
        stages: 1,
        target: EffectTarget.Self,
      },
    ],
  },
  "bullet-seed": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Damage, hits: { min: 2, max: 5 } }],
  },
  "double-hit": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage, hits: 2 }],
  },
  "pin-missile": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 2 } },
    effects: [{ kind: EffectKind.Damage, hits: { min: 2, max: 5 } }],
  },
  "fury-attack": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage, hits: { min: 2, max: 5 } }],
  },
  "bone-rush": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 2 } },
    effects: [{ kind: EffectKind.Damage, hits: { min: 2, max: 5 } }],
  },
  "icicle-crash": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Flinch, chance: 30 },
    ],
  },
  "tail-slap": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage, hits: { min: 2, max: 5 } }],
  },

  // --- Content Batch G3 moves (dégâts + secondaire statut/flinch/confusion, plan 104) ---
  // Secondaire = modèle body-slam (dégâts-first, pas d'effectTier).
  // Flags sound/wind/pulse/bullet/slicing/distance/contact + critRatio fournis par
  // la reference (ne pas les redéclarer : un override flags écrase la reference).
  // Spéciaux (14).
  "water-pulse": {
    targeting: { kind: TargetingKind.Zone, radius: 1 },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Confused, chance: 20 },
    ],
  },
  "heat-wave": {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 3 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Burned, chance: 10 },
    ],
  },
  "scorching-sands": {
    targeting: { kind: TargetingKind.Zone, radius: 1 },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Burned, chance: 30 },
    ],
  },
  "dark-pulse": {
    targeting: { kind: TargetingKind.Zone, radius: 1 },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Flinch, chance: 20 },
    ],
  },
  hurricane: {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 3 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Confused, chance: 30 },
    ],
  },
  scald: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Burned, chance: 30 },
    ],
  },
  "thunder-shock": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Paralyzed, chance: 10 },
    ],
  },
  "zap-cannon": {
    targeting: { kind: TargetingKind.Line, length: 4 },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Paralyzed, chance: 100 },
    ],
  },
  inferno: {
    targeting: { kind: TargetingKind.Zone, radius: 2 },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Burned, chance: 100 },
    ],
  },
  "powder-snow": {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 2 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Frozen, chance: 10 },
    ],
  },
  sludge: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Poisoned, chance: 30 },
    ],
  },
  smog: {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 2 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Poisoned, chance: 40 },
    ],
  },
  extrasensory: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 4 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Flinch, chance: 10 },
    ],
  },
  twister: {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 2 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Flinch, chance: 20 },
    ],
  },

  // Physiques (10).
  "zen-headbutt": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Flinch, chance: 20 },
    ],
  },
  "poison-jab": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Poisoned, chance: 30 },
    ],
  },
  "iron-head": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Flinch, chance: 20 },
    ],
  },
  "gunk-shot": {
    targeting: { kind: TargetingKind.Blast, range: { min: 2, max: 4 }, radius: 1 },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Poisoned, chance: 30 },
    ],
  },
  "cross-poison": {
    targeting: { kind: TargetingKind.Slash },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Poisoned, chance: 10 },
    ],
  },
  "dragon-rush": {
    targeting: { kind: TargetingKind.Dash, maxDistance: 3 },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Knockback, distance: 1 },
      { kind: EffectKind.Status, status: StatusType.Flinch, chance: 20 },
    ],
  },
  spark: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Paralyzed, chance: 30 },
    ],
  },
  astonish: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Flinch, chance: 30 },
    ],
  },
  nuzzle: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Paralyzed, chance: 100 },
    ],
  },
  "poison-tail": {
    targeting: { kind: TargetingKind.Slash },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Poisoned, chance: 10 },
    ],
  },

  // --- Content Batch G4 moves (dégâts + stat-drop / high-crit / recoil / drain, plan 105) ---
  // Stat-drop secondaire = modèle crunch (dégâts-first). Recoil/Drain = modèle double-edge/giga-drain.
  // High-crit : critRatio fourni par la reference → juste Damage (parité poison-tail/cross-poison G3).
  // Flags (sound/slicing/contact) fournis par la reference — non redéclarés.
  // Recoil rammers en Dash 3 (cohérence volt-tackle/flare-blitz). Martobois reste Single (coup de masse).
  "take-down": {
    targeting: { kind: TargetingKind.Dash, maxDistance: 3 },
    effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.Recoil, fraction: 1 / 4 }],
  },
  "wild-charge": {
    targeting: { kind: TargetingKind.Dash, maxDistance: 3 },
    effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.Recoil, fraction: 1 / 4 }],
  },
  "brave-bird": {
    targeting: { kind: TargetingKind.Dash, maxDistance: 3 },
    effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.Recoil, fraction: 1 / 3 }],
  },
  "wave-crash": {
    targeting: { kind: TargetingKind.Dash, maxDistance: 3 },
    effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.Recoil, fraction: 1 / 3 }],
  },
  "wood-hammer": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.Recoil, fraction: 1 / 3 }],
  },
  // Drain (3).
  "drain-punch": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.Drain, fraction: 0.5 }],
  },
  absorb: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 2 } },
    effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.Drain, fraction: 0.5 }],
  },
  "draining-kiss": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.Drain, fraction: 0.75 }],
  },
  // High-crit (6) : critRatio depuis la reference, pas d'override de crit.
  "stone-edge": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 2 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  "drill-run": {
    targeting: { kind: TargetingKind.Line, length: 2 },
    effects: [{ kind: EffectKind.Damage }],
  },
  "shadow-claw": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  "air-cutter": {
    targeting: { kind: TargetingKind.Slash },
    effects: [{ kind: EffectKind.Damage }],
  },
  "psycho-cut": {
    targeting: { kind: TargetingKind.Slash },
    effects: [{ kind: EffectKind.Damage }],
  },
  "night-slash": {
    targeting: { kind: TargetingKind.Slash },
    effects: [{ kind: EffectKind.Damage }],
  },
  // Stat-drop secondaire (22).
  bulldoze: {
    targeting: { kind: TargetingKind.Zone, radius: 1 },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Speed,
        stages: -1,
        target: EffectTarget.Targets,
        chance: 100,
      },
    ],
  },
  "rock-tomb": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Speed,
        stages: -1,
        target: EffectTarget.Targets,
        chance: 100,
      },
    ],
  },
  "low-sweep": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Speed,
        stages: -1,
        target: EffectTarget.Targets,
        chance: 100,
      },
    ],
  },
  pounce: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Speed,
        stages: -1,
        target: EffectTarget.Targets,
        chance: 100,
      },
    ],
  },
  "mud-shot": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Speed,
        stages: -1,
        target: EffectTarget.Targets,
        chance: 100,
      },
    ],
  },
  electroweb: {
    targeting: { kind: TargetingKind.Zone, radius: 2 },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Speed,
        stages: -1,
        target: EffectTarget.Targets,
        chance: 100,
      },
    ],
  },
  lunge: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Attack,
        stages: -1,
        target: EffectTarget.Targets,
        chance: 100,
      },
    ],
  },
  "breaking-swipe": {
    targeting: { kind: TargetingKind.Slash },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Attack,
        stages: -1,
        target: EffectTarget.Targets,
        chance: 100,
      },
    ],
  },
  "chilling-water": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Attack,
        stages: -1,
        target: EffectTarget.Targets,
        chance: 100,
      },
    ],
  },
  "play-rough": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Attack,
        stages: -1,
        target: EffectTarget.Targets,
        chance: 10,
      },
    ],
  },
  liquidation: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Defense,
        stages: -1,
        target: EffectTarget.Targets,
        chance: 20,
      },
    ],
  },
  "razor-shell": {
    targeting: { kind: TargetingKind.Slash },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Defense,
        stages: -1,
        target: EffectTarget.Targets,
        chance: 50,
      },
    ],
  },
  "crush-claw": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Defense,
        stages: -1,
        target: EffectTarget.Targets,
        chance: 50,
      },
    ],
  },
  "earth-power": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpDefense,
        stages: -1,
        target: EffectTarget.Targets,
        chance: 10,
      },
    ],
  },
  "bug-buzz": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpDefense,
        stages: -1,
        target: EffectTarget.Targets,
        chance: 10,
      },
    ],
  },
  "acid-spray": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpDefense,
        stages: -2,
        target: EffectTarget.Targets,
        chance: 100,
      },
    ],
  },
  "skitter-smack": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpAttack,
        stages: -1,
        target: EffectTarget.Targets,
        chance: 100,
      },
    ],
  },
  snarl: {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 3 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpAttack,
        stages: -1,
        target: EffectTarget.Targets,
        chance: 100,
      },
    ],
  },
  "mystical-fire": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpAttack,
        stages: -1,
        target: EffectTarget.Targets,
        chance: 100,
      },
    ],
  },
  "struggle-bug": {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 2 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpAttack,
        stages: -1,
        target: EffectTarget.Targets,
        chance: 100,
      },
    ],
  },
  "mud-slap": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 2 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Accuracy,
        stages: -1,
        target: EffectTarget.Targets,
        chance: 100,
      },
    ],
  },
  "muddy-water": {
    targeting: { kind: TargetingKind.Zone, radius: 2 },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Accuracy,
        stages: -1,
        target: EffectTarget.Targets,
        chance: 30,
      },
    ],
  },
  // --- Content Batch G5 moves (pure stat-change + pure statut, plan 106) ---
  "scary-face": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.Speed,
        stages: -2,
        target: EffectTarget.Targets,
      },
    ],
  },
  charm: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.Attack,
        stages: -2,
        target: EffectTarget.Targets,
      },
    ],
  },
  "fake-tears": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpDefense,
        stages: -2,
        target: EffectTarget.Targets,
      },
    ],
  },
  "eerie-impulse": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpAttack,
        stages: -2,
        target: EffectTarget.Targets,
      },
    ],
  },
  "metal-sound": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpDefense,
        stages: -2,
        target: EffectTarget.Targets,
      },
    ],
  },
  "baby-doll-eyes": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.Attack,
        stages: -1,
        target: EffectTarget.Targets,
      },
    ],
  },
  confide: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpAttack,
        stages: -1,
        target: EffectTarget.Targets,
      },
    ],
  },
  tickle: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 2 } },
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.Attack,
        stages: -1,
        target: EffectTarget.Targets,
      },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Defense,
        stages: -1,
        target: EffectTarget.Targets,
      },
    ],
  },
  leer: {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 3 } },
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.Defense,
        stages: -1,
        target: EffectTarget.Targets,
      },
    ],
  },
  "tail-whip": {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 3 } },
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.Defense,
        stages: -1,
        target: EffectTarget.Targets,
      },
    ],
  },
  "sweet-scent": {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 3 } },
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.Evasion,
        stages: -2,
        target: EffectTarget.Targets,
      },
    ],
  },
  "string-shot": {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 2 } },
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.Speed,
        stages: -2,
        target: EffectTarget.Targets,
      },
    ],
  },
  harden: {
    targeting: { kind: TargetingKind.Self },
    effects: [
      { kind: EffectKind.StatChange, stat: StatName.Defense, stages: 1, target: EffectTarget.Self },
    ],
  },
  "work-up": {
    targeting: { kind: TargetingKind.Self },
    effects: [
      { kind: EffectKind.StatChange, stat: StatName.Attack, stages: 1, target: EffectTarget.Self },
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpAttack,
        stages: 1,
        target: EffectTarget.Self,
      },
    ],
    effectTier: EffectTier.DoubleBuff,
  },
  "rock-polish": {
    targeting: { kind: TargetingKind.Self },
    effects: [
      { kind: EffectKind.StatChange, stat: StatName.Speed, stages: 2, target: EffectTarget.Self },
    ],
    effectTier: EffectTier.MajorBuff,
  },
  coaching: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    targetsAlly: true,
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.Attack,
        stages: 1,
        target: EffectTarget.Targets,
      },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Defense,
        stages: 1,
        target: EffectTarget.Targets,
      },
    ],
    effectTier: EffectTier.DoubleBuff,
  },
  "poison-powder": {
    targeting: { kind: TargetingKind.Zone, radius: 1 },
    effects: [{ kind: EffectKind.Status, status: StatusType.Poisoned, chance: 100 }],
    effectTier: EffectTier.MajorStatus,
  },
  "stun-spore": {
    targeting: { kind: TargetingKind.Zone, radius: 1 },
    effects: [{ kind: EffectKind.Status, status: StatusType.Paralyzed, chance: 100 }],
    effectTier: EffectTier.MajorStatus,
  },
  "poison-gas": {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 2 } },
    effects: [{ kind: EffectKind.Status, status: StatusType.Poisoned, chance: 100 }],
    effectTier: EffectTier.MajorStatus,
  },
  "sweet-kiss": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Status, status: StatusType.Confused, chance: 100 }],
    effectTier: EffectTier.MajorStatus,
  },
  "teeter-dance": {
    targeting: { kind: TargetingKind.Zone, radius: 1 },
    effects: [{ kind: EffectKind.Status, status: StatusType.Confused, chance: 100 }],
    effectTier: EffectTier.MajorStatus,
  },
  swagger: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.Attack,
        stages: 2,
        target: EffectTarget.Targets,
      },
      { kind: EffectKind.Status, status: StatusType.Confused, chance: 100 },
    ],
    effectTier: EffectTier.MajorStatus,
  },
  flatter: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpAttack,
        stages: 1,
        target: EffectTarget.Targets,
      },
      { kind: EffectKind.Status, status: StatusType.Confused, chance: 100 },
    ],
    effectTier: EffectTier.MajorStatus,
  },
};
