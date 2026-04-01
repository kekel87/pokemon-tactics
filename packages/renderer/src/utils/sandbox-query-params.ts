import { Direction, StatName, StatusType } from "@pokemon-tactic/core";
import { loadData } from "@pokemon-tactic/data";
import type { SandboxConfig } from "../types/SandboxConfig";

const VALID_STATUSES = new Set<string>(Object.values(StatusType));
const VALID_DIRECTIONS = new Set<string>(Object.values(Direction));

const DEFAULT_POKEMON: string = "bulbasaur";
const DEFAULT_DUMMY_POKEMON: string = "dummy";
const DEFAULT_DUMMY_DIRECTION: Direction = Direction.South;

function parseStatStages(raw: string | null): Partial<Record<StatName, number>> {
  if (!raw) {
    return {};
  }
  const stages: Partial<Record<StatName, number>> = {};
  for (const pair of raw.split(",")) {
    const [stat, valueStr] = pair.split(":");
    if (!stat || !valueStr) {
      continue;
    }
    const value = Number(valueStr);
    if (Number.isNaN(value)) {
      continue;
    }
    const clamped = Math.max(-6, Math.min(6, value));
    const statValues = Object.values(StatName) as string[];
    if (statValues.includes(stat)) {
      stages[stat as StatName] = clamped;
    }
  }
  return stages;
}

export function parseSandboxQueryParams(
  search: string = window.location.search,
): SandboxConfig | null {
  const params = new URLSearchParams(search);
  if (!params.has("sandbox")) {
    return null;
  }

  const gameData = loadData();
  const validPokemonIds = new Set(gameData.pokemon.map((p) => p.id));
  const validMoveIds = new Set(gameData.moves.map((m) => m.id));

  const rawPokemon = params.get("pokemon");
  const pokemon = rawPokemon && validPokemonIds.has(rawPokemon) ? rawPokemon : DEFAULT_POKEMON;

  const pokemonDef = gameData.pokemon.find((p) => p.id === pokemon);
  const defaultMoves = pokemonDef?.movepool ?? [];

  const rawMoves = params.get("moves");
  const moves = rawMoves
    ? rawMoves.split(",").filter((m) => validMoveIds.has(m))
    : [...defaultMoves];

  const rawHp = params.get("hp");
  const parsedHp = rawHp !== null ? Number(rawHp) : null;
  const hp =
    parsedHp !== null && !Number.isNaN(parsedHp) ? Math.max(1, Math.min(100, parsedHp)) : 100;

  const rawStatus = params.get("status");
  const status = rawStatus && VALID_STATUSES.has(rawStatus) ? (rawStatus as StatusType) : null;

  const statStages = parseStatStages(params.get("statStages"));

  const rawDummyPokemon = params.get("dummy");
  const dummyPokemon =
    rawDummyPokemon && validPokemonIds.has(rawDummyPokemon)
      ? rawDummyPokemon
      : DEFAULT_DUMMY_POKEMON;

  const rawDummyMove = params.get("dummyMove");
  const dummyMove = rawDummyMove && validMoveIds.has(rawDummyMove) ? rawDummyMove : null;

  const rawDummyDirection = params.get("dummyDirection");
  const dummyDirection =
    rawDummyDirection && VALID_DIRECTIONS.has(rawDummyDirection)
      ? (rawDummyDirection as Direction)
      : DEFAULT_DUMMY_DIRECTION;

  const rawDummyHp = params.get("dummyHp");
  const parsedDummyHp = rawDummyHp !== null ? Number(rawDummyHp) : null;
  const dummyHp =
    parsedDummyHp !== null && !Number.isNaN(parsedDummyHp)
      ? Math.max(1, Math.min(100, parsedDummyHp))
      : 100;

  const rawDummyStatus = params.get("dummyStatus");
  const dummyStatus =
    rawDummyStatus && VALID_STATUSES.has(rawDummyStatus) ? (rawDummyStatus as StatusType) : null;

  const dummyStatStages = parseStatStages(params.get("dummyStatStages"));

  const rawDummyLevel = params.get("dummyLevel");
  const parsedDummyLevel = rawDummyLevel !== null ? Number(rawDummyLevel) : null;
  const dummyLevel =
    parsedDummyLevel !== null && !Number.isNaN(parsedDummyLevel)
      ? Math.max(1, Math.min(100, parsedDummyLevel))
      : 50;

  return {
    pokemon,
    moves,
    hp,
    status,
    statStages,
    dummyPokemon,
    dummyMove,
    dummyDirection,
    dummyHp,
    dummyLevel,
    dummyBaseStats: null,
    dummyStatus,
    dummyStatStages,
  };
}
