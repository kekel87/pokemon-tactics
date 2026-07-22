import {
  Direction,
  type HeldItemId,
  type StatName,
  type StatusType,
  Weather,
} from "@pokemon-tactic/core";

export interface Position2D {
  x: number;
  y: number;
}

/** How a sandbox team is driven. */
export type TeamControl = "player" | "passive" | "scored";

/** AI difficulty for a "scored" team (maps to core EASY/MEDIUM/HARD profiles). */
export type AiProfileKey = "easy" | "medium" | "hard";

/** One Pokémon inside a sandbox team. All fields but `pokemon` are optional overrides. */
export interface SandboxMemberConfig {
  pokemon: string;
  /** Overrides the derived movepool head when non-empty. */
  moves?: string[];
  /** HP percentage (1-100). Omitted → 100. `0` spawns the member fainted (revive scenarios). */
  hp?: number;
  status?: StatusType | null;
  volatileStatus?: StatusType | null;
  statStages?: Partial<Record<StatName, number>>;
  heldItem?: HeldItemId;
  ability?: string;
  /** Explicit spawn tile. Omitted → resolved from the format's spawn zone (+ cascade fallback). */
  position?: Position2D;
  direction?: Direction;
  /** Single passive move played each turn when the team is in "passive" (scripted) control. */
  defensiveMove?: string | null;
}

export interface SandboxTeamConfig {
  control: TeamControl;
  /** Required when `control === "scored"`. Omitted → "hard". */
  aiProfile?: AiProfileKey;
  /** 1..6 members. */
  members: SandboxMemberConfig[];
}

export interface SandboxConfig {
  /** Battle RNG seed → deterministic, replayable run (e2e/recette). Omitted → 0. */
  seed?: number;
  /**
   * Sandbox studio RNG mode. "random" rolls a fresh seed each launch (respects
   * Pokémon RNG); "deterministic" replays `seed`. Absent → inferred from `seed`
   * presence (present = deterministic, absent = random). e2e passes `seed` only.
   */
  rngMode?: "random" | "deterministic";
  /** Optional Tiled map URL (relative to public/), e.g. "assets/maps/dev/sandbox-flat.tmj" */
  mapUrl?: string;
  weather?: Weather;
  weatherTurns?: number;
  /** Exactly two teams: Équipe 1 (Player1) and Équipe 2 (Player2). */
  teams: [SandboxTeamConfig, SandboxTeamConfig];
}

export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  mapUrl: "assets/maps/dev/sandbox-flat.tmj",
  weather: Weather.None,
  weatherTurns: 5,
  teams: [
    { control: "player", members: [{ pokemon: "venusaur" }] },
    { control: "passive", members: [{ pokemon: "dummy" }] },
  ],
};

/**
 * Legacy flat sandbox config (pre-teams). Kept only as the input shape for
 * {@link normalizeSandboxConfig}; every consumer works on the v2 `teams` shape.
 */
interface LegacySandboxConfig {
  seed?: number;
  rngMode?: "random" | "deterministic";
  pokemon: string;
  moves: string[];
  hp: number;
  status: StatusType | null;
  volatileStatus: StatusType | null;
  statStages: Partial<Record<StatName, number>>;
  playerPosition?: Position2D;
  playerDirection?: Direction;
  dummyPokemon: string;
  dummyControl: "ai" | "player";
  dummyMove: string | null;
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
  dummyPosition?: Position2D;
  mapUrl?: string;
  weather?: Weather;
  weatherTurns?: number;
}

const LEGACY_DEFAULTS: LegacySandboxConfig = {
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

function stripUndefined<T extends object>(value: T): T {
  for (const key of Object.keys(value) as (keyof T)[]) {
    if (value[key] === undefined) {
      delete value[key];
    }
  }
  return value;
}

function fromLegacy(raw: Partial<LegacySandboxConfig>): SandboxConfig {
  const flat: LegacySandboxConfig = { ...LEGACY_DEFAULTS, ...raw };

  const playerMember: SandboxMemberConfig = stripUndefined({
    pokemon: flat.pokemon,
    moves: flat.moves.length > 0 ? [...flat.moves] : undefined,
    hp: flat.hp,
    status: flat.status,
    volatileStatus: flat.volatileStatus,
    statStages: flat.statStages,
    heldItem: flat.heldItem,
    ability: flat.playerAbility,
    position: flat.playerPosition,
    direction: flat.playerDirection,
  });

  const dummyIsPlayer = flat.dummyControl === "player";
  const dummyMember: SandboxMemberConfig = stripUndefined({
    pokemon: flat.dummyPokemon,
    moves: dummyIsPlayer && flat.dummyMoves.length > 0 ? [...flat.dummyMoves] : undefined,
    hp: flat.dummyHp,
    status: flat.dummyStatus,
    volatileStatus: flat.dummyVolatileStatus,
    statStages: flat.dummyStatStages,
    heldItem: flat.dummyHeldItem,
    ability: flat.dummyAbility,
    position: flat.dummyPosition,
    direction: flat.dummyDirection,
    defensiveMove: flat.dummyMove,
  });

  return stripUndefined({
    seed: raw.seed,
    rngMode: raw.rngMode,
    mapUrl: flat.mapUrl,
    weather: flat.weather,
    weatherTurns: flat.weatherTurns,
    teams: [
      { control: "player", members: [playerMember] },
      { control: dummyIsPlayer ? "player" : "passive", members: [dummyMember] },
    ],
  });
}

function normalizeTeam(raw: Partial<SandboxTeamConfig> | undefined, fallback: SandboxTeamConfig) {
  if (!raw || !Array.isArray(raw.members) || raw.members.length === 0) {
    return fallback;
  }
  const control: TeamControl = raw.control ?? fallback.control;
  const team: SandboxTeamConfig = {
    control,
    members: raw.members.slice(0, 6).map((member) => ({ ...member })),
  };
  if (control === "scored") {
    team.aiProfile = raw.aiProfile ?? "hard";
  }
  return team;
}

/**
 * Accept any persisted sandbox config — legacy flat (pre-teams) or v2 (`teams`) —
 * and return a fully-defaulted v2 config. Legacy configs (all existing e2e fixtures,
 * saved URLs) map to a single-member player team vs a single-member team whose
 * control mirrors the old `dummyControl` ("ai" → "passive").
 */
export function normalizeSandboxConfig(raw: unknown): SandboxConfig {
  const rawConfig = (raw ?? {}) as Record<string, unknown>;
  if (!Array.isArray(rawConfig.teams)) {
    return fromLegacy(rawConfig as Partial<LegacySandboxConfig>);
  }
  const teamsRaw = rawConfig.teams as Partial<SandboxTeamConfig>[];
  return stripUndefined({
    seed: rawConfig.seed as number | undefined,
    rngMode: rawConfig.rngMode as SandboxConfig["rngMode"],
    mapUrl: (rawConfig.mapUrl as string | undefined) ?? DEFAULT_SANDBOX_CONFIG.mapUrl,
    weather: (rawConfig.weather as Weather | undefined) ?? DEFAULT_SANDBOX_CONFIG.weather,
    weatherTurns:
      (rawConfig.weatherTurns as number | undefined) ?? DEFAULT_SANDBOX_CONFIG.weatherTurns,
    teams: [
      normalizeTeam(teamsRaw[0], DEFAULT_SANDBOX_CONFIG.teams[0]),
      normalizeTeam(teamsRaw[1], DEFAULT_SANDBOX_CONFIG.teams[1]),
    ],
  });
}
