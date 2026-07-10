import type { AuraKind } from "../enums/aura-kind";
import type { BattleEventType } from "../enums/battle-event-type";
import type { DefensiveKind } from "../enums/defensive-kind";
import type { Direction } from "../enums/direction";
import type { EntryHazardKind } from "../enums/entry-hazard-kind";
import type { FieldGlobalKind } from "../enums/field-global-kind";
import type { FieldTerrain } from "../enums/field-terrain";
import type { HitAndRunRetreatFallbackReason } from "../enums/hit-and-run-retreat-fallback-reason";
import type { MoveFailedReason } from "../enums/move-failed-reason";
import type { PokemonType } from "../enums/pokemon-type";
import type { StatName } from "../enums/stat-name";
import type { StatusImmuneReason } from "../enums/status-immune-reason";
import type { StatusType } from "../enums/status-type";
import type { TerrainType } from "../enums/terrain-type";
import type { Weather } from "../enums/weather";
import type { Position } from "./position";

export const AuraDissipatedReason = {
  Expired: "expired",
  CasterKo: "casterKo",
} as const;
export type AuraDissipatedReason = (typeof AuraDissipatedReason)[keyof typeof AuraDissipatedReason];

/** Why a Pokémon's type changed (type-manip family) — drives the battle-log line. */
export const TypeChangeReason = {
  Conversion: "conversion",
  ConversionResist: "conversion-2",
  ReflectType: "reflect-type",
  Soak: "soak",
  BurnUp: "burn-up",
} as const;
export type TypeChangeReason = (typeof TypeChangeReason)[keyof typeof TypeChangeReason];

/** Why a Pokémon's ability changed (ability-manip family, plan 153) — drives the battle-log line. */
export const AbilityChangeReason = {
  SetByMove: "set-by-move",
  GastroAcid: "gastro-acid",
  RolePlay: "role-play",
  SkillSwap: "skill-swap",
} as const;
export type AbilityChangeReason = (typeof AbilityChangeReason)[keyof typeof AbilityChangeReason];

export const ProtectionReason = {
  Mist: "mist",
  Safeguard: "safeguard",
  Substitute: "substitute",
  MistyTerrain: "misty_terrain",
  ElectricTerrain: "electric_terrain",
  HeldItem: "held_item",
  /** Brouhaha (uproar): the din of a nearby uproar prevents sleep (plan 149). */
  UproarNoise: "uproar_noise",
} as const;
export type ProtectionReason = (typeof ProtectionReason)[keyof typeof ProtectionReason];

export const SubstituteFailedReason = {
  AlreadyActive: "already_active",
  InsufficientHp: "insufficient_hp",
} as const;
export type SubstituteFailedReason =
  (typeof SubstituteFailedReason)[keyof typeof SubstituteFailedReason];

