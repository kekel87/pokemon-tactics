import type { BattleReplay } from "../types/battle-replay";
import type { BattleEngine } from "./BattleEngine";

export type EngineFactory = (seed: number) => BattleEngine;

export function runReplay(replay: BattleReplay, createEngine: EngineFactory): BattleEngine {
  const engine = createEngine(replay.seed);

  for (const action of replay.actions) {
    const state = engine.getGameState("");
    const currentPokemonId = state.turnOrder[state.currentTurnIndex];
    const pokemon = currentPokemonId ? state.pokemon.get(currentPokemonId) : undefined;
    if (!pokemon) {
      throw new Error("Replay failed: no active pokemon at action index");
    }

    const result = engine.submitAction(pokemon.playerId, action);
    if (!result.success) {
      throw new Error(`Replay failed: action rejected with error ${result.error}`);
    }
  }

  return engine;
}
