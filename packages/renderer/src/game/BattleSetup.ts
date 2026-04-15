import type {
  Direction,
  MapDefinition,
  MoveDefinition,
  PlacementEntry,
  PlacementTeam,
  PokemonDefinition,
  PokemonInstance,
  TileState,
} from "@pokemon-tactic/core";
import {
  BattleEngine,
  type BattleState,
  computeCombatStats,
  computeMovement,
  PlacementMode,
  PlacementPhase,
  PlayerController,
  PlayerId,
  type PokemonType,
  StatName,
  TurnPipeline,
  type TurnSystemKind,
  validateBattleData,
  validateMapDefinition,
} from "@pokemon-tactic/core";
import { loadData, pocArena, typeChart } from "@pokemon-tactic/data";

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

const BATTLE_LEVEL = 50;

function createPokemonInstance(
  definition: PokemonDefinition,
  playerId: PlayerId,
  instanceId: string,
  position: { x: number; y: number },
  orientation: Direction,
  moveRegistry: Map<string, MoveDefinition>,
): PokemonInstance {
  const currentPp: Record<string, number> = {};
  for (const moveId of definition.movepool) {
    const move = moveRegistry.get(moveId);
    currentPp[moveId] = move?.pp ?? 0;
  }
  const combatStats = computeCombatStats(definition.baseStats, BATTLE_LEVEL);
  return {
    id: instanceId,
    definitionId: definition.id,
    playerId,
    level: BATTLE_LEVEL,
    currentHp: combatStats.hp,
    maxHp: combatStats.hp,
    baseStats: { ...definition.baseStats },
    combatStats,
    derivedStats: {
      movement: computeMovement(definition.baseStats.speed, 0),
      jump: 1,
      initiative: combatStats.speed,
    },
    statStages: { ...ZERO_STAT_STAGES },
    statusEffects: [],
    position,
    orientation,
    moveIds: [...definition.movepool],
    currentPp,
    activeDefense: null,
    lastEndureRound: null,
    toxicCounter: 0,
    volatileStatuses: [],
    recharging: false,
  };
}

export interface BattleSetupResult {
  engine: BattleEngine;
  state: BattleState;
  pokemonDefinitions: Map<string, PokemonDefinition>;
  moveDefinitions: Map<string, MoveDefinition>;
  map: MapDefinition;
}

export interface BattleSetupConfig {
  map: MapDefinition;
  teams: PlacementTeam[];
  placements: PlacementEntry[];
  turnSystemKind?: TurnSystemKind;
}

function loadGameData() {
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

  const pokemonTypesMap = new Map<string, PokemonType[]>();
  for (const definition of gameData.pokemon) {
    pokemonTypesMap.set(definition.id, definition.types);
  }

  return { gameData, pokemonDefinitions, moveDefinitions, pokemonTypesMap };
}

export function createBattleFromPlacements(config: BattleSetupConfig): BattleSetupResult {
  const { pokemonDefinitions, moveDefinitions, pokemonTypesMap } = loadGameData();

  const mapValidation = validateMapDefinition(config.map);
  if (!mapValidation.valid) {
    throw new Error(`Invalid map: ${mapValidation.errors.join(", ")}`);
  }

  const grid: TileState[][] = config.map.tiles.map((row) =>
    row.map((tile) => ({ ...tile, occupantId: null })),
  );

  const pokemonMap = new Map<string, PokemonInstance>();

  for (const placement of config.placements) {
    const team = config.teams.find((t) => t.pokemonIds.includes(placement.pokemonId));
    if (!team) {
      throw new Error(`No team found for Pokemon ${placement.pokemonId}`);
    }

    const definitionId = placement.pokemonId.replace(/^p\d+-/, "");
    const definition = pokemonDefinitions.get(definitionId);
    if (!definition) {
      throw new Error(`Unknown Pokemon definition: ${definitionId}`);
    }

    const instance = createPokemonInstance(
      definition,
      team.playerId,
      placement.pokemonId,
      placement.position,
      placement.direction,
      moveDefinitions,
    );

    pokemonMap.set(instance.id, instance);
    const row = grid[placement.position.y];
    if (row) {
      const tile = row[placement.position.x];
      if (tile) {
        tile.occupantId = instance.id;
      }
    }
  }

  const state: BattleState = {
    grid,
    pokemon: pokemonMap,
    turnOrder: [],
    currentTurnIndex: 0,
    roundNumber: 1,
    predictedNextRoundOrder: [],
  };

  const turnPipeline = new TurnPipeline();
  const engine = new BattleEngine(
    state,
    moveDefinitions,
    typeChart,
    pokemonTypesMap,
    turnPipeline,
    undefined,
    0,
    config.turnSystemKind,
  );

  return {
    engine,
    state,
    pokemonDefinitions,
    moveDefinitions,
    map: config.map,
  };
}

export const defaultTeams: PlacementTeam[] = [
  {
    playerId: PlayerId.Player1,
    pokemonIds: ["p1-bulbasaur", "p1-squirtle", "p1-pikachu", "p1-machop", "p1-abra", "p1-geodude"],
    controller: PlayerController.Human,
  },
  {
    playerId: PlayerId.Player2,
    pokemonIds: [
      "p2-charmander",
      "p2-pidgey",
      "p2-gastly",
      "p2-growlithe",
      "p2-jigglypuff",
      "p2-seel",
    ],
    controller: PlayerController.Ai,
  },
];

export function createDefaultBattleConfig(): BattleSetupConfig {
  const map = pocArena;
  const format = map.formats[0];
  if (!format) {
    throw new Error("POC arena has no formats defined");
  }

  const teams = defaultTeams;

  const gridCenter = {
    x: Math.floor(map.width / 2),
    y: Math.floor(map.height / 2),
  };

  const placementPhase = new PlacementPhase(map, teams, format, PlacementMode.Random, 12345);
  const placements = placementPhase.autoPlaceAll(gridCenter);

  return { map, teams, placements };
}

export function createBattle(): BattleSetupResult {
  return createBattleFromPlacements(createDefaultBattleConfig());
}
