import { type BaseStats, Direction, type StatName, type StatusType } from "@pokemon-tactic/core";

export interface SandboxConfig {
  pokemon: string;
  moves: string[];
  hp: number;
  status: StatusType | null;
  volatileStatus: StatusType | null;
  statStages: Partial<Record<StatName, number>>;
  dummyPokemon: string;
  dummyMove: string | null;
  dummyDirection: Direction;
  dummyHp: number;
  dummyLevel: number;
  dummyBaseStats: BaseStats | null;
  dummyStatus: StatusType | null;
  dummyVolatileStatus: StatusType | null;
  dummyStatStages: Partial<Record<StatName, number>>;
}

export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  pokemon: "bulbasaur",
  moves: [],
  hp: 100,
  status: null,
  volatileStatus: null,
  statStages: {},
  dummyPokemon: "dummy",
  dummyMove: null,
  dummyDirection: Direction.South,
  dummyHp: 100,
  dummyLevel: 50,
  dummyBaseStats: null,
  dummyStatus: null,
  dummyVolatileStatus: null,
  dummyStatStages: {},
};
