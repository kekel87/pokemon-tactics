import type { Effect, TargetingPattern } from "@pokemon-tactic/core";
import {
  DefensiveKind,
  EffectKind,
  EffectTarget,
  EffectTier,
  StatName,
  StatusType,
  TargetingKind,
} from "@pokemon-tactic/core";

export interface TacticalOverride {
  targeting: TargetingPattern;
  effects: Effect[];
  recharge?: boolean;
  effectTier?: EffectTier;
}

export const tacticalOverrides: Record<string, TacticalOverride> = {
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
};
