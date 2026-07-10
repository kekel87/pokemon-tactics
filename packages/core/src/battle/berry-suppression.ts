import type { BattleState } from "../types/battle-state";
import type { PokemonInstance } from "../types/pokemon-instance";
import { effectiveAbilityId } from "./effective-ability";

/**
 * Tension (unnerve): while a living opponent of the berry holder carries Tension, the holder cannot
 * eat its berry. Checked at every berry-consumption call site in the engine (the item handlers do
 * not receive `state`). No switching in this game → "in play" = any living enemy on the field.
 */
export function areBerriesSuppressed(state: BattleState, holder: PokemonInstance): boolean {
  for (const pokemon of state.pokemon.values()) {
    if (
      pokemon.currentHp > 0 &&
      pokemon.playerId !== holder.playerId &&
      effectiveAbilityId(pokemon) === "unnerve"
    ) {
      return true;
    }
  }
  return false;
}
