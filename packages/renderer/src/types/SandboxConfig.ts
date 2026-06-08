import {
  Direction,
  type HeldItemId,
  type StatName,
  type StatusType,
  type TurnSystemKind,
  Weather,
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
  /** Control mode for dummy team. "ai" = single defensive move + DummyAiController. "player" = human input + 4 moves. */
  dummyControl: "ai" | "player";
  /** Single defensive move used when dummyControl === "ai". Ignored in player mode. */
  dummyMove: string | null;
  /** Up to 4 moves used when dummyControl === "player". Ignored in AI mode. Empty array falls back to movepool[:4]. */
  dummyMoves: string[];
  dummyDirection: Direction;
  dummyHp: number;
  dummyStatus: StatusType | null;
  dummyVolatileStatus: StatusType | null;
  dummyStatStages: Partial<Record<StatName, number>>;
  heldItem?: HeldItemId;
  dummyHeldItem?: HeldItemId;
  playerAbility?: string;
  dummyAbility?: string;
  /** Optional override for dummy spawn position. */
  dummyPosition?: Position2D;
  /** Optional Tiled map URL (relative to public/), e.g. "assets/maps/dev/sandbox-flat.tmj" */
  mapUrl?: string;
  /** Toggle the red debug diamonds over decoration footprints. */
  debugDecorationsFootprint?: boolean;
  weather?: Weather;
  weatherTurns?: number;
  /** Turn system for the sandbox battle (defaults to the engine default = Round-Robin). */
  turnSystemKind?: TurnSystemKind;
}

export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  pokemon: "venusaur",
  moves: [],
  hp: 100,
  status: null,
  volatileStatus: null,
  statStages: {},
  dummyPokemon: "dummy",
  dummyControl: "ai",
  dummyMove: null,
  dummyMoves: [],
  dummyDirection: Direction.South,
  dummyHp: 100,
  dummyStatus: null,
  dummyVolatileStatus: null,
  dummyStatStages: {},
  mapUrl: "assets/maps/dev/sandbox-flat.tmj",
  weather: Weather.None,
  weatherTurns: 5,
};
