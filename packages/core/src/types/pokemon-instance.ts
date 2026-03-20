import type { Direction } from "../enums/direction";
import type { StatName } from "../enums/stat-name";
import type { BaseStats } from "./base-stats";
import type { DerivedStats } from "./derived-stats";
import type { Position } from "./position";
import type { StatusEffect } from "./status-effect";

export interface PokemonInstance {
  id: string;
  definitionId: string;
  playerId: string;
  currentHp: number;
  maxHp: number;
  baseStats: BaseStats;
  derivedStats: DerivedStats;
  statStages: Record<StatName, number>;
  statusEffects: StatusEffect[];
  position: Position;
  orientation: Direction;
  moveIds: string[];
  currentPp: Record<string, number>;
  koCountdown: number | null;
}