export type BattleEvent =
  | { type: typeof BattleEventType.TurnStarted; pokemonId: string }
  | { type: typeof BattleEventType.TurnEnded; pokemonId: string }
  | {
      type: typeof BattleEventType.MoveStarted;
      attackerId: string;
      moveId: string;
      direction: Direction;
      /** B4 morph: the move actually resolved (Nature Power → psychic, Terrain Pulse type morph). */
      resolvedMoveId?: string;
      /** B4 Terrain Pulse: the type the move morphed into (for the "becomes type X" log). */
      resolvedType?: PokemonType;
    }
  | { type: typeof BattleEventType.PokemonMoved; pokemonId: string; path: Position[] }
  | {
      type: typeof BattleEventType.PokemonDashed;
      pokemonId: string;
      path: Position[];
      hitId?: string;
    }
  | {
      type: typeof BattleEventType.DamageDealt;
      targetId: string;
      amount: number;
      effectiveness: number;
      recoil?: boolean;
      absorbedBySubstitute?: number;
      /** OHKO hit (K.O. en un coup): the floating text shows "K.O.!" instead of the (max-HP) number. */
      ohko?: boolean;
    }
  | { type: typeof BattleEventType.StatusApplied; targetId: string; status: StatusType }
  | { type: typeof BattleEventType.StatusRemoved; targetId: string; status: StatusType }
  | {
      type: typeof BattleEventType.StatusImmune;
      targetId: string;
      status: StatusType;
      reason?: StatusImmuneReason;
    }
  | { type: typeof BattleEventType.StatChanged; targetId: string; stat: StatName; stages: number }
  | { type: typeof BattleEventType.PokemonKo; pokemonId: string; countdownStart: number }
  | { type: typeof BattleEventType.PokemonEliminated; pokemonId: string }
  | {
      type: typeof BattleEventType.PokemonRevived;
      pokemonId: string;
      hp: number;
      /** Vœu Soin (healing-wish, plan 147): the caster that sacrificed itself. */
      casterId: string;
      /** True when the target was KO'd (a revive); false when it was a living heal. */
      revived: boolean;
    }
  | { type: typeof BattleEventType.MoveMissed; attackerId: string; targetId: string }
  | {
      type: typeof BattleEventType.DefenseActivated;
      pokemonId: string;
      defenseKind: DefensiveKind;
    }
  | { type: typeof BattleEventType.DefenseCleared; pokemonId: string; defenseKind: DefensiveKind }
  | {
      type: typeof BattleEventType.DefenseTriggered;
      defenderId: string;
      defenseKind: DefensiveKind;
      blocked: boolean;
    }
  | { type: typeof BattleEventType.BattleEnded; winnerId: string | null }
  | { type: typeof BattleEventType.ConfusionTriggered; pokemonId: string }
  | {
      type: typeof BattleEventType.ConfusionRedirected;
      pokemonId: string;
      originalTarget?: string;
      newTarget?: string;
      originalDirection?: Direction;
      newDirection?: Direction;
    }
  | { type: typeof BattleEventType.ConfusionResisted; pokemonId: string }
  | { type: typeof BattleEventType.ConfusionFailed; pokemonId: string; reason: string }
  | { type: typeof BattleEventType.InfatuationTriggered; pokemonId: string; sourceId: string }
  | { type: typeof BattleEventType.InfatuationResisted; pokemonId: string; sourceId: string }
  | {
      type: typeof BattleEventType.KnockbackApplied;
      pokemonId: string;
      from: Position;
      to: Position;
    }
  | {
      type: typeof BattleEventType.KnockbackBlocked;
      pokemonId: string;
      reason: string;
    }
  | {
      type: typeof BattleEventType.MultiHitComplete;
      attackerId: string;
      targetId: string;
      totalHits: number;
    }
  | { type: typeof BattleEventType.RechargeStarted; pokemonId: string }
  | { type: typeof BattleEventType.RechargeEnded; pokemonId: string }
  | {
      type: typeof BattleEventType.FallDamageDealt;
      pokemonId: string;
      amount: number;
      heightDiff: number;
    }
  | {
      type: typeof BattleEventType.WallImpactDealt;
      pokemonId: string;
      amount: number;
      heightDiff: number;
    }
  | {
      type: typeof BattleEventType.TerrainDamageDealt;
      pokemonId: string;
      terrain: TerrainType;
      amount: number;
    }
  | {
      type: typeof BattleEventType.TerrainStatusApplied;
      pokemonId: string;
      terrain: TerrainType;
      status: StatusType;
    }
  | {
      type: typeof BattleEventType.IceSlideApplied;
      pokemonId: string;
      from: Position;
      to: Position;
    }
  | {
      type: typeof BattleEventType.IceSlideCollision;
      sliderId: string;
      targetId: string;
      damage: number;
    }
  | { type: typeof BattleEventType.LethalTerrainKo; pokemonId: string; terrain: TerrainType }
  | { type: typeof BattleEventType.MoveCancelled; pokemonId: string; position: Position }
  | {
      type: typeof BattleEventType.AbilityActivated;
      pokemonId: string;
      abilityId: string;
      targetIds: string[];
    }
  | {
      type: typeof BattleEventType.HeldItemActivated;
      pokemonId: string;
      itemId: string;
      targetIds: string[];
    }
  | { type: typeof BattleEventType.HeldItemConsumed; pokemonId: string; itemId: string }
  | { type: typeof BattleEventType.ItemKnockedOff; pokemonId: string; itemId: string }
  | {
      type: typeof BattleEventType.ItemStolen;
      thiefId: string;
      victimId: string;
      itemId: string;
    }
  | {
      type: typeof BattleEventType.ItemsSwapped;
      pokemonId: string;
      otherId: string;
      itemId?: string;
      otherItemId?: string;
    }
  | { type: typeof BattleEventType.ItemBurned; pokemonId: string; itemId: string }
  | { type: typeof BattleEventType.BerryEaten; eaterId: string; itemId: string }
  | { type: typeof BattleEventType.ItemRecycled; pokemonId: string; itemId: string }
  | { type: typeof BattleEventType.ItemFlung; pokemonId: string; itemId: string }
  | { type: typeof BattleEventType.ItemMoveFailed; pokemonId: string }
  | { type: typeof BattleEventType.CriticalHit; targetId: string }
  | { type: typeof BattleEventType.HpRestored; pokemonId: string; amount: number }
  | {
      type: typeof BattleEventType.WeatherSet;
      weather: Weather;
      turns: number;
      setterPokemonId?: string;
    }
  | { type: typeof BattleEventType.WeatherCleared; weather: Weather }
  | {
      type: typeof BattleEventType.WeatherDamage;
      pokemonId: string;
      amount: number;
      weather: Weather;
    }
  | {
      type: typeof BattleEventType.WeatherWar;
      previousWeather: Weather;
      newWeather: Weather;
      winnerPokemonId: string;
    }
  | { type: typeof BattleEventType.MoveCharging; pokemonId: string; moveId: string }
  | {
      type: typeof BattleEventType.Teleported;
      pokemonId: string;
      fromPosition: Position;
      toPosition: Position;
      targetTile: Position;
    }
  | {
      type: typeof BattleEventType.HitAndRunRetreat;
      pokemonId: string;
      fromPosition: Position;
      toPosition: Position;
    }
  | {
      type: typeof BattleEventType.HitAndRunRetreatFallback;
      pokemonId: string;
      reason: HitAndRunRetreatFallbackReason;
    }
  | {
      type: typeof BattleEventType.BatonPassed;
      casterId: string;
      targetId: string;
    }
  | { type: typeof BattleEventType.Flinched; pokemonId: string }
  | {
      type: typeof BattleEventType.AuraPosted;
      casterId: string;
      kind: AuraKind;
      durationRounds: number;
    }
  | {
      type: typeof BattleEventType.AuraDissipated;
      casterId: string;
      kind: AuraKind;
      reason: AuraDissipatedReason;
    }
  | {
      type: typeof BattleEventType.AuraBroken;
      casterId: string;
      kind: AuraKind;
      breakerId: string;
      breakerMoveId: string;
    }
  | {
      type: typeof BattleEventType.FieldTerrainPosted;
      casterId: string;
      kind: FieldTerrain;
      anchor: Position;
      tiles: Position[];
      durationTurns: number;
    }
  | {
      type: typeof BattleEventType.FieldTerrainExpired;
      casterId: string;
      kind: FieldTerrain;
    }
  | {
      type: typeof BattleEventType.DashBlockedByPsychicTerrain;
      pokemonId: string;
      blockedAt: Position;
    }
  | {
      type: typeof BattleEventType.DistortionPosted;
      casterId: string;
      anchor: Position;
      tiles: Position[];
      durationTurns: number;
    }
  | {
      type: typeof BattleEventType.DistortionExpired;
      casterId: string;
    }
  | {
      type: typeof BattleEventType.FieldGlobalPosted;
      casterId: string;
      kind: FieldGlobalKind;
      anchor: Position;
      tiles: Position[];
      durationTurns: number;
    }
  | {
      type: typeof BattleEventType.FieldGlobalExpired;
      casterId: string;
      kind: FieldGlobalKind;
    }
  | {
      type: typeof BattleEventType.TailwindSet;
      casterId: string;
      direction: Direction;
      turns: number;
    }
  | { type: typeof BattleEventType.TailwindEnded; casterId: string }
  | {
      type: typeof BattleEventType.GravityMoveBlocked;
      pokemonId: string;
      moveId: string;
    }
  | {
      type: typeof BattleEventType.EntryHazardPosted;
      kind: EntryHazardKind;
      tile: Position;
      layers: number;
    }
  | {
      type: typeof BattleEventType.EntryHazardTriggered;
      pokemonId: string;
      kind: EntryHazardKind;
      tile: Position;
      /** HP lost (Picots / Pièges de Roc). */
      damage?: number;
      /** Status inflicted (Pics Toxik → Poisoned / BadlyPoisoned). */
      status?: StatusType;
      /** Speed stages dropped (Toile Gluante, negative). */
      speedStages?: number;
    }
  | {
      type: typeof BattleEventType.EntryHazardRemoved;
      tiles: Position[];
    }
  | {
      type: typeof BattleEventType.EntryHazardAbsorbed;
      pokemonId: string;
      tile: Position;
    }
  | {
      type: typeof BattleEventType.StatChangeBlocked;
      pokemonId: string;
      stat: StatName;
      reason: ProtectionReason;
      protectingCasterId?: string;
    }
  | {
      type: typeof BattleEventType.StatusBlocked;
      pokemonId: string;
      status: StatusType;
      reason: ProtectionReason;
      protectingCasterId?: string;
    }
  | {
      type: typeof BattleEventType.SubstitutePosted;
      pokemonId: string;
      hp: number;
    }
  | {
      type: typeof BattleEventType.SubstituteDamaged;
      pokemonId: string;
      damage: number;
      remaining: number;
    }
  | {
      type: typeof BattleEventType.SubstituteBroken;
      pokemonId: string;
      breakerId: string;
      breakerMoveId: string;
    }
  | {
      type: typeof BattleEventType.SubstituteFailed;
      pokemonId: string;
      reason: SubstituteFailedReason;
    }
  | {
      type: typeof BattleEventType.TauntBlocked;
      pokemonId: string;
      moveId: string;
    }
  | {
      type: typeof BattleEventType.MoveDisabled;
      pokemonId: string;
      moveId: string;
      turns: number;
    }
  | {
      type: typeof BattleEventType.MoveEncored;
      pokemonId: string;
      moveId: string;
      turns: number;
    }
  | {
      type: typeof BattleEventType.DisableBlocked;
      pokemonId: string;
      moveId: string;
    }
  | {
      type: typeof BattleEventType.EncoreBlocked;
      pokemonId: string;
      moveId: string;
    }
  | {
      type: typeof BattleEventType.DisableFailed;
      pokemonId: string;
    }
  | {
      type: typeof BattleEventType.EncoreFailed;
      pokemonId: string;
    }
  | {
      type: typeof BattleEventType.WishPosted;
      casterId: string;
      targetId: string;
    }
  | {
      type: typeof BattleEventType.WishHealed;
      pokemonId: string;
      amount: number;
    }
  | {
      type: typeof BattleEventType.MoveFailed;
      attackerId: string;
      moveId: string;
      /** Reactive-charge family (plan 150): why the move fizzled (Mitra-Poing struck / Carapiège not armed). */
      reason?: MoveFailedReason;
    }
  | {
      type: typeof BattleEventType.FocusInterrupted;
      pokemonId: string;
      moveId: string;
    }
  | {
      type: typeof BattleEventType.BeakBlastBurn;
      /** The charging Bec-Canon user whose beak burned the attacker. */
      pokemonId: string;
      /** The mon that made contact and got burned. */
      targetId: string;
    }
  | {
      type: typeof BattleEventType.ShellTrapArmed;
      pokemonId: string;
    }
  | { type: typeof BattleEventType.Imprisoned; pokemonId: string }
  | { type: typeof BattleEventType.ImprisonFailed; pokemonId: string }
  | { type: typeof BattleEventType.HealPrevented; pokemonId: string }
  | { type: typeof BattleEventType.SpiteApplied; pokemonId: string; ctPenalty: number }
  | { type: typeof BattleEventType.SpiteFailed; pokemonId: string }
  | {
      type: typeof BattleEventType.FutureSightPosted;
      casterId: string;
      tile: Position;
    }
  | { type: typeof BattleEventType.FutureSightFailed; attackerId: string }
  | {
      type: typeof BattleEventType.FutureSightStruck;
      casterId: string;
      tile: Position;
      /** Per-occupant hits of the landing AoE (empty if the locked area was vacated). */
      hits: { pokemonId: string; damage: number; fainted: boolean }[];
    }
  | {
      type: typeof BattleEventType.PerishAuraPosted;
      casterId: string;
      radius: number;
      turns: number;
    }
  | { type: typeof BattleEventType.PerishAuraTick; casterId: string; turns: number }
  | { type: typeof BattleEventType.PerishKo; pokemonId: string }
  | {
      type: typeof BattleEventType.PainSplitApplied;
      casterId: string;
      targetId: string;
      pooledHp: number;
    }
  | {
      type: typeof BattleEventType.EndeavorApplied;
      attackerId: string;
      targetId: string;
      damage: number;
    }
  | { type: typeof BattleEventType.EndeavorFailed; attackerId: string }
  | {
      type: typeof BattleEventType.SuperFangApplied;
      attackerId: string;
      targetId: string;
      damage: number;
    }
  | { type: typeof BattleEventType.SmackedDown; targetId: string }
  | { type: typeof BattleEventType.HelpingHandPosted; casterId: string; targetId: string }
  | { type: typeof BattleEventType.HelpingHandConsumed; pokemonId: string }
  | {
      type: typeof BattleEventType.TypeChanged;
      pokemonId: string;
      newTypes: PokemonType[];
      reason: TypeChangeReason;
    }
  | {
      type: typeof BattleEventType.MoveCopied;
      pokemonId: string;
      /** The source move slot that was overwritten (mimic / sketch). */
      slotMoveId: string;
      /** The move id copied into the slot (the target's last used move). */
      copiedMoveId: string;
    }
  | { type: typeof BattleEventType.MoveCopyFailed; pokemonId: string; moveId: string }
  | { type: typeof BattleEventType.StatStagesReset; pokemonIds: string[] }
  | { type: typeof BattleEventType.StatStagesCopied; casterId: string; targetId: string }
  | { type: typeof BattleEventType.StatStagesInverted; targetId: string }
  | {
      type: typeof BattleEventType.StatStagesSwapped;
      casterId: string;
      targetId: string;
      stats: StatName[];
    }
  | { type: typeof BattleEventType.SpeedSwapped; casterId: string; targetId: string }
  | {
      type: typeof BattleEventType.FinalGambitApplied;
      attackerId: string;
      targetId: string;
      damage: number;
    }
  | { type: typeof BattleEventType.ReviveOrHealFailed; casterId: string }
  | { type: typeof BattleEventType.DestinyBondPosted; casterId: string }
  | { type: typeof BattleEventType.DestinyBondTriggered; casterId: string; victimId: string }
  | { type: typeof BattleEventType.GrudgePosted; casterId: string }
  | {
      type: typeof BattleEventType.GrudgeTriggered;
      casterId: string;
      attackerId: string;
      moveId: string;
    }
  | { type: typeof BattleEventType.OneHitKo; targetId: string }
  | {
      type: typeof BattleEventType.LockInStarted;
      pokemonId: string;
      moveId: string;
      turns: number;
    }
  | { type: typeof BattleEventType.CritStageRaised; targetId: string; stages: number }
  | { type: typeof BattleEventType.GuaranteedCritArmed; pokemonId: string }
  | {
      type: typeof BattleEventType.AbilityChanged;
      pokemonId: string;
      /** The new effective ability id, or undefined when the ability was suppressed (Suc Digestif). */
      abilityId?: string;
      reason: AbilityChangeReason;
    };
