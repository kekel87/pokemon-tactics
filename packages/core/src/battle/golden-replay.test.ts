import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadData, pocArena, typeChart } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { pickAggressiveAction } from "../ai/aggressive-ai";
import { Direction } from "../enums/direction";
import { Nature } from "../enums/nature";
import { PlayerId } from "../enums/player-id";
import { PokemonGender } from "../enums/pokemon-gender";
import type { PokemonType } from "../enums/pokemon-type";
import { StatName } from "../enums/stat-name";
import type { Action } from "../types/action";
import type { BattleReplay } from "../types/battle-replay";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import { createPrng } from "../utils/prng";
import { BattleEngine } from "./BattleEngine";
import { runReplay } from "./replay-runner";
import { computeCombatStats } from "./stat-calculator";
import { computeMovement } from "./stat-modifier";

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

function buildGoldenEngine(seed: number): BattleEngine {
  const data = loadData();
  const moveRegistry = new Map<string, MoveDefinition>();
  for (const move of data.moves) {
    moveRegistry.set(move.id, move);
  }

  const pokemonDefinitions = new Map(data.pokemon.map((p) => [p.id, p]));
  const pokemonTypesMap = new Map<string, PokemonType[]>(data.pokemon.map((p) => [p.id, p.types]));

  const team1Ids = ["charizard", "blastoise", "dragonite"];
  const team2Ids = ["venusaur", "raichu", "snorlax"];

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

  function placePokemon(defId: string, playerId: string, pos: { x: number; y: number }) {
    const definition = pokemonDefinitions.get(defId);
    if (!definition) {
      throw new Error(`Unknown pokemon: ${defId}`);
    }
    const id = `p${playerId === PlayerId.Player1 ? "1" : "2"}-${defId}`;
    const currentPp: Record<string, number> = {};
    for (const moveId of definition.movepool) {
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
      position: pos,
      orientation: playerId === PlayerId.Player1 ? Direction.East : Direction.West,
      moveIds: [...definition.movepool],
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
    const row = grid[pos.y];
    if (row) {
      const tile = row[pos.x];
      if (tile) {
        tile.occupantId = instance.id;
      }
    }
  }

  for (let i = 0; i < team1Ids.length; i++) {
    const pos = team1Positions[i];
    if (pos) {
      placePokemon(team1Ids[i] ?? "", PlayerId.Player1, pos);
    }
  }
  for (let i = 0; i < team2Ids.length; i++) {
    const pos = team2Positions[i];
    if (pos) {
      placePokemon(team2Ids[i] ?? "", PlayerId.Player2, pos);
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

const GOLDEN_PATH = resolve(
  import.meta.dirname ?? ".",
  "../../fixtures/replays/golden-replay.json",
);

function loadGoldenReplay(): BattleReplay {
  const content = readFileSync(GOLDEN_PATH, "utf-8");
  return JSON.parse(content) as BattleReplay;
}

function generateGoldenReplay(seed: number): BattleReplay {
  const engine = buildGoldenEngine(seed);
  const data = loadData();
  const moveRegistry = new Map<string, MoveDefinition>();
  for (const move of data.moves) {
    moveRegistry.set(move.id, move);
  }
  const freshRandom = createPrng(seed);
  const actions: Action[] = [];
  let actionCount = 0;
  while (actionCount < 1000) {
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
    const action = pickAggressiveAction(legalActions, state, moveRegistry, freshRandom);
    const result = engine.submitAction(currentPokemon.playerId, action);
    if (result.success) {
      actions.push(action);
      actionCount++;
    }
    const postState = engine.getGameState("");
    const team1 = [...postState.pokemon.values()].filter(
      (p) => p.playerId === PlayerId.Player1 && p.currentHp > 0,
    );
    const team2 = [...postState.pokemon.values()].filter(
      (p) => p.playerId === PlayerId.Player2 && p.currentHp > 0,
    );
    if (team1.length === 0 || team2.length === 0) {
      break;
    }
  }
  return { seed, actions };
}

if (process.env.UPDATE_GOLDEN === "1") {
  const replay = generateGoldenReplay(12345);
  writeFileSync(GOLDEN_PATH, JSON.stringify(replay, null, 2));
  console.log(`Golden replay regenerated: ${replay.actions.length} actions`);
}

describe("golden replay", () => {
  it("replays the golden battle and produces the expected final state", () => {
    const replay = loadGoldenReplay();
    const engine = runReplay(replay, (seed) => buildGoldenEngine(seed));
    const finalState = engine.getGameState("");

    const team1Alive = [...finalState.pokemon.values()].filter(
      (p) => p.playerId === PlayerId.Player1 && p.currentHp > 0,
    );
    const team2Alive = [...finalState.pokemon.values()].filter(
      (p) => p.playerId === PlayerId.Player2 && p.currentHp > 0,
    );

    expect(team1Alive.length).toBeGreaterThan(0);
    expect(team2Alive.length).toBe(0);
    expect(finalState.roundNumber).toBe(10);
    expect(replay.actions.length).toBe(108);
  });

  it("produces the same replay when running the battle from scratch", () => {
    const goldenReplay = loadGoldenReplay();
    const data = loadData();
    const moveRegistry = new Map<string, MoveDefinition>();
    for (const move of data.moves) {
      moveRegistry.set(move.id, move);
    }

    const freshRandom = createPrng(goldenReplay.seed);
    const freshEngine = buildGoldenEngine(goldenReplay.seed);
    const generatedActions: Action[] = [];
    let actionCount = 0;

    while (actionCount < 1000) {
      const state = freshEngine.getGameState("");
      const currentPokemonId = state.turnOrder[state.currentTurnIndex];
      const currentPokemon = currentPokemonId ? state.pokemon.get(currentPokemonId) : undefined;
      if (!currentPokemon) {
        break;
      }

      const legalActions = freshEngine.getLegalActions(currentPokemon.playerId);
      if (legalActions.length === 0) {
        break;
      }

      const action = pickAggressiveAction(legalActions, state, moveRegistry, freshRandom);
      const result = freshEngine.submitAction(currentPokemon.playerId, action);
      if (result.success) {
        generatedActions.push(action);
        actionCount++;
      }

      const postState = freshEngine.getGameState("");
      const team1 = [...postState.pokemon.values()].filter(
        (p) => p.playerId === PlayerId.Player1 && p.currentHp > 0,
      );
      const team2 = [...postState.pokemon.values()].filter(
        (p) => p.playerId === PlayerId.Player2 && p.currentHp > 0,
      );
      if (team1.length === 0 || team2.length === 0) {
        break;
      }
    }

    expect(generatedActions.length).toBe(goldenReplay.actions.length);
  });
});
