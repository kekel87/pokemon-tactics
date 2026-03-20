import type { BattleEventType } from "../enums/battle-event-type";
import type { StatName } from "../enums/stat-name";
import type { StatusType } from "../enums/status-type";
import type { Position } from "./position";

export type BattleEvent =
  | { type: typeof BattleEventType.TurnStarted; pokemonId: string; roundNumber: number }
  | { type: typeof BattleEventType.TurnEnded; pokemonId: string }
  | { type: typeof BattleEventType.MoveStarted; attackerId: string; moveId: string }
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
  | {
      type: typeof BattleEventType.LinkCreated;
      sourceId: string;
      targetId: string;
      linkType: string;
    }
  | { type: typeof BattleEventType.LinkDrained; sourceId: string; targetId: string; amount: number }
  | { type: typeof BattleEventType.LinkBroken; sourceId: string; targetId: string }
  | { type: typeof BattleEventType.PokemonKo; pokemonId: string; countdownStart: number }
  | { type: typeof BattleEventType.PokemonEliminated; pokemonId: string }
  | { type: typeof BattleEventType.PokemonRevived; pokemonId: string; hp: number }
  | { type: typeof BattleEventType.MoveMissed; attackerId: string; targetId: string }
  | { type: typeof BattleEventType.BattleEnded; winnerId: string };
