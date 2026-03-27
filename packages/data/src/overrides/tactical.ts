import type { Effect, TargetingPattern } from "@pokemon-tactic/core";
import {
  EffectKind,
  EffectTarget,
  LinkType,
  StatName,
  StatusType,
  TargetingKind,
} from "@pokemon-tactic/core";

export interface TacticalOverride {
  targeting: TargetingPattern;
  effects: Effect[];
}

export const tacticalOverrides: Record<string, TacticalOverride> = {
  "razor-leaf": {
    targeting: { kind: TargetingKind.Slash },
    effects: [{ kind: EffectKind.Damage }],
  },
  "sleep-powder": {
    targeting: { kind: TargetingKind.Zone, radius: 1 },
    effects: [{ kind: EffectKind.Status, status: StatusType.Asleep, chance: 75 }],
  },
  "leech-seed": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      {
        kind: EffectKind.Link,
        linkType: LinkType.LeechSeed,
        duration: null,
        maxRange: 5,
        drainFraction: 0.125,
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
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 2 }, width: 3 },
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
  },
  "bubble-beam": {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 2 }, width: 3 },
    effects: [{ kind: EffectKind.Damage }],
  },
  gust: {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 3 }, width: 3 },
    effects: [{ kind: EffectKind.Damage }],
  },
  "quick-attack": {
    targeting: { kind: TargetingKind.Dash, maxDistance: 2 },
    effects: [{ kind: EffectKind.Damage }],
  },
  "sand-attack": {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 2 }, width: 3 },
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
  // Pikachu
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
  // Machop
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
  },
  "rock-smash": {
    targeting: { kind: TargetingKind.Cross, range: { min: 1, max: 2 }, size: 3 },
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
  // Abra
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
  },
  // Gastly
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
  },
  "night-shade": {
    targeting: { kind: TargetingKind.Cross, range: { min: 1, max: 2 }, size: 3 },
    effects: [{ kind: EffectKind.Damage }],
  },
  minimize: {
    targeting: { kind: TargetingKind.Self },
    effects: [
      { kind: EffectKind.StatChange, stat: StatName.Evasion, stages: 2, target: EffectTarget.Self },
    ],
  },
  // Geodude
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
  // Growlithe
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
  },
  "flame-wheel": {
    targeting: { kind: TargetingKind.Dash, maxDistance: 3 },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Burned, chance: 10 },
    ],
  },
  // Jigglypuff
  pound: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  sing: {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 3 }, width: 3 },
    effects: [{ kind: EffectKind.Status, status: StatusType.Asleep, chance: 100 }],
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
  },
  // Seel
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
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 3 }, width: 3 },
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
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 2 }, width: 3 },
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
};
