import type { BattleState } from "../types/battle-state";
import type { PokemonInstance } from "../types/pokemon-instance";
import { manhattanDistance } from "../utils";

const FRIEND_GUARD_RADIUS = 2;
const FRIEND_GUARD_MULTIPLIER = 0.75;

/**
 * Garde Amie (friend-guard): a living ally of the defender within Manhattan r2 reduces the damage
 * the defender takes to ×0.75. Multiplicative with screens (Reflet/Mur Lumière). Applied in
 * handle-damage after the core damage calc (which lacks `state`). Inert in 1v1 (no ally on field).
 */
export function friendGuardMultiplier(state: BattleState, defender: PokemonInstance): number {
  for (const pokemon of state.pokemon.values()) {
    if (
      pokemon.id !== defender.id &&
      pokemon.currentHp > 0 &&
      pokemon.playerId === defender.playerId &&
      pokemon.abilityId === "friend-guard" &&
      manhattanDistance(pokemon.position, defender.position) <= FRIEND_GUARD_RADIUS
    ) {
      return FRIEND_GUARD_MULTIPLIER;
    }
  }
  return 1;
}
