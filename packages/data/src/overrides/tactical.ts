import type {
  DynamicPowerSpec,
  Effect,
  MoveFlags,
  SemiInvulnerableState as SemiInvulnerableStateType,
  TargetingPattern,
  Weather as WeatherType,
} from "@pokemon-tactic/core";
import {
  AttackStatSource,
  AuraKind,
  ConditionKind,
  DefensiveKind,
  DynamicPowerKind,
  EffectKind,
  EffectTarget,
  EffectTier,
  EntryHazardKind,
  FieldTerrain,
  FieldTerrainBonusWho,
  PokemonType,
  SemiInvulnerableState,
  StatName,
  StatusType,
  TargetingKind,
  Weather,
} from "@pokemon-tactic/core";

export interface TacticalOverride {
  targeting: TargetingPattern;
  effects: Effect[];
  attackStatSource?: AttackStatSource;
  recharge?: boolean;
  isExplosion?: boolean;
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
  targetsAllyOrSelf?: boolean;
  dynamicPower?: DynamicPowerSpec;
  ignoresBurnAttackDrop?: boolean;
  hitsPhysicalDefense?: boolean;
  typeEffectivenessOverride?: { against: PokemonType; multiplier: number };
  perHitAccuracy?: boolean;
  crashOnMiss?: { fraction: number };
  requiresAsleep?: boolean;
  requiresAllOtherMovesUsed?: boolean;
  requiresTargetAsleep?: boolean;
  fieldTerrainPowerBonus?: {
    who: FieldTerrainBonusWho;
    terrain: FieldTerrain;
    multiplier: number;
  };
  dashRangeBonusOnFieldTerrain?: { terrain: FieldTerrain; bonus: number };
  fieldTerrainTargetingOverride?: { terrain: FieldTerrain; targeting: TargetingPattern };
  fieldTerrainBoostedType?: boolean;
  naturePowerMorph?: boolean;
  knockOffBoost?: boolean;
  requiresEatenBerry?: boolean;
  requiresFlingableItem?: boolean;
}

