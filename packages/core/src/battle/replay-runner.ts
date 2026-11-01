import type { BattleEvent } from "../types/battle-event";
import type { BattleReplay } from "../types/battle-replay";
import type { ReplayForfeit } from "../types/replay-forfeit";
import type { BattleEngine } from "./BattleEngine";

export type EngineFactory = (seed: number) => BattleEngine;

/**
 * Called with the events each replayed action — or forfeit — produced. Lets a caller rebuild what the
 * battle narrated without re-animating it — the resume path (plan 181) feeds them to the battle log so
 * a restored battle comes back with its history instead of an empty panel.
 */
export type ReplayActionObserver = (events: readonly BattleEvent[]) => void;

/**
 * L'abandon à rejouer maintenant, s'il y en a un (plan 243) : le prochain de la liste, dès que le
 * nombre d'actions appliquées atteint son rang — comme dans la partie, où les K.O. tombaient aussitôt.
 *
 * Une seule règle pour le rejeu sans animation (`runReplay`) et pour la lecture animée du replay : un
 * pas en arrière retombe donc exactement sur ce que la lecture avait montré, et un journal tronqué à N
 * actions rejoue les abandons de rang <= N, sans filtre à part.
 */
export function dueForfeit(
  forfeits: readonly ReplayForfeit[],
  engine: Pick<BattleEngine, "actionLogLength" | "forfeitLogLength">,
): ReplayForfeit | undefined {
  const next = forfeits[engine.forfeitLogLength];
  return next?.afterAction === engine.actionLogLength ? next : undefined;
}

export function runReplay(
  replay: BattleReplay,
  createEngine: EngineFactory,
  onAction?: ReplayActionObserver,
): BattleEngine {
  const engine = createEngine(replay.seed);
  const forfeits = replay.forfeits ?? [];
  const applyForfeitsDue = (): void => {
    for (
      let forfeit = dueForfeit(forfeits, engine);
      forfeit !== undefined;
      forfeit = dueForfeit(forfeits, engine)
    ) {
      const result = engine.forfeit(forfeit.playerId, forfeit.reason);
      if (!result.success) {
        throw new Error(`Replay failed: forfeit rejected with error ${result.error}`);
      }
      onAction?.(result.events);
    }
  };

  applyForfeitsDue();
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
    applyForfeitsDue();
  }

  return engine;
}
