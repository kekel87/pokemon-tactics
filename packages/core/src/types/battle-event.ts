import type { AuraKind } from "../enums/aura-kind";
import type { BattleEventType } from "../enums/battle-event-type";
import type { DefensiveKind } from "../enums/defensive-kind";
import type { Direction } from "../enums/direction";
import type { FieldTerrain } from "../enums/field-terrain";
import type { HitAndRunRetreatFallbackReason } from "../enums/hit-and-run-retreat-fallback-reason";
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

export const ProtectionReason = {
  Mist: "mist",
  Safeguard: "safeguard",
  Substitute: "substitute",
  MistyTerrain: "misty_terrain",
  ElectricTerrain: "electric_terrain",
} as const;
export type ProtectionReason = (typeof ProtectionReason)[keyof typeof ProtectionReason];

export const SubstituteFailedReason = {
  AlreadyActive: "already_active",
  InsufficientHp: "insufficient_hp",
} as const;
export type SubstituteFailedReason =
  (typeof SubstituteFailedReason)[keyof typeof SubstituteFailedReason];

export type BattleEvent =
  | { type: typeof BattleEventType.TurnStarted; pokemonId: string; roundNumber: number }
  | { type: typeof BattleEventType.TurnEnded; pokemonId: string }
  | {
      type: typeof BattleEventType.MoveStarted;
      attackerId: string;
      moveId: string;
      direction: Direction;
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
  | { type: typeof BattleEventType.PokemonRevived; pokemonId: string; hp: number }
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
  | { type: typeof BattleEventType.BattleEnded; winnerId: string }
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
    };
