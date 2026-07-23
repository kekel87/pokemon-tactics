import { PokemonType } from "../enums/pokemon-type";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { AbilityHandlerRegistry } from "./ability-handler-registry";
import { resolveDefensiveAbility } from "./ability-suppression";
import type { HeldItemHandlerRegistry } from "./held-item-handler-registry";

/**
 * Whether `target` shrugs off a powder move (Poudre Fureur / rage-powder, plan 155). A powder move
 * has no effect on:
 * - a Grass-type target (canon Gen 6+),
 * - the Envelocape ability (`overcoat`) — via its `onMoveImmunity` hook,
 * - the Lunettes Filtre item (`safety-goggles`) — via its `onMoveImmunity` hook.
 *
 * Returns `false` for non-powder moves. This mirrors the powder gate in `effect-processor.ts`
 * (Grass type + ability/item hooks); it exists so grid-targeting handlers (Poudre Fureur) that run
 * their own target loop, outside `processEffects`, share the exact same immunity rule.
 */
export function isImmuneToPowderMove(
  target: PokemonInstance,
  move: MoveDefinition,
  targetTypes: PokemonType[],
  attacker: PokemonInstance,
  abilityRegistry: AbilityHandlerRegistry | undefined,
  itemRegistry: HeldItemHandlerRegistry | undefined,
): boolean {
  if (move.flags?.powder !== true) {
    return false;
  }
  if (targetTypes.includes(PokemonType.Grass)) {
    return true;
  }
  const abilityBlocked = resolveDefensiveAbility(
    abilityRegistry,
    target,
    attacker,
  )?.onMoveImmunity?.({ self: target, move })?.blocked;
  if (abilityBlocked === true) {
    return true;
  }
  const itemBlocked = itemRegistry
    ?.getForPokemon(target)
    ?.onMoveImmunity?.({ self: target, move })?.blocked;
  return itemBlocked === true;
}
