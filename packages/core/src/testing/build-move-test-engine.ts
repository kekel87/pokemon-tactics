import { loadAllPokemonTypes, loadData, typeChart } from "@pokemon-tactic/data";
import { BattleEngine } from "../battle/BattleEngine";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { RandomFn } from "../utils/prng";
import { MockBattle } from "./mock-battle";

export interface BuildMoveTestEngineOptions {
  gridSize?: number;
  random?: RandomFn;
}

export function buildMoveTestEngine(
  pokemon: PokemonInstance[],
  options: BuildMoveTestEngineOptions = {},
) {
  const { gridSize = 6, random } = options;
  const data = loadData();
  const moveRegistry = new Map<string, MoveDefinition>();
  for (const move of data.moves) {
    moveRegistry.set(move.id, move);
  }
  const pokemonTypesMap = loadAllPokemonTypes();
  const state = MockBattle.stateFrom(pokemon, gridSize, gridSize);
  const engine = new BattleEngine(
    state,
    moveRegistry,
    typeChart,
    pokemonTypesMap,
    undefined,
    random,
    0,
    undefined,
    undefined,
    data.abilityRegistry,
  );
  return { engine, state };
}
