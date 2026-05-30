import { loadAllPokemonTypes, loadData, typeChart } from "@pokemon-tactic/data";
import { BattleEngine } from "../battle/BattleEngine";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { RandomFn } from "../utils/prng";
import { buildMoveRegistry } from "./build-move-registry";
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
  const moveRegistry = buildMoveRegistry();
  const data = loadData();
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
