import { loadAllPokemonTypes, loadData, typeChart } from "@pokemon-tactic/data";
import { BattleEngine } from "../battle/BattleEngine";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { RandomFn } from "../utils/prng";
import { buildMoveRegistry } from "./build-move-registry";
import { MockBattle } from "./mock-battle";

export interface BuildMoveTestEngineOptions {
  gridSize?: number;
  random?: RandomFn;
  /**
   * Id of the mon whose turn it is for this isolated move test. Defaults to the first mon passed
   * (the conventional attacker). The Charge Time scheduler picks the fastest mon at construction;
   * move-mechanic tests pin the actor so the result is independent of relative Speed.
   */
  activePokemonId?: string;
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
    data.abilityRegistry,
  );
  const pinnedActor = options.activePokemonId ?? pokemon[0]?.id;
  if (pinnedActor !== undefined) {
    engine.pinActiveForTest(pinnedActor);
  }
  return { engine, state };
}
