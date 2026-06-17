import { typeChart } from "@pokemon-tactic/data";
import { BattleEngine } from "../battle/BattleEngine";
import { Direction } from "../enums/direction";
import { PokemonType } from "../enums/pokemon-type";
import type { MoveDefinition } from "../types/move-definition";
import type { Position } from "../types/position";
import { MockBattle } from "./mock-battle";

export function buildHeightTestEngine(
  pokemonPos: Position,
  tileHeights: Map<string, number>,
  definitionId = "bulbasaur",
  gridSize = 10,
) {
  const pokemon = {
    ...MockBattle.player1Fast,
    id: "mover",
    definitionId,
    position: pokemonPos,
    moveIds: [],
    orientation: Direction.South,
  };
  const dummy = {
    ...MockBattle.player2Slow,
    id: "dummy",
    definitionId: "bulbasaur",
    position: { x: gridSize - 1, y: gridSize - 1 },
    orientation: Direction.North,
  };

  const state = MockBattle.stateFrom([pokemon, dummy], gridSize, gridSize);

  for (const [key, height] of tileHeights) {
    const parts = key.split(",");
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    MockBattle.setTile(state, x, y, { height });
  }

  const moveRegistry = new Map<string, MoveDefinition>();
  const pokemonTypesMap = new Map<string, PokemonType[]>([
    ["bulbasaur", [PokemonType.Grass, PokemonType.Poison]],
    ["pidgey", [PokemonType.Normal, PokemonType.Flying]],
    ["gengar", [PokemonType.Ghost, PokemonType.Poison]],
  ]);

  const engine = new BattleEngine(state, moveRegistry, typeChart, pokemonTypesMap);
  // Pin the acting mon for this isolated mechanic test (CT picked an actor at construction).
  state.activePokemonId = "mover";
  return { engine, state, pokemon };
}
