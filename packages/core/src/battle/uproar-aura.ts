import { BattleEventType } from "../enums/battle-event-type";
import { StatusType } from "../enums/status-type";
import type { BattleEvent } from "../types/battle-event";
import type { BattleState } from "../types/battle-state";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";

/** Manhattan radius of Brouhaha's no-sleep aura (mobile, centred on the locked caster). */
const UPROAR_AURA_RADIUS = 3;
const UPROAR_MOVE_ID = "uproar";

/** True while `pokemon` is locked into Brouhaha (uproar) — it projects the no-sleep aura. */
export function isUproarLocked(pokemon: PokemonInstance): boolean {
  return (pokemon.lockInTurnsRemaining ?? 0) > 0 && pokemon.lockInMoveId === UPROAR_MOVE_ID;
}

function manhattan(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * True when `position` sits within an active Brouhaha's no-sleep aura (Manhattan r3). Sound-based:
 * ignores line of sight and does NOT require the sleeper to be grounded (unlike Terrain Brumeux).
 */
export function isUnderNoSleepAura(state: BattleState, position: Position): boolean {
  for (const pokemon of state.pokemon.values()) {
    if (
      pokemon.currentHp > 0 &&
      isUproarLocked(pokemon) &&
      manhattan(pokemon.position, position) <= UPROAR_AURA_RADIUS
    ) {
      return true;
    }
  }
  return false;
}

/** On the first cast of Brouhaha, rouse every sleeper within r3 (removes the Asleep major status). */
export function wakeSleepersInUproarRadius(
  state: BattleState,
  caster: PokemonInstance,
): BattleEvent[] {
  const events: BattleEvent[] = [];
  for (const pokemon of state.pokemon.values()) {
    if (pokemon.currentHp <= 0) {
      continue;
    }
    if (manhattan(caster.position, pokemon.position) > UPROAR_AURA_RADIUS) {
      continue;
    }
    const index = pokemon.statusEffects.findIndex((status) => status.type === StatusType.Asleep);
    if (index >= 0) {
      pokemon.statusEffects.splice(index, 1);
      events.push({
        type: BattleEventType.StatusRemoved,
        targetId: pokemon.id,
        status: StatusType.Asleep,
      });
    }
  }
  return events;
}
