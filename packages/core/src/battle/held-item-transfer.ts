import type { HeldItemId } from "../enums/held-item-id";
import { StatName } from "../enums/stat-name";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { AbilityHandlerRegistry } from "./ability-handler-registry";
import { effectiveAbilityId } from "./effective-ability";
import { effectiveBaseSpeed } from "./effective-base-speed";
import { computeMovement } from "./stat-modifier";

/** Glu (sticky-hold): the holder's item cannot be removed, stolen or swapped by an opponent. */
export const STICKY_HOLD_ABILITY_ID = "sticky-hold";

const UNBURDEN_ABILITY_ID = "unburden";

/**
 * Délestage (unburden, plan 163): flip the holder's speed-doubling flag from its item state — active
 * once an unburden holder is item-less, cleared when it regains one — and recompute movement. Called
 * after every held-item mutation so the boost tracks the slot in a single place.
 */
function updateUnburdenState(pokemon: PokemonInstance): void {
  const itemless = pokemon.heldItemId === undefined;
  if (itemless && !pokemon.unburdenActive && effectiveAbilityId(pokemon) === UNBURDEN_ABILITY_ID) {
    pokemon.unburdenActive = true;
  } else if (!itemless && pokemon.unburdenActive) {
    pokemon.unburdenActive = false;
  } else {
    return;
  }
  pokemon.derivedStats.movement = computeMovement(
    effectiveBaseSpeed(pokemon),
    pokemon.statStages[StatName.Speed],
  );
}

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
  updateUnburdenState(pokemon);
}

/**
 * Remove an item without recording it as recyclable — the loser cannot Recycle a knocked-off, burned,
 * corroded or flung item (canon). Returns the removed id, or undefined when the slot was empty.
 */
export function removeHeldItem(pokemon: PokemonInstance): HeldItemId | undefined {
  const itemId = pokemon.heldItemId;
  pokemon.heldItemId = undefined;
  updateUnburdenState(pokemon);
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
  updateUnburdenState(thief);
  updateUnburdenState(victim);
  return itemId;
}

/** Swap two mons' held items (Tour de Magie / Passe-Passe). Either slot may be empty. */
export function swapHeldItems(a: PokemonInstance, b: PokemonInstance): void {
  const previous = a.heldItemId;
  a.heldItemId = b.heldItemId;
  b.heldItemId = previous;
  updateUnburdenState(a);
  updateUnburdenState(b);
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
  updateUnburdenState(pokemon);
  return itemId;
}

/** True when an opponent cannot remove / steal / swap this mon's item (Glu). */
export function isItemProtectedByStickyHold(
  pokemon: PokemonInstance,
  abilityRegistry?: AbilityHandlerRegistry,
): boolean {
  return abilityRegistry?.getForPokemon(pokemon)?.id === STICKY_HOLD_ABILITY_ID;
}
