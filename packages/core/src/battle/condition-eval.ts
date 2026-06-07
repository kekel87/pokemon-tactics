import { ConditionKind } from "../enums/condition-kind";
import type { PokemonInstance } from "../types/pokemon-instance";

/**
 * Evaluates an `Effect.appliesIf` predicate at application time.
 * Shared by status / damage / heal handlers. Model-agnostic (round & CT).
 */
export function effectConditionHolds(
  condition: ConditionKind,
  attacker: PokemonInstance,
  target: PokemonInstance,
): boolean {
  switch (condition) {
    case ConditionKind.TargetBoostedRecently:
      return target.hasFreshStatBoost === true;
    case ConditionKind.TargetIsAlly:
      return attacker.playerId === target.playerId;
    case ConditionKind.TargetIsEnemy:
      return attacker.playerId !== target.playerId;
    default:
      return false;
  }
}
