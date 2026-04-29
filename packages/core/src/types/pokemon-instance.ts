import type { Direction } from "../enums/direction";
import type { PlayerId } from "../enums/player-id";
import type { StatName } from "../enums/stat-name";
import type { ActiveDefense } from "./active-defense";
import type { BaseStats } from "./base-stats";
import type { DerivedStats } from "./derived-stats";
import type { Position } from "./position";
import type { StatusEffect } from "./status-effect";
import type { VolatileStatus } from "./volatile-status";

export interface PokemonInstance {
  id: string;
  definitionId: string;
  playerId: PlayerId;
  level: number;
  currentHp: number;
  maxHp: number;
  baseStats: BaseStats;
  combatStats: BaseStats;
  derivedStats: DerivedStats;
  statStages: Record<StatName, number>;
  statusEffects: StatusEffect[];
  position: Position;
  orientation: Direction;
  moveIds: string[];
  currentPp: Record<string, number>;
  activeDefense: ActiveDefense | null;
  lastEndureRound: number | null;
  toxicCounter: number;
  volatileStatuses: VolatileStatus[];
  recharging: boolean;
  abilityId?: string;
  abilityFirstTriggered?: boolean;
}
