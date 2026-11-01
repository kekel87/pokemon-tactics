import { BattleEngine } from "../battle/BattleEngine";
import { PlayerId } from "../enums/player-id";
import { MockBattle } from "./mock-battle";
import { MockPokemon } from "./mock-pokemon";

/**
 * Trois camps d'un Pokémon chacun, sans attaques : l'abandon d'un seul n'y termine pas la partie
 * (plan 243). Un état neuf à chaque appel, pour qu'un test de replay puisse rebâtir la même partie.
 */
export function buildThreeCampEngine(): BattleEngine {
  const state = MockBattle.stateFrom([
    MockPokemon.fresh(MockBattle.player1Fast),
    MockPokemon.fresh(MockBattle.player2Slow),
    MockPokemon.fresh(MockBattle.player2Slow, {
      id: "third",
      playerId: PlayerId.Player3,
      position: { x: 2, y: 2 },
    }),
  ]);
  return new BattleEngine(state, new Map());
}
