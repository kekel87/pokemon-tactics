import type { BaseStats, Direction, StatName, StatusType } from "@pokemon-tactic/core";

export interface SandboxConfig {
  pokemon: string;
  moves: string[];
  hp: number;
  status: StatusType | null;
  statStages: Partial<Record<StatName, number>>;
  dummyPokemon: string;
  dummyMove: string | null;
  dummyDirection: Direction;
  dummyHp: number;
  dummyLevel: number;
  dummyBaseStats: BaseStats | null;
  dummyStatus: StatusType | null;
  dummyStatStages: Partial<Record<StatName, number>>;
}
