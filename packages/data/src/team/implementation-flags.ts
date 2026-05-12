import type { AbilityHandler, HeldItemHandler, HeldItemId } from "@pokemon-tactic/core";
import type { TacticalOverride } from "../overrides/tactical";
import type { RosterEntry } from "../roster/roster-entry";

export function isPokemonImplemented(pokemonId: string, roster: readonly RosterEntry[]): boolean {
  return roster.some((entry) => entry.id === pokemonId);
}

export function isMoveImplemented(
  moveId: string,
  tacticalOverrides: Record<string, TacticalOverride>,
): boolean {
  return Object.hasOwn(tacticalOverrides, moveId);
}

export function isAbilityImplemented(
  abilityId: string,
  abilityHandlers: readonly AbilityHandler[],
): boolean {
  return abilityHandlers.some((handler) => handler.id === abilityId);
}

export function isItemImplemented(
  itemId: HeldItemId,
  itemHandlers: readonly HeldItemHandler[],
): boolean {
  return itemHandlers.some((handler) => handler.id === itemId);
}
