import type {
  MoveDefinition,
  PokemonDefinition,
  PokemonInstance,
  TileState,
} from "@pokemon-tactic/core";
import {
  BattleEngine,
  type BattleState,
  PlayerId,
  directionFromTo,
  type PokemonType,
  StatName,
  TerrainType,
  TurnPipeline,
  validateBattleData,
} from "@pokemon-tactic/core";
import { loadData, typeChart } from "@pokemon-tactic/data";
import { GRID_SIZE } from "../constants";

function buildFlatGrid(size: number): TileState[][] {
  const tiles: TileState[][] = [];
  for (let y = 0; y < size; y++) {
    const row: TileState[] = [];
    for (let x = 0; x < size; x++) {
      row.push({
        position: { x, y },
        height: 0,
        terrain: TerrainType.Normal,
        occupantId: null,
        isPassable: true,
      });
    }
    tiles.push(row);
  }
  return tiles;
}

const ZERO_STAT_STAGES = {
  [StatName.Hp]: 0,
  [StatName.Attack]: 0,
  [StatName.Defense]: 0,
  [StatName.SpAttack]: 0,
  [StatName.SpDefense]: 0,
  [StatName.Speed]: 0,
  [StatName.Accuracy]: 0,
  [StatName.Evasion]: 0,
};

function createPokemonInstance(
  definition: PokemonDefinition,
  playerId: PlayerId,
  instanceId: string,
  position: { x: number; y: number },
  moveRegistry: Map<string, MoveDefinition>,
  gridSize: number,
): PokemonInstance {
  const hpStat = definition.baseStats.hp;
  const currentPp: Record<string, number> = {};
  for (const moveId of definition.movepool) {
    const move = moveRegistry.get(moveId);
    currentPp[moveId] = move?.pp ?? 0;
  }
  const gridCenter = { x: Math.floor(gridSize / 2), y: Math.floor(gridSize / 2) };
  return {
    id: instanceId,
    definitionId: definition.id,
    playerId,
    currentHp: hpStat,
    maxHp: hpStat,
    baseStats: { ...definition.baseStats },
    derivedStats: {
      movement: 3,
      jump: 1,
      initiative: definition.baseStats.speed,
    },
    statStages: { ...ZERO_STAT_STAGES },
    statusEffects: [],
    position,
    orientation: directionFromTo(position, gridCenter),
    moveIds: [...definition.movepool],
    currentPp,
  };
}

export interface BattleSetupResult {
  engine: BattleEngine;
  state: BattleState;
  pokemonDefinitions: Map<string, PokemonDefinition>;
  moveDefinitions: Map<string, MoveDefinition>;
}

export function createBattle(): BattleSetupResult {
  const gameData = loadData();

  const validation = validateBattleData(gameData);
  if (!validation.valid) {
    throw new Error(`Invalid battle data: ${validation.errors.join(", ")}`);
  }

  const pokemonDefinitions = new Map<string, PokemonDefinition>();
  for (const definition of gameData.pokemon) {
    pokemonDefinitions.set(definition.id, definition);
  }

  const moveDefinitions = new Map<string, MoveDefinition>();
  for (const move of gameData.moves) {
    moveDefinitions.set(move.id, move);
  }

  const bulbasaur = pokemonDefinitions.get("bulbasaur");
  const charmander = pokemonDefinitions.get("charmander");
  const squirtle = pokemonDefinitions.get("squirtle");
  const pidgey = pokemonDefinitions.get("pidgey");

  if (!bulbasaur || !charmander || !squirtle || !pidgey) {
    throw new Error("Missing Pokemon definitions for POC roster");
  }

  const team1Pokemon1 = createPokemonInstance(
    bulbasaur,
    PlayerId.Player1,
    "p1-bulbasaur",
    { x: 1, y: 10 },
    moveDefinitions,
    GRID_SIZE,
  );
  const team1Pokemon2 = createPokemonInstance(
    squirtle,
    PlayerId.Player1,
    "p1-squirtle",
    { x: 2, y: 11 },
    moveDefinitions,
    GRID_SIZE,
  );
  const team2Pokemon1 = createPokemonInstance(
    charmander,
    PlayerId.Player2,
    "p2-charmander",
    { x: 10, y: 1 },
    moveDefinitions,
    GRID_SIZE,
  );
  const team2Pokemon2 = createPokemonInstance(
    pidgey,
    PlayerId.Player2,
    "p2-pidgey",
    { x: 9, y: 0 },
    moveDefinitions,
    GRID_SIZE,
  );

  const allPokemon = [team1Pokemon1, team1Pokemon2, team2Pokemon1, team2Pokemon2];

  const grid = buildFlatGrid(GRID_SIZE);
  const pokemonMap = new Map<string, PokemonInstance>();
  for (const pokemon of allPokemon) {
    pokemonMap.set(pokemon.id, pokemon);
    const row = grid[pokemon.position.y];
    if (row) {
      const tile = row[pokemon.position.x];
      if (tile) {
        tile.occupantId = pokemon.id;
      }
    }
  }

  const state: BattleState = {
    grid,
    pokemon: pokemonMap,
    activeLinks: [],
    turnOrder: [],
    currentTurnIndex: 0,
    roundNumber: 1,
  };

  const pokemonTypesMap = new Map<string, PokemonType[]>();
  for (const definition of gameData.pokemon) {
    pokemonTypesMap.set(definition.id, definition.types);
  }

  const turnPipeline = new TurnPipeline();
  const engine = new BattleEngine(state, moveDefinitions, typeChart, pokemonTypesMap, turnPipeline);

  return { engine, state, pokemonDefinitions, moveDefinitions };
}
