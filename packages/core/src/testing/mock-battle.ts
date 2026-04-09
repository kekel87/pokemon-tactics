import { Direction } from "../enums/direction";
import { PlayerId } from "../enums/player-id";
import type { StatName as StatNameType } from "../enums/stat-name";
import { StatName } from "../enums/stat-name";
import { TerrainType } from "../enums/terrain-type";
import type { BattleState } from "../types/battle-state";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { TileState } from "../types/tile-state";

const ZERO_STAT_STAGES: Record<StatNameType, number> = {
  [StatName.Hp]: 0,
  [StatName.Attack]: 0,
  [StatName.Defense]: 0,
  [StatName.SpAttack]: 0,
  [StatName.SpDefense]: 0,
  [StatName.Speed]: 0,
  [StatName.Accuracy]: 0,
  [StatName.Evasion]: 0,
};

function buildFlatGrid(width: number, height: number): TileState[][] {
  const tiles: TileState[][] = [];
  for (let y = 0; y < height; y++) {
    const row: TileState[] = [];
    for (let x = 0; x < width; x++) {
      row.push({
        position: { x, y },
        height: 0,
        terrain: TerrainType.Normal,
        occupantId: null,
      });
    }
    tiles.push(row);
  }
  return tiles;
}

function placeOnGrid(grid: TileState[][], pokemon: PokemonInstance[]): void {
  for (const p of pokemon) {
    const row = grid[p.position.y];
    if (row) {
      const tile = row[p.position.x];
      if (tile) {
        tile.occupantId = p.id;
      }
    }
  }
}

export abstract class MockBattle {
  static readonly zeroStatStages: Record<StatNameType, number> = { ...ZERO_STAT_STAGES };

  static readonly player1Fast: PokemonInstance = {
    id: "fast",
    definitionId: "test",
    playerId: PlayerId.Player1,
    level: 50,
    currentHp: 100,
    maxHp: 100,
    baseStats: { hp: 100, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 50 },
    combatStats: { hp: 100, attack: 55, defense: 55, spAttack: 55, spDefense: 55, speed: 55 },
    derivedStats: { movement: 4, jump: 1, initiative: 90 },
    statStages: { ...ZERO_STAT_STAGES },
    statusEffects: [],
    position: { x: 0, y: 0 },
    orientation: Direction.South,
    moveIds: [],
    currentPp: {},
    activeDefense: null,
    lastEndureRound: null,
    toxicCounter: 0,
    volatileStatuses: [],
    recharging: false,
  };

  static readonly player2Slow: PokemonInstance = {
    id: "slow",
    definitionId: "test",
    playerId: PlayerId.Player2,
    level: 50,
    currentHp: 100,
    maxHp: 100,
    baseStats: { hp: 100, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 50 },
    combatStats: { hp: 100, attack: 55, defense: 55, spAttack: 55, spDefense: 55, speed: 55 },
    derivedStats: { movement: 4, jump: 1, initiative: 30 },
    statStages: { ...ZERO_STAT_STAGES },
    statusEffects: [],
    position: { x: 4, y: 4 },
    orientation: Direction.South,
    moveIds: [],
    currentPp: {},
    activeDefense: null,
    lastEndureRound: null,
    toxicCounter: 0,
    volatileStatuses: [],
    recharging: false,
  };

  static readonly player1Medium: PokemonInstance = {
    id: "medium",
    definitionId: "test",
    playerId: PlayerId.Player1,
    level: 50,
    currentHp: 100,
    maxHp: 100,
    baseStats: { hp: 100, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 50 },
    combatStats: { hp: 100, attack: 55, defense: 55, spAttack: 55, spDefense: 55, speed: 55 },
    derivedStats: { movement: 4, jump: 1, initiative: 50 },
    statStages: { ...ZERO_STAT_STAGES },
    statusEffects: [],
    position: { x: 2, y: 2 },
    orientation: Direction.South,
    moveIds: [],
    currentPp: {},
    activeDefense: null,
    lastEndureRound: null,
    toxicCounter: 0,
    volatileStatuses: [],
    recharging: false,
  };

  static readonly flatGrid5x5: TileState[][] = buildFlatGrid(5, 5);

  static setTile(state: BattleState, x: number, y: number, overrides: Partial<TileState>): void {
    const row = state.grid[y];
    if (!row) {
      throw new Error(`Row ${y} does not exist`);
    }
    const tile = row[x];
    if (!tile) {
      throw new Error(`Tile ${x},${y} does not exist`);
    }
    Object.assign(tile, overrides);
  }

  static stateFrom(pokemon: PokemonInstance[], gridWidth = 5, gridHeight = 5): BattleState {
    const grid = buildFlatGrid(gridWidth, gridHeight);
    const pokemonMap = new Map<string, PokemonInstance>();
    for (const p of pokemon) {
      pokemonMap.set(p.id, p);
    }
    placeOnGrid(grid, pokemon);
    return {
      grid,
      pokemon: pokemonMap,
      turnOrder: [],
      currentTurnIndex: 0,
      roundNumber: 1,
      predictedNextRoundOrder: [],
    };
  }
}
