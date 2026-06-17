import type { BattleEngine } from "../battle/BattleEngine";
import { ActionKind } from "../enums/action-kind";
import { Direction } from "../enums/direction";
import type { BattleState } from "../types/battle-state";

/**
 * Cycle Charge Time turns (each active mon just ends its turn) until it is `actorId`'s turn again.
 * Lets a move/item test that needs the same mon to act twice advance through the scheduler without
 * hard-coding the relative order of the other mons. No-op if `actorId` is already active.
 */
export function endTurnUntilActor(
  engine: BattleEngine,
  state: BattleState,
  actorId: string,
  maxTurns = 200,
): void {
  for (let i = 0; i < maxTurns && state.activePokemonId !== actorId; i++) {
    const current = state.pokemon.get(state.activePokemonId);
    if (!current) {
      return;
    }
    engine.submitAction(current.playerId, {
      kind: ActionKind.EndTurn,
      pokemonId: current.id,
      direction: Direction.South,
    });
  }
}
