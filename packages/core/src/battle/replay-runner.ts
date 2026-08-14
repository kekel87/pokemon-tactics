import type { BattleEvent } from "../types/battle-event";
import type { BattleReplay } from "../types/battle-replay";
import type { BattleEngine } from "./BattleEngine";

export type EngineFactory = (seed: number) => BattleEngine;

/**
 * Called with the events each replayed action produced. Lets a caller rebuild what the battle
 * narrated without re-animating it — the resume path (plan 181) feeds them to the battle log so a
 * restored battle comes back with its history instead of an empty panel.
 */
export type ReplayActionObserver = (events: readonly BattleEvent[]) => void;

export function runReplay(
  replay: BattleReplay,
  createEngine: EngineFactory,
  onAction?: ReplayActionObserver,
): BattleEngine {
  const engine = createEngine(replay.seed);

  for (const action of replay.actions) {
    const state = engine.getGameState("");
    const currentPokemonId = state.activePokemonId;
    const pokemon = currentPokemonId ? state.pokemon.get(currentPokemonId) : undefined;
    if (!pokemon) {
      throw new Error("Replay failed: no active pokemon at action index");
    }

    const result = engine.submitAction(pokemon.playerId, action);
    if (!result.success) {
      throw new Error(`Replay failed: action rejected with error ${result.error}`);
    }
    onAction?.(result.events);
  }

  return engine;
}
