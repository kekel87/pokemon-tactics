import type { TeamSet } from "@pokemon-tactic/core";

const STORAGE_KEY = "pokemon-tactics:teams";
const SCHEMA_VERSION = 1;

interface TeamStorageSchema {
  version: number;
  teams: Record<string, TeamSet>;
}

export interface TeamSummary {
  id: string;
  name: string;
  pokemonCount: number;
  updatedAt: number;
}

function readStorage(): TeamStorageSchema {
  const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
  if (raw === null || raw === undefined) {
    return { version: SCHEMA_VERSION, teams: {} };
  }
  try {
    const parsed = JSON.parse(raw) as TeamStorageSchema;
    if (parsed.version !== SCHEMA_VERSION) {
      return { version: SCHEMA_VERSION, teams: {} };
    }
    return parsed;
  } catch {
    return { version: SCHEMA_VERSION, teams: {} };
  }
}

function writeStorage(data: TeamStorageSchema): void {
  globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function listTeamSummaries(): TeamSummary[] {
  const schema = readStorage();
  return Object.values(schema.teams).map((team) => ({
    id: team.id,
    name: team.name,
    pokemonCount: team.slots.length,
    updatedAt: team.updatedAt,
  }));
}

export function loadTeam(id: string): TeamSet | null {
  const schema = readStorage();
  return schema.teams[id] ?? null;
}

export function saveTeam(team: TeamSet): void {
  const schema = readStorage();
  schema.teams[team.id] = team;
  writeStorage(schema);
}

export function deleteTeam(id: string): void {
  const schema = readStorage();
  delete schema.teams[id];
  writeStorage(schema);
}

export function clearAllTeams(): void {
  writeStorage({ version: SCHEMA_VERSION, teams: {} });
}
