import { loadData, pocArena } from "@pokemon-tactic/data";
import { BattleEngine } from "../battle/BattleEngine";
import { computeCombatStats } from "../battle/stat-calculator";
import type { PokemonType } from "../enums/pokemon-type";
import { StatName } from "../enums/stat-name";
import type { MoveDefinition } from "../types/move-definition";
import type { PlacementEntry } from "../types/placement-entry";
import type { PlacementTeam } from "../types/placement-team";
import type { PokemonInstance } from "../types/pokemon-instance";

const BATTLE_LEVEL = 50;

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

export function buildTestEngineFromPlacements(
  placements: PlacementEntry[],
  teams: PlacementTeam[],
): { engine: BattleEngine; state: ReturnType<typeof buildState> } {
  const data = loadData();
  const moveRegistry = new Map<string, MoveDefinition>();
  for (const move of data.moves) {
    moveRegistry.set(move.id, move);
  }

  const pokemonDefinitions = new Map(data.pokemon.map((p) => [p.id, p]));
  const pokemonTypesMap = new Map<string, PokemonType[]>(data.pokemon.map((p) => [p.id, p.types]));

  const map = pocArena;
  const grid = map.tiles.map((row) => row.map((tile) => ({ ...tile, occupantId: null })));

  const pokemonMap = new Map<string, PokemonInstance>();

  for (const placement of placements) {
    const team = teams.find((t) => t.pokemonIds.includes(placement.pokemonId));
    if (!team) {
      throw new Error(`No team for ${placement.pokemonId}`);
    }

    const definitionId = placement.pokemonId.replace(/^p\d+-/, "");
    const definition = pokemonDefinitions.get(definitionId);
    if (!definition) {
      throw new Error(`Unknown definition: ${definitionId}`);
    }

    const currentPp: Record<string, number> = {};
    for (const moveId of definition.movepool) {
      const move = moveRegistry.get(moveId);
      currentPp[moveId] = move?.pp ?? 0;
    }

    const combatStats = computeCombatStats(definition.baseStats, BATTLE_LEVEL);

    const instance: PokemonInstance = {
      id: placement.pokemonId,
      definitionId: definition.id,
      playerId: team.playerId,
      level: BATTLE_LEVEL,
      currentHp: combatStats.hp,
      maxHp: combatStats.hp,
      baseStats: { ...definition.baseStats },
      combatStats,
      derivedStats: { movement: 3, jump: 1, initiative: combatStats.speed },
      statStages: { ...ZERO_STAT_STAGES },
      statusEffects: [],
      position: placement.position,
      orientation: placement.direction,
      moveIds: [...definition.movepool],
      currentPp,
    };

    pokemonMap.set(instance.id, instance);
    const row = grid[placement.position.y];
    if (row) {
      const tile = row[placement.position.x];
      if (tile) {
        tile.occupantId = instance.id;
      }
    }
  }

  const state = buildState(grid, pokemonMap);
  const engine = new BattleEngine(state, moveRegistry, undefined, pokemonTypesMap);
  return { engine, state };
}

function buildState(
  grid: ReturnType<typeof pocArena.tiles.map>,
  pokemonMap: Map<string, PokemonInstance>,
) {
  return {
    grid,
    pokemon: pokemonMap,
    activeLinks: [],
    turnOrder: [] as string[],
    currentTurnIndex: 0,
    roundNumber: 1,
    predictedNextRoundOrder: [] as string[],
  };
}
