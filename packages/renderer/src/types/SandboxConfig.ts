import {
  type BaseStats,
  Direction,
  type HeldItemId,
  type StatName,
  type StatusType,
} from "@pokemon-tactic/core";

export interface Position2D {
  x: number;
  y: number;
}

export interface SandboxConfig {
  pokemon: string;
  moves: string[];
  hp: number;
  status: StatusType | null;
  volatileStatus: StatusType | null;
  statStages: Partial<Record<StatName, number>>;
  /** Optional override for player spawn position (otherwise uses map spawn zone 0). */
  playerPosition?: Position2D;
  /** Optional override for player orientation. */
  playerDirection?: Direction;
  dummyPokemon: string;
  dummyMove: string | null;
  dummyDirection: Direction;
  dummyHp: number;
  dummyLevel: number;
  dummyBaseStats: BaseStats | null;
  dummyStatus: StatusType | null;
  dummyVolatileStatus: StatusType | null;
  dummyStatStages: Partial<Record<StatName, number>>;
  heldItem?: HeldItemId;
  dummyHeldItem?: HeldItemId;
  /** Optional override for dummy spawn position. */
  dummyPosition?: Position2D;
  /** Optional Tiled map URL (relative to public/), e.g. "assets/maps/dev/sandbox-flat.tmj" */
  mapUrl?: string;
  /** Toggle the red debug diamonds over decoration footprints. */
  debugDecorationsFootprint?: boolean;
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
  mapUrl: "assets/maps/dev/sandbox-flat.tmj",
};