export const tacticalOverrides: Record<string, TacticalOverride> = {
  // Power conditionnel — plan 109 (moteur dynamicPower)
  facade: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
    dynamicPower: { kind: DynamicPowerKind.SelfStatusDouble },
    ignoresBurnAttackDrop: true,
  },
  hex: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Damage }],
    dynamicPower: { kind: DynamicPowerKind.TargetStatusDouble },
  },
  venoshock: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Damage }],
    dynamicPower: { kind: DynamicPowerKind.TargetPoisonedDouble },
  },
  acrobatics: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
    dynamicPower: { kind: DynamicPowerKind.NoHeldItemDouble },
  },
  "stored-power": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Damage }],
    dynamicPower: { kind: DynamicPowerKind.StoredPower },
  },
  "electro-ball": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Damage }],
    dynamicPower: { kind: DynamicPowerKind.SpeedRatio },
  },
  "gyro-ball": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
    dynamicPower: { kind: DynamicPowerKind.SpeedRatioInverse },
  },
  flail: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
    dynamicPower: { kind: DynamicPowerKind.LowHpSelf },
  },
  reversal: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
    dynamicPower: { kind: DynamicPowerKind.LowHpSelf },
  },
  brine: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Damage }],
    dynamicPower: { kind: DynamicPowerKind.TargetHpHalfDouble },
  },
  "hard-press": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
    dynamicPower: { kind: DynamicPowerKind.TargetHpScaled },
  },
  "water-spout": {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Damage }],
    dynamicPower: { kind: DynamicPowerKind.SelfHpScaled },
  },
  // Power conditionnel — plan 111 (poids)
  "low-kick": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
    dynamicPower: { kind: DynamicPowerKind.TargetWeight },
  },
  "grass-knot": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
    dynamicPower: { kind: DynamicPowerKind.TargetWeight },
  },
  "heavy-slam": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
    dynamicPower: { kind: DynamicPowerKind.WeightRatio },
  },
  "heat-crash": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
    dynamicPower: { kind: DynamicPowerKind.WeightRatio },
  },
  // Power conditionnel — familles restantes (hors-pool signatures)
  "last-respects": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
    dynamicPower: { kind: DynamicPowerKind.AllyFaintCountScaled },
  },
  "fishious-rend": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
    dynamicPower: { kind: DynamicPowerKind.TargetIdleSinceLastAction },
  },
  "bolt-beak": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
    dynamicPower: { kind: DynamicPowerKind.TargetIdleSinceLastAction },
  },
  // Dégâts conditionnels — plan 115 (B3, horloge d'actions)
  avalanche: {
    targeting: { kind: TargetingKind.Slash },
    effects: [{ kind: EffectKind.Damage }],
    dynamicPower: { kind: DynamicPowerKind.DamagedByEnemySinceLastAction },
  },
  revenge: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
    dynamicPower: { kind: DynamicPowerKind.DamagedByEnemySinceLastAction },
  },
  assurance: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
    dynamicPower: { kind: DynamicPowerKind.TargetDamagedSinceLastAction },
  },
  "alluring-voice": {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 2 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.Status,
        status: StatusType.Confused,
        chance: 100,
        appliesIf: ConditionKind.TargetBoostedRecently,
      },
    ],
  },
  "burning-jealousy": {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 2 } },
    effects: [
      { kind: EffectKind.Damage },
      {
        kind: EffectKind.Status,
        status: StatusType.Burned,
        chance: 100,
        appliesIf: ConditionKind.TargetBoostedRecently,
      },
    ],
  },
  "echoed-voice": {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Damage }],
    dynamicPower: { kind: DynamicPowerKind.EchoCrescendo },
  },
  round: {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Damage }],
    dynamicPower: { kind: DynamicPowerKind.TeamPreviousMoveDouble },
  },
  "rage-fist": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
    dynamicPower: { kind: DynamicPowerKind.TimesHitScaled },
  },
  retaliate: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
    dynamicPower: { kind: DynamicPowerKind.AllyFaintedSinceLastAction },
  },
  "stomping-tantrum": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
    dynamicPower: { kind: DynamicPowerKind.PreviousMoveFailedDouble },
  },
  snore: {
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 3 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Flinch, chance: 30 },
    ],
    requiresAsleep: true,
  },
  "last-resort": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
    requiresAllOtherMovesUsed: true,
  },
  charge: {
    targeting: { kind: TargetingKind.Self },
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpDefense,
        stages: 1,
        target: EffectTarget.Self,
      },
      {
        kind: EffectKind.Status,
        status: StatusType.Charged,
        chance: 100,
        target: EffectTarget.Self,
      },
    ],
  },
  "beat-up": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage, teamBeatUp: true }],
  },
  "grass-pledge": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  "fire-pledge": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  "water-pledge": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Damage }],
  },
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
    targeting: { kind: TargetingKind.Dash, maxDistance: 4 },
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
    // Snowball : base 2, +1 par cast consécutif (cap 5) via resolveEffectiveMove ; puissance
    // 30 → 480 (×2/cast) via DynamicPowerKind.RolloutStreak. Streak suivi par lanceur (rolloutStreak).
    targeting: { kind: TargetingKind.Dash, maxDistance: 2 },
    effects: [{ kind: EffectKind.Damage }],
    dynamicPower: { kind: DynamicPowerKind.RolloutStreak },
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
    targeting: { kind: TargetingKind.Dash, maxDistance: 2 },
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

  // --- Trapping family (mirror wrap/Ligotage) ---
  // Partial traps: damage + Trapped 4-5 turns + 1/8 HP chip; the target cannot reposition but
  // may still attack. Contact move range 1, ranged elemental traps reach 2.
  bind: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Trapped, chance: 100, damagePerTurn: 0.125 },
    ],
  },
  "fire-spin": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 2 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Trapped, chance: 100, damagePerTurn: 0.125 },
    ],
  },
  whirlpool: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 2 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Trapped, chance: 100, damagePerTurn: 0.125 },
    ],
  },
  "sand-tomb": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 2 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Trapped, chance: 100, damagePerTurn: 0.125 },
    ],
  },
  // Pure traps: position-linked root (no damage). The caster must stay adjacent to hold the
  // target — released when the caster faints or moves away. Range 1 so adjacency is meaningful.
  block: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Status, status: StatusType.Trapped, chance: 100, positionLinked: true },
    ],
    effectTier: EffectTier.MajorStatus,
  },
  "mean-look": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Status, status: StatusType.Trapped, chance: 100, positionLinked: true },
    ],
    effectTier: EffectTier.MajorStatus,
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
    targeting: { kind: TargetingKind.Dash, maxDistance: 4 },
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
  // B2 — Healing (plan 116)
  "soft-boiled": {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.HealSelf, percent: 0.5 }],
  },
  "slack-off": {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.HealSelf, percent: 0.5 }],
  },
  ingrain: {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.PostHealOverTime, status: StatusType.Ingrain }],
  },
  "aqua-ring": {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.PostHealOverTime, status: StatusType.AquaRing }],
  },
  "heal-pulse": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 4 } },
    effects: [{ kind: EffectKind.HealTarget, percent: 0.5 }],
  },
  "life-dew": {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.HealTarget, percent: 0.25, radius: 2 }],
  },
  wish: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.PostWish, percent: 0.5 }],
    targetsAllyOrSelf: true,
  },
  aromatherapy: {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.CureTeamStatus, radius: 2 }],
  },
  "strength-sap": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      { kind: EffectKind.HealByTargetStat, stat: StatName.Attack },
      {
        kind: EffectKind.StatChange,
        stat: StatName.Attack,
        stages: -1,
        target: EffectTarget.Targets,
      },
    ],
  },
  "dream-eater": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.Drain, fraction: 0.5 }],
    requiresTargetAsleep: true,
  },
  "pollen-puff": {
    targeting: { kind: TargetingKind.Blast, range: { min: 1, max: 4 }, radius: 1 },
    effects: [
      { kind: EffectKind.Damage, appliesIf: ConditionKind.TargetIsEnemy },
      { kind: EffectKind.HealTarget, percent: 0.5, appliesIf: ConditionKind.TargetIsAlly },
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
    targeting: { kind: TargetingKind.Dash, maxDistance: 5 },
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
    // Self-KO AoE; the user always faints (handled engine-side via isExplosion), so no Recoil effect.
    targeting: { kind: TargetingKind.Zone, radius: 2 },
    effects: [{ kind: EffectKind.Damage }],
    isExplosion: true,
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
  "grassy-terrain": {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.PostFieldTerrain, terrain: FieldTerrain.Grassy }],
  },
  "electric-terrain": {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.PostFieldTerrain, terrain: FieldTerrain.Electric }],
  },
  "misty-terrain": {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.PostFieldTerrain, terrain: FieldTerrain.Misty }],
  },
  "psychic-terrain": {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.PostFieldTerrain, terrain: FieldTerrain.Psychic }],
  },
  "trick-room": {
    // Distorsion: localized as a static zone (decision 2026-06-18) — inverts CT tempo inside it.
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.PostDistortion }],
  },

  // Entry hazards (plan 131): aimed at a ground tile within range 4, place a single trapped tile;
  // building a minefield is a multi-turn investment. Trigger on enemy ENTRY, permanent until removed.
  spikes: {
    targeting: { kind: TargetingKind.GroundTarget, range: { min: 1, max: 4 } },
    effects: [{ kind: EffectKind.PostEntryHazard, hazardKind: EntryHazardKind.Spikes }],
  },
  "stealth-rock": {
    targeting: { kind: TargetingKind.GroundTarget, range: { min: 1, max: 4 } },
    effects: [{ kind: EffectKind.PostEntryHazard, hazardKind: EntryHazardKind.StealthRock }],
  },
  "toxic-spikes": {
    targeting: { kind: TargetingKind.GroundTarget, range: { min: 1, max: 4 } },
    effects: [{ kind: EffectKind.PostEntryHazard, hazardKind: EntryHazardKind.ToxicSpikes }],
  },
  "sticky-web": {
    targeting: { kind: TargetingKind.GroundTarget, range: { min: 1, max: 4 } },
    effects: [{ kind: EffectKind.PostEntryHazard, hazardKind: EntryHazardKind.StickyWeb }],
  },
  // Removers (plan 131). Tour Rapide = an r1 spin: damages adjacent enemies AND sweeps hazards
  // around itself (r1). Anti-Brume = a wider r2 gust that only clears hazards.
  "rapid-spin": {
    targeting: { kind: TargetingKind.Zone, radius: 1 },
    effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.RemoveEntryHazards, radius: 1 }],
  },
  defog: {
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.RemoveEntryHazards, radius: 2 }],
  },
  "weather-ball": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 4 } },
    effects: [{ kind: EffectKind.Damage }],
    weatherBoostedType: true,
  },

  // B4 — moves dependent on field terrains (plan 118)
  "grassy-glide": {
    // Dash range 2, extended to 4 when the caster starts on Grassy Terrain (decision #439).
    targeting: { kind: TargetingKind.Dash, maxDistance: 2 },
    effects: [{ kind: EffectKind.Damage }],
    dashRangeBonusOnFieldTerrain: { terrain: FieldTerrain.Grassy, bonus: 2 },
  },
  "rising-voltage": {
    // ×2 when the TARGET stands on Electric Terrain (decision A).
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 4 } },
    effects: [{ kind: EffectKind.Damage }],
    fieldTerrainPowerBonus: {
      who: FieldTerrainBonusWho.Target,
      terrain: FieldTerrain.Electric,
      multiplier: 2,
    },
  },
  "expanding-force": {
    // On Psychic Terrain (caster): Single → AoE radius 1 around the target + ×1.5 (#440, #444, #448).
    // Blast (range + radius) centers the AoE on the targeted tile, unlike Zone (caster-centered).
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 4 } },
    effects: [{ kind: EffectKind.Damage }],
    fieldTerrainTargetingOverride: {
      terrain: FieldTerrain.Psychic,
      targeting: { kind: TargetingKind.Blast, range: { min: 1, max: 4 }, radius: 1 },
    },
    fieldTerrainPowerBonus: {
      who: FieldTerrainBonusWho.Caster,
      terrain: FieldTerrain.Psychic,
      multiplier: 1.5,
    },
  },
  "misty-explosion": {
    // Self-KO AoE (self-destruct model, user always faints via isExplosion); ×1.5 on Misty Terrain.
    targeting: { kind: TargetingKind.Zone, radius: 2 },
    effects: [{ kind: EffectKind.Damage }],
    isExplosion: true,
    fieldTerrainPowerBonus: {
      who: FieldTerrainBonusWho.Caster,
      terrain: FieldTerrain.Misty,
      multiplier: 1.5,
    },
  },
  "terrain-pulse": {
    // Type morph + ×2 (50 → 100) by the field terrain under the caster (decisions D, #443).
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 4 } },
    effects: [{ kind: EffectKind.Damage }],
    fieldTerrainBoostedType: true,
  },
  "nature-power": {
    // Full move swap by field terrain / map tile under the caster (decision #441). Self is only a
    // placeholder — the resolved move's targeting drives everything.
    targeting: { kind: TargetingKind.Self },
    effects: [],
    naturePowerMorph: true,
  },
  "mud-bomb": {
    // Sub-deliverable (Nature Power swamp target). Standard Single + 30% Accuracy -1 secondary.
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 4 } },
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
    targeting: { kind: TargetingKind.Dash, maxDistance: 4 },
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
  // --- Contrôle restant (plan 132) ---
  imprison: {
    // Possessif: persistent volatile on the caster — enemies cannot use any move the caster knows.
    // MajorStatus cost: persistent, no timer, multi-target reach.
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.PostImprison }],
    effectTier: EffectTier.MajorStatus,
  },
  "psychic-noise": {
    // Dissonance Psy: special damage + guaranteed Heal Block 2t. Sound move (reference flags
    // sound + bypasssub) → bypasses Substitute, secondary applies through it. Cone like the other
    // sound moves (Hyper Voix / Grondement / Murmure).
    targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 3 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.HealBlocked, chance: 100 },
    ],
  },
  spite: {
    // Dépit: PP removed (plan 128) → reinterpreted as a one-shot CT tax (tempo punishment).
    // Single 1-3 like its control siblings (Provoc / Entrave / Encore). Standard status-move cost.
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.SpiteCtTax }],
  },
  // --- Famille Delayed / countdown (plan 133) ---
  "future-sight": {
    // Prescience: ground-targeted delayed strike. Locks a tile (GroundTarget range 4); 2 of the
    // caster's turns later it lands as an r1 Manhattan AoE (friendly fire included). Offense frozen
    // at cast; defence recomputed at landing. Heavy natural CT (120 BP / 10 PP → 900) = the slow
    // caster lengthens the telegraph, so the threat is fair.
    targeting: { kind: TargetingKind.GroundTarget, range: { min: 1, max: 4 }, radius: 1 },
    effects: [{ kind: EffectKind.PostFutureSight, radius: 1, delayTurns: 2, power: 120 }],
  },
  "perish-song": {
    // Requiem: self-cast, field-wide perish countdown (3 turns) on EVERY living mon, caster included.
    // Sound move (reference flags sound + bypasssub). Heavy natural CT (5 PP → 900) = a committal move.
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.PostPerishSong, turns: 3, radius: 2 }],
  },
  "pain-split": {
    // Balance: average the caster's and target's current HP. Single 1-3, blocked by Protection.
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.PainSplit }],
  },
  endeavor: {
    // Effort: set the target's HP to the caster's when higher. Melee contact, blocked by Protection.
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Endeavor }],
  },
  "helping-hand": {
    // Coup d'Main: buff an adjacent ally's next offensive move ×1.5 (consumed at end of its turn).
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.HelpingHand, multiplier: 1.5 }],
    targetsAlly: true,
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
    targeting: { kind: TargetingKind.Dash, maxDistance: 2 },
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
    targeting: { kind: TargetingKind.Dash, maxDistance: 2 },
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
    targeting: { kind: TargetingKind.Dash, maxDistance: 3 },
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
    targeting: { kind: TargetingKind.Dash, maxDistance: 4 },
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
    targeting: { kind: TargetingKind.Dash, maxDistance: 4 },
    effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.Recoil, fraction: 1 / 3 }],
  },
  "wave-crash": {
    targeting: { kind: TargetingKind.Dash, maxDistance: 4 },
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
  // --- Stat-source moves — plan 110 (override de la stat offensive) ---
  "body-press": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
    attackStatSource: AttackStatSource.UserDefense,
  },
  "foul-play": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
    attackStatSource: AttackStatSource.TargetAttack,
  },
  // --- B1 « Quasi-prêt » — plan 113 ---
  psyshock: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 4 } },
    effects: [{ kind: EffectKind.Damage }],
    hitsPhysicalDefense: true,
  },
  psystrike: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 4 } },
    effects: [{ kind: EffectKind.Damage }],
    hitsPhysicalDefense: true,
  },
  "freeze-dry": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 4 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Frozen, chance: 10 },
    ],
    typeEffectivenessOverride: { against: PokemonType.Water, multiplier: 2 },
  },
  "triple-axel": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage, escalatingHitPower: [20, 40, 60] }],
    perHitAccuracy: true,
  },
  "high-jump-kick": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
    crashOnMiss: { fraction: 0.5 },
  },
  "axe-kick": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Confused, chance: 30 },
    ],
    crashOnMiss: { fraction: 0.5 },
  },
  // --- Content Batch G6 moves (simples ratés des batches G : recharge / charge / multi-hit / no-op, plan 107) ---
  strength: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  },
  stomp: {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [
      { kind: EffectKind.Damage },
      { kind: EffectKind.Status, status: StatusType.Flinch, chance: 30 },
    ],
  },
  "dual-chop": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage, hits: 2 }],
  },
  "blast-burn": {
    targeting: { kind: TargetingKind.Line, length: 5 },
    effects: [{ kind: EffectKind.Damage }],
    recharge: true,
  },
  "frenzy-plant": {
    targeting: { kind: TargetingKind.Line, length: 5 },
    effects: [{ kind: EffectKind.Damage }],
    recharge: true,
  },
  "giga-impact": {
    targeting: { kind: TargetingKind.Dash, maxDistance: 4 },
    effects: [{ kind: EffectKind.Damage }],
    recharge: true,
  },
  "hydro-cannon": {
    targeting: { kind: TargetingKind.Line, length: 5 },
    effects: [{ kind: EffectKind.Damage }],
    recharge: true,
  },
  "solar-blade": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
    twoTurnCharge: true,
    sunSkipsCharge: true,
  },
  "meteor-beam": {
    targeting: { kind: TargetingKind.Line, length: 5 },
    effects: [{ kind: EffectKind.Damage }],
    twoTurnCharge: true,
    chargeEffects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.SpAttack,
        stages: 1,
        target: EffectTarget.Self,
      },
    ],
  },
  "play-nice": {
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [
      {
        kind: EffectKind.StatChange,
        stat: StatName.Attack,
        stages: -1,
        target: EffectTarget.Targets,
      },
    ],
    bypassAccuracy: true,
  },
  splash: {
    targeting: { kind: TargetingKind.Self },
    effects: [],
  },

  // --- Famille Item interaction (plan 142) ---
  "knock-off": {
    // Sabotage: melee Dark hit, ×1.5 if the target holds a removable item, then removes it.
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.RemoveItem }],
    knockOffBoost: true,
  },
  thief: {
    // Larcin: melee Dark hit; steals the target's item if the user is empty-handed.
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.StealItem }],
  },
  covet: {
    // Implore: melee Normal hit; steals the target's item if the user is empty-handed.
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.StealItem }],
  },
  trick: {
    // Tour de Magie: status, swaps held items with the target (range 1-3).
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.SwapItems }],
  },
  switcheroo: {
    // Passe-Passe: status, swaps held items with the target (range 1-3).
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.SwapItems }],
  },
  fling: {
    // Dégommage: throws the user's item (range 1-3). Power = the item's fling power; the item's
    // fling secondary then lands. Gated to a flingable item at use time.
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.FlingItem }],
    dynamicPower: { kind: DynamicPowerKind.HeldItemFling },
    requiresFlingableItem: true,
  },
  pluck: {
    // Picore: melee Flying hit; if the target holds a berry, the user eats it.
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.EatTargetBerry }],
  },
  "bug-bite": {
    // Piqûre: melee Bug hit; if the target holds a berry, the user eats it.
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.EatTargetBerry }],
  },
  incinerate: {
    // Calcination: ranged Fire special; destroys the target's berry or gem (no benefit).
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.BurnTargetItem }],
  },
  "corrosive-gas": {
    // Gaz Corrosif: status, removes the target's item (grid-adapted to Single 1-3, no AoE).
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.RemoveItem }],
  },
  recycle: {
    // Recyclage: self status, restores the user's last self-consumed item.
    targeting: { kind: TargetingKind.Self },
    effects: [{ kind: EffectKind.RecycleItem }],
  },
  belch: {
    // Éructation: ranged Poison special 120 BP; usable only after the user has eaten a berry.
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: EffectKind.Damage }],
    requiresEatenBerry: true,
  },
};
