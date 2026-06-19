import type { PlayerId } from "../enums/player-id";
import { StatusType } from "../enums/status-type";
import type { BattleState } from "../types/battle-state";

/**
 * Imprison ("Possessif") inverse filter. Aggregates, in a single pass, the union of move ids known
 * by every living enemy of `playerId` that currently holds the Imprisoning volatile. A move whose id
 * is in this set cannot be used by any mon of `playerId`. Computed once per `getLegalActions` call
 * (and once per `executeUseMove` guard) so the per-move test is O(1) `set.has(moveId)`.
 */
export function collectImprisonedMoveIds(state: BattleState, playerId: PlayerId): Set<string> {
  const moveIds = new Set<string>();
  for (const pokemon of state.pokemon.values()) {
    if (pokemon.currentHp <= 0 || pokemon.playerId === playerId) {
      continue;
    }
    if (!pokemon.volatileStatuses.some((volatile) => volatile.type === StatusType.Imprisoning)) {
      continue;
    }
    for (const moveId of pokemon.moveIds) {
      moveIds.add(moveId);
    }
  }
  return moveIds;
}
