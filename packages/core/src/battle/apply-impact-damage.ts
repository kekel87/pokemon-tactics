import { BattleEventType } from "../enums/battle-event-type";
import type { BattleEvent } from "../types/battle-event";
import type { PokemonInstance } from "../types/pokemon-instance";
import { calculateFallDamage } from "./fall-damage";

export function applyImpactDamage(pokemon: PokemonInstance, heightDiff: number): BattleEvent[] {
  const events: BattleEvent[] = [];
  const damage = calculateFallDamage(heightDiff, pokemon.maxHp);
  if (damage <= 0) {
    return events;
  }

  pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
  events.push({
    type: BattleEventType.WallImpactDealt,
    pokemonId: pokemon.id,
    amount: damage,
    heightDiff,
  });

  if (pokemon.currentHp <= 0) {
    events.push({ type: BattleEventType.PokemonKo, pokemonId: pokemon.id, countdownStart: 0 });
  }

  return events;
}
