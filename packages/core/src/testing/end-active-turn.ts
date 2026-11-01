import type { BattleEngine } from "../battle/BattleEngine";
import { ActionKind } from "../enums/action-kind";
import { Direction } from "../enums/direction";

/** Termine le tour du Pokémon actif, quel qu'il soit. Lève si le moteur le refuse. */
export function endActiveTurn(engine: BattleEngine): void {
  const state = engine.getGameState("");
  const active = state.pokemon.get(state.activePokemonId);
  if (active === undefined) {
    throw new Error("endActiveTurn: no active pokemon");
  }
  const result = engine.submitAction(active.playerId, {
    kind: ActionKind.EndTurn,
    pokemonId: active.id,
    direction: Direction.South,
  });
  if (!result.success) {
    throw new Error(`endActiveTurn: rejected with ${result.error}`);
  }
}
