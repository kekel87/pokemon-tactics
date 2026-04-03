import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
  BattleReplay,
  MoveDefinition,
  PokemonInstance,
  PokemonType,
} from "@pokemon-tactic/core";
import {
  BattleEngine,
  computeCombatStats,
  computeMovement,
  createPrng,
  Direction,
  PlayerId,
  pickAggressiveAction,
  StatName,
} from "@pokemon-tactic/core";
import { loadData, pocArena, typeChart } from "@pokemon-tactic/data";

const SEED = 12345;
const MAX_ROUNDS = 200;
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

function buildGoldenEngine(seed: number) {
  const data = loadData();
  const moveRegistry = new Map<string, MoveDefinition>();
  for (const move of data.moves) {
    moveRegistry.set(move.id, move);
  }

  const pokemonDefinitions = new Map(data.pokemon.map((p) => [p.id, p]));
  const pokemonTypesMap = new Map<string, PokemonType[]>(data.pokemon.map((p) => [p.id, p.types]));

  const team1Ids = ["charmander", "squirtle", "pidgey"];
  const team2Ids = ["bulbasaur", "pikachu", "geodude"];

  const map = pocArena;
  const grid = map.tiles.map((row) =>
    row.map((tile) => ({ ...tile, occupantId: null as string | null })),
  );

  const pokemonMap = new Map<string, PokemonInstance>();

  const team1Positions = [
    { x: 1, y: 5 },
    { x: 1, y: 6 },
    { x: 1, y: 7 },
  ];
  const team2Positions = [
    { x: 10, y: 5 },
    { x: 10, y: 6 },
    { x: 10, y: 7 },
  ];

  function placePokemon(defId: string, playerId: string, pos: { x: number; y: number }) {
    const definition = pokemonDefinitions.get(defId);
    if (!definition) {
      throw new Error(`Unknown pokemon: ${defId}`);
    }
    const id = `p${playerId === PlayerId.Player1 ? "1" : "2"}-${defId}`;
    const currentPp: Record<string, number> = {};
    for (const moveId of definition.movepool) {
      const move = moveRegistry.get(moveId);
      currentPp[moveId] = move?.pp ?? 0;
    }
    const combatStats = computeCombatStats(definition.baseStats, BATTLE_LEVEL);
    const instance: PokemonInstance = {
      id,
      definitionId: definition.id,
      playerId,
      level: BATTLE_LEVEL,
      currentHp: combatStats.hp,
      maxHp: combatStats.hp,
      baseStats: { ...definition.baseStats },
      combatStats,
      derivedStats: { movement: computeMovement(definition.baseStats.speed, 0), jump: 1, initiative: combatStats.speed },
      statStages: { ...ZERO_STAT_STAGES },
      statusEffects: [],
      position: pos,
      orientation: playerId === PlayerId.Player1 ? Direction.East : Direction.West,
      moveIds: [...definition.movepool],
      currentPp,
      activeDefense: null,
      lastEndureRound: null,
      toxicCounter: 0,
      volatileStatuses: [],
      recharging: false,
    };
    pokemonMap.set(instance.id, instance);
    const row = grid[pos.y];
    if (row) {
      const tile = row[pos.x];
      if (tile) {
        tile.occupantId = instance.id;
      }
    }
  }

  team1Ids.forEach((id, i) => placePokemon(id, PlayerId.Player1, team1Positions[i]!));
  team2Ids.forEach((id, i) => placePokemon(id, PlayerId.Player2, team2Positions[i]!));

  const state = {
    grid,
    pokemon: pokemonMap,
    turnOrder: [] as string[],
    currentTurnIndex: 0,
    roundNumber: 1,
    predictedNextRoundOrder: [] as string[],
  };

  const random = createPrng(seed);
  return {
    engine: new BattleEngine(
      state,
      moveRegistry,
      typeChart,
      pokemonTypesMap,
      undefined,
      random,
      seed,
    ),
    moveRegistry,
    random,
  };
}

function runGoldenBattle(): {
  replay: BattleReplay;
  winner: string;
  rounds: number;
  totalActions: number;
} {
  const { engine, moveRegistry, random } = buildGoldenEngine(SEED);

  let totalActions = 0;

  while (true) {
    const state = engine.getGameState("");

    if (state.roundNumber > MAX_ROUNDS) {
      console.warn(`Battle exceeded ${MAX_ROUNDS} rounds, stopping.`);
      break;
    }

    const currentPokemonId = state.turnOrder[state.currentTurnIndex];
    const currentPokemon = currentPokemonId ? state.pokemon.get(currentPokemonId) : undefined;
    if (!currentPokemon) {
      break;
    }

    const playerId = currentPokemon.playerId;
    const legalActions = engine.getLegalActions(playerId);

    if (legalActions.length === 0) {
      break;
    }

    const action = pickAggressiveAction(legalActions, state, moveRegistry, random);
    const result = engine.submitAction(playerId, action);

    if (result.success) {
      totalActions++;
    }

    const postState = engine.getGameState("");
    const team1Alive = [...postState.pokemon.values()].filter(
      (p) => p.playerId === PlayerId.Player1 && p.currentHp > 0,
    );
    const team2Alive = [...postState.pokemon.values()].filter(
      (p) => p.playerId === PlayerId.Player2 && p.currentHp > 0,
    );

    if (team1Alive.length === 0 || team2Alive.length === 0) {
      const winner = team1Alive.length > 0 ? "Player 1" : "Player 2";
      const replay = engine.exportReplay();
      return { replay, winner, rounds: postState.roundNumber, totalActions };
    }
  }

  const finalState = engine.getGameState("");
  return {
    replay: engine.exportReplay(),
    winner: "Draw",
    rounds: finalState.roundNumber,
    totalActions,
  };
}

const result = runGoldenBattle();

const outputPath = resolve(import.meta.dirname ?? ".", "../fixtures/replays/golden-replay.json");
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(result.replay, null, 2));

console.log("Golden replay generated:");
console.log(`  Winner: ${result.winner}`);
console.log(`  Rounds: ${result.rounds}`);
console.log(`  Actions: ${result.totalActions}`);
console.log(`  Seed: ${SEED}`);
console.log(`  Output: ${outputPath}`);
