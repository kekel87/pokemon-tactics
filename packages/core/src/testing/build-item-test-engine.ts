import { loadData, typeChart } from "@pokemon-tactic/data";
import { BattleEngine } from "../battle/BattleEngine";
import type { PokemonType } from "../enums/pokemon-type";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import { MockBattle } from "./mock-battle";

export function buildItemTestEngine(pokemon: PokemonInstance[], gridSize = 6) {
  const data = loadData();
  const moveRegistry = new Map<string, MoveDefinition>();
  for (const move of data.moves) {
    moveRegistry.set(move.id, move);
  }
  const pokemonTypesMap = new Map<string, PokemonType[]>(data.pokemon.map((p) => [p.id, p.types]));
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
    undefined,
    data.abilityRegistry,
    data.itemRegistry,
  );
  return { engine, state };
}
