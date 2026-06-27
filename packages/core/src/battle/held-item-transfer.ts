import type { HeldItemId } from "../enums/held-item-id";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { AbilityHandlerRegistry } from "./ability-handler-registry";

/** Glu (sticky-hold): the holder's item cannot be removed, stolen or swapped by an opponent. */
export const STICKY_HOLD_ABILITY_ID = "sticky-hold";

/**
 * Mark an item as consumed by its own effect (berry eaten, gem spent, White Herb / Mental Herb used).
 * Records it in `consumedItemId` so Recyclage can restore it, flags `ateBerryThisBattle` when it is a
 * berry (gates Éructation), then clears the held slot. Single source of truth for self-consumption.
 */
export function consumeHeldItem(
  pokemon: PokemonInstance,
  options: { isBerry?: boolean } = {},
): void {
  const itemId = pokemon.heldItemId;
  if (itemId === undefined) {
    return;
  }
  pokemon.consumedItemId = itemId;
  if (options.isBerry) {
    pokemon.ateBerryThisBattle = true;
  }
  pokemon.heldItemId = undefined;
}

/**
 * Remove an item without recording it as recyclable — the loser cannot Recycle a knocked-off, burned,
 * corroded or flung item (canon). Returns the removed id, or undefined when the slot was empty.
 */
export function removeHeldItem(pokemon: PokemonInstance): HeldItemId | undefined {
  const itemId = pokemon.heldItemId;
  pokemon.heldItemId = undefined;
  return itemId;
}

/**
 * Move the victim's item to an empty-handed thief (Larcin / Implore). Returns the stolen id, or
 * undefined when the thief already holds an item or the victim holds none.
 */
export function stealHeldItem(
  thief: PokemonInstance,
  victim: PokemonInstance,
): HeldItemId | undefined {
  if (thief.heldItemId !== undefined || victim.heldItemId === undefined) {
    return undefined;
  }
  const itemId = victim.heldItemId;
  thief.heldItemId = itemId;
  victim.heldItemId = undefined;
  return itemId;
}

/** Swap two mons' held items (Tour de Magie / Passe-Passe). Either slot may be empty. */
export function swapHeldItems(a: PokemonInstance, b: PokemonInstance): void {
  const previous = a.heldItemId;
  a.heldItemId = b.heldItemId;
  b.heldItemId = previous;
}

/**
 * Restore the last self-consumed item (Recyclage). Returns the restored id, or undefined when nothing
 * was consumed or the holder already carries an item.
 */
export function recycleConsumedItem(pokemon: PokemonInstance): HeldItemId | undefined {
  const itemId = pokemon.consumedItemId;
  if (itemId === undefined || pokemon.heldItemId !== undefined) {
    return undefined;
  }
  pokemon.heldItemId = itemId;
  pokemon.consumedItemId = undefined;
  return itemId;
}

/** True when an opponent cannot remove / steal / swap this mon's item (Glu). */
export function isItemProtectedByStickyHold(
  pokemon: PokemonInstance,
  abilityRegistry?: AbilityHandlerRegistry,
): boolean {
  return abilityRegistry?.getForPokemon(pokemon)?.id === STICKY_HOLD_ABILITY_ID;
}
