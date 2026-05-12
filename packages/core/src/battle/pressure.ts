import { EffectKind } from "../enums/effect-kind";
import type { BattleState } from "../types/battle-state";
import type { MoveDefinition } from "../types/move-definition";
import type { AbilityHandlerRegistry } from "./ability-handler-registry";

export function isOffensiveMove(move: MoveDefinition): boolean {
  return move.effects.some((e) => e.kind === EffectKind.Damage || e.kind === EffectKind.Drain);
}

export function computePressureBonus(
  attackerId: string,
  move: MoveDefinition,
  targetIds: readonly string[],
  state: BattleState,
  abilityRegistry: AbilityHandlerRegistry | null,
): number {
  if (!abilityRegistry) {
    return 0;
  }
  if (!isOffensiveMove(move)) {
    return 0;
  }
  let bonus = 0;
  for (const targetId of targetIds) {
    if (targetId === attackerId) {
      continue;
    }
    const target = state.pokemon.get(targetId);
    if (!target) {
      continue;
    }
    const ability = abilityRegistry.getForPokemon(target);
    if (ability?.targetedCtBonus) {
      bonus += ability.targetedCtBonus;
    }
  }
  return bonus;
}
