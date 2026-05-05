import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadData, pocArena, typeChart } from "@pokemon-tactic/data";
import { pickAggressiveAction } from "../src/ai/aggressive-ai";
import { BattleEngine } from "../src/battle/BattleEngine";
import { computeCombatStats } from "../src/battle/stat-calculator";
import { computeMovement } from "../src/battle/stat-modifier";
import { Direction } from "../src/enums/direction";
import { Nature } from "../src/enums/nature";
import { PlayerId } from "../src/enums/player-id";
import { PokemonGender } from "../src/enums/pokemon-gender";
import type { PokemonType } from "../src/enums/pokemon-type";
import { StatName } from "../src/enums/stat-name";
import type { Action } from "../src/types/action";
import type { MoveDefinition } from "../src/types/move-definition";
import type { PokemonInstance } from "../src/types/pokemon-instance";
import { createPrng } from "../src/utils/prng";

const BATTLE_LEVEL = 50;
const SEED = 12345;

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

function buildEngine(seed: number): BattleEngine {
  const data = loadData();
  const moveRegistry = new Map<string, MoveDefinition>();
  for (const move of data.moves) {
    moveRegistry.set(move.id, move);
  }
  const pokemonDefinitions = new Map(data.pokemon.map((p) => [p.id, p]));
  const pokemonTypesMap = new Map<string, PokemonType[]>(data.pokemon.map((p) => [p.id, p.types]));

  const team1Ids = ["charmander", "squirtle", "pidgey"];
  const team2Ids = ["bulbasaur", "pikachu", "geodude"];

  const grid = pocArena.tiles.map((row) =>
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

  function placePokemon(defId: string, playerId: string, position: { x: number; y: number }): void {
    const definition = pokemonDefinitions.get(defId);
    if (!definition) {
      throw new Error(`Unknown pokemon: ${defId}`);
    }
    const id = `p${playerId === PlayerId.Player1 ? "1" : "2"}-${defId}`;
    const activeMoveIds = definition.movepool.slice(0, 4);
    const currentPp: Record<string, number> = {};
    for (const moveId of activeMoveIds) {
      const moveDef = moveRegistry.get(moveId);
      currentPp[moveId] = moveDef?.pp ?? 0;
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
      derivedStats: {
        movement: computeMovement(definition.baseStats.speed, 0),
        jump: 1,
        initiative: combatStats.speed,
      },
      statStages: { ...ZERO_STAT_STAGES },
      statusEffects: [],
      position,
      orientation: playerId === PlayerId.Player1 ? Direction.East : Direction.West,
      moveIds: activeMoveIds,
      currentPp,
      activeDefense: null,
      lastEndureRound: null,
      toxicCounter: 0,
      volatileStatuses: [],
      recharging: false,
      gender: PokemonGender.Genderless,
      nature: Nature.Hardy,
    };
    pokemonMap.set(instance.id, instance);
    const row = grid[position.y];
    if (row) {
      const tile = row[position.x];
      if (tile) {
        tile.occupantId = instance.id;
      }
    }
  }

  for (let i = 0; i < team1Ids.length; i++) {
    const position = team1Positions[i];
    if (position) {
      placePokemon(team1Ids[i] ?? "", PlayerId.Player1, position);
    }
  }
  for (let i = 0; i < team2Ids.length; i++) {
    const position = team2Positions[i];
    if (position) {
      placePokemon(team2Ids[i] ?? "", PlayerId.Player2, position);
    }
  }

  const state = {
    grid,
    pokemon: pokemonMap,
    turnOrder: [] as string[],
    currentTurnIndex: 0,
    roundNumber: 1,
    predictedNextRoundOrder: [] as string[],
  };

  const random = createPrng(seed);
  return new BattleEngine(state, moveRegistry, typeChart, pokemonTypesMap, undefined, random, seed);
}

function run(): void {
  const data = loadData();
  const moveRegistry = new Map<string, MoveDefinition>();
  for (const move of data.moves) {
    moveRegistry.set(move.id, move);
  }

  const engine = buildEngine(SEED);
  const random = createPrng(SEED);
  const actions: Action[] = [];
  let actionCount = 0;

  while (actionCount < 2000) {
    const state = engine.getGameState("");
    const currentPokemonId = state.turnOrder[state.currentTurnIndex];
    const currentPokemon = currentPokemonId ? state.pokemon.get(currentPokemonId) : undefined;
    if (!currentPokemon) {
      break;
    }

    const legalActions = engine.getLegalActions(currentPokemon.playerId);
    if (legalActions.length === 0) {
      break;
    }

    const action = pickAggressiveAction(legalActions, state, moveRegistry, random);
    const result = engine.submitAction(currentPokemon.playerId, action);
    if (result.success) {
      actions.push(action);
      actionCount++;
    }

    const postState = engine.getGameState("");
    const team1Alive = [...postState.pokemon.values()].filter(
      (p) => p.playerId === PlayerId.Player1 && p.currentHp > 0,
    );
    const team2Alive = [...postState.pokemon.values()].filter(
      (p) => p.playerId === PlayerId.Player2 && p.currentHp > 0,
    );
    if (team1Alive.length === 0 || team2Alive.length === 0) {
      break;
    }
  }

  const finalState = engine.getGameState("");
  const team1Alive = [...finalState.pokemon.values()].filter(
    (p) => p.playerId === PlayerId.Player1 && p.currentHp > 0,
  );
  const team2Alive = [...finalState.pokemon.values()].filter(
    (p) => p.playerId === PlayerId.Player2 && p.currentHp > 0,
  );

  console.log(`Generated ${actions.length} actions`);
  console.log(`Round: ${finalState.roundNumber}`);
  console.log(`Team1 alive: ${team1Alive.length}, Team2 alive: ${team2Alive.length}`);

  const replay = { seed: SEED, actions };
  const outPath = resolve(import.meta.dirname ?? ".", "../fixtures/replays/golden-replay.json");
  writeFileSync(outPath, JSON.stringify(replay, null, 2));
  console.log(`Written to ${outPath}`);
}

run();
