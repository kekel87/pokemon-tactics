import { BattleEventType } from "../enums/battle-event-type";
import type { BattleEvent } from "../types/battle-event";
import type { BattleState } from "../types/battle-state";

/**
 * Reveal-on-use tracking (plan 176).
 *
 * The `revealed*` flags on a `PokemonInstance` started as scouting markers (Fouille / Prédiction /
 * Anticipation, plan 163). With the fog they also gate what an ENEMY panel is allowed to print, so
 * they must record everything the player has actually WATCHED happen: an item or an ability that
 * fires emits an event and is named in the battle log, so keeping it hidden in the panel would only
 * tax the player's memory — it hides nothing.
 *
 * Only events that NAME the item/ability count. `ItemMoveFailed` carries no item id (nothing was
 * shown), and a stat change or a status has no revealing event of its own.
 */
export function applyRevealsFromEvents(state: BattleState, events: readonly BattleEvent[]): void {
  for (const event of events) {
    switch (event.type) {
      // The holder's item acted, was consumed, eaten, burnt, flung or recycled — the log named it.
      case BattleEventType.HeldItemActivated:
      case BattleEventType.HeldItemConsumed:
      case BattleEventType.ItemBurned:
      case BattleEventType.ItemFlung:
      case BattleEventType.ItemRecycled:
      case BattleEventType.ItemKnockedOff:
        revealItem(state, event.pokemonId);
        break;

      case BattleEventType.BerryEaten:
        revealItem(state, event.eaterId);
        break;

      // A theft names the item and moves it: both ends become known.
      case BattleEventType.ItemStolen:
        revealItem(state, event.thiefId);
        revealItem(state, event.victimId);
        break;

      // A swap (Tour de Magie / Passe-Passe) names no item in the journal, but it EXCHANGES them: the
      // one that lands on a fully-visible card is read there, and the one the other end receives is
      // the item the player already knew. Both sides end up known either way.
      case BattleEventType.ItemsSwapped:
        revealItem(state, event.pokemonId);
        revealItem(state, event.otherId);
        break;

      case BattleEventType.AbilityActivated:
        revealAbility(state, event.pokemonId);
        break;

      // Ability manip (Échange, Détrempage, Copie Talent…): the journal spells out the ability the
      // target ends up with ("X copie le talent Y !"). A SUPPRESSION (Suc Digestif) carries no
      // ability id and names nothing — revealing there would hand over the ability it just sealed.
      case BattleEventType.AbilityChanged:
        if (event.abilityId !== undefined) {
          revealAbility(state, event.pokemonId);
        }
        break;

      default:
        break;
    }
  }
}

function revealItem(state: BattleState, pokemonId: string): void {
  const pokemon = state.pokemon.get(pokemonId);
  if (pokemon) {
    pokemon.revealedItem = true;
  }
}

function revealAbility(state: BattleState, pokemonId: string): void {
  const pokemon = state.pokemon.get(pokemonId);
  if (pokemon) {
    pokemon.revealedAbility = true;
  }
}
