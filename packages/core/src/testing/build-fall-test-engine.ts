import { typeChart } from "@pokemon-tactic/data";
import { BattleEngine } from "../battle/BattleEngine";
import { Category } from "../enums/category";
import { Direction } from "../enums/direction";
import { EffectKind } from "../enums/effect-kind";
import { PokemonType } from "../enums/pokemon-type";
import { TargetingKind } from "../enums/targeting-kind";
import type { MoveDefinition } from "../types/move-definition";
import { MockBattle } from "./mock-battle";

const knockbackMove: MoveDefinition = {
  id: "test-knockback",
  name: "Test Knockback",
  type: PokemonType.Normal,
  category: Category.Physical,
  power: 10,
  accuracy: 100,
  pp: 10,
  targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
  effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.Knockback, distance: 1 }],
};

export function buildFallTestEngine(
  attackerPos: { x: number; y: number },
  targetPos: { x: number; y: number },
  tileHeights: Map<string, number>,
  targetDefinitionId = "bulbasaur",
) {
  const attacker = {
    ...MockBattle.player1Fast,
    id: "attacker",
    definitionId: "machop",
    position: attackerPos,
    moveIds: ["test-knockback"],
    currentPp: { "test-knockback": 10 },
    orientation: Direction.East,
  };
  const target = {
    ...MockBattle.player2Slow,
    id: "target",
    definitionId: targetDefinitionId,
    position: targetPos,
    currentHp: 150,
    maxHp: 150,
    orientation: Direction.West,
  };

  const state = MockBattle.stateFrom([attacker, target], 10, 10);

  for (const [key, height] of tileHeights) {
    const parts = key.split(",");
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    MockBattle.setTile(state, x, y, { height });
  }

  state.turnOrder = ["attacker", "target"];
  state.currentTurnIndex = 0;

  const moveRegistry = new Map<string, MoveDefinition>([["test-knockback", knockbackMove]]);
  const pokemonTypesMap = new Map<string, PokemonType[]>([
    ["machop", [PokemonType.Fighting]],
    ["bulbasaur", [PokemonType.Grass, PokemonType.Poison]],
    ["pidgey", [PokemonType.Normal, PokemonType.Flying]],
  ]);

  const engine = new BattleEngine(state, moveRegistry, typeChart, pokemonTypesMap);
  return { engine, state, target };
}
