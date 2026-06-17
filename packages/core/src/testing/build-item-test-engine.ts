import { loadAllPokemonTypes, loadData, typeChart } from "@pokemon-tactic/data";
import { BattleEngine } from "../battle/BattleEngine";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import { MockBattle } from "./mock-battle";

export function buildItemTestEngine(
  pokemon: PokemonInstance[],
  gridSize = 6,
  activePokemonId?: string,
) {
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
    undefined,
    0,
    undefined,
    data.abilityRegistry,
    data.itemRegistry,
  );
  // Pin the acting mon for isolated item tests (CT picks the fastest at construction).
  const pinnedActor = activePokemonId ?? pokemon[0]?.id;
  if (pinnedActor !== undefined) {
    engine.pinActiveForTest(pinnedActor);
  }
  return { engine, state };
}
