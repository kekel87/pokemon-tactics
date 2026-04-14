import type { BattleEventType } from "../enums/battle-event-type";
import type { DefensiveKind } from "../enums/defensive-kind";
import type { Direction } from "../enums/direction";
import type { StatName } from "../enums/stat-name";
import type { StatusType } from "../enums/status-type";
import type { TerrainType } from "../enums/terrain-type";
import type { Position } from "./position";

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
    }
  | { type: typeof BattleEventType.StatusApplied; targetId: string; status: StatusType }
  | { type: typeof BattleEventType.StatusRemoved; targetId: string; status: StatusType }
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
  | { type: typeof BattleEventType.TerrainDamageDealt; pokemonId: string; terrain: TerrainType; amount: number }
  | { type: typeof BattleEventType.TerrainStatusApplied; pokemonId: string; terrain: TerrainType; status: StatusType }
  | { type: typeof BattleEventType.IceSlideApplied; pokemonId: string; from: Position; to: Position }
  | { type: typeof BattleEventType.IceSlideCollision; sliderId: string; targetId: string; damage: number }
  | { type: typeof BattleEventType.LethalTerrainKo; pokemonId: string; terrain: TerrainType };
