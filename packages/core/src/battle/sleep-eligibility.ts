import { BattleEventType } from "../enums/battle-event-type";
import { FieldTerrain } from "../enums/field-terrain";
import type { PokemonType } from "../enums/pokemon-type";
import { StatusType } from "../enums/status-type";
import type { BattleEvent } from "../types/battle-event";
import type { BattleState } from "../types/battle-state";
import type { PokemonInstance } from "../types/pokemon-instance";
import { DEFAULT_STATUS_RULES, type StatusRules } from "../types/status-rules";
import type { RandomFn } from "../utils/prng";
import type { AbilityHandlerRegistry } from "./ability-handler-registry";
import { isOnFieldTerrain } from "./field-terrain-system";
import { isMajorStatus } from "./stat-modifier";
import { isUnderNoSleepAura } from "./uproar-aura";
import { effectiveWeather } from "./weather-system";

/**
 * Shared sleep gate for Bâillement (yawn, plan 154): the target can fall asleep only if it has no
 * major status, isn't on Electric/Misty terrain (grounded), isn't under a Brouhaha no-sleep aura, and
 * isn't protected by a sleep-blocking ability (Insomnia / Vital Spirit / Comatose / Sweet Veil).
 * Used both at cast (fail Bâillement early) and at the drowsy tick (skip the conversion silently).
 * Safeguard / Substitute are intentionally NOT re-checked at the tick — the canon Yawn conversion
 * commits at cast; only conditions that can flip between the two ticks matter here.
 */
export function canReceiveSleep(
  state: BattleState,
  target: PokemonInstance,
  targetTypes: readonly PokemonType[],
  abilityRegistry: AbilityHandlerRegistry | undefined,
): boolean {
  if (target.statusEffects.some((status) => isMajorStatus(status.type))) {
    return false;
  }
  if (
    isOnFieldTerrain(state, target, targetTypes, FieldTerrain.Electric) ||
    isOnFieldTerrain(state, target, targetTypes, FieldTerrain.Misty)
  ) {
    return false;
  }
  if (isUnderNoSleepAura(state, target.position)) {
    return false;
  }
  const ability = abilityRegistry?.getForPokemon(target);
  if (ability?.onStatusBlocked) {
    const weather = effectiveWeather(state, (pokemon) => {
      if (pokemon.currentHp <= 0) {
        return false;
      }
      return abilityRegistry?.getForPokemon(pokemon)?.suppressesWeatherEffects === true;
    });
    const blocked = ability.onStatusBlocked({
      self: target,
      status: StatusType.Asleep,
      source: target,
      weather,
    });
    if (blocked?.blocked) {
      return false;
    }
  }
  return true;
}

/**
 * Put the target to sleep with a duration sampled from the status rules (mirrors `handle-status`),
 * honouring a shortening ability (Matinal / early-bird). Returns the `StatusApplied` event.
 */
export function applySleep(
  target: PokemonInstance,
  random: RandomFn,
  statusRules: StatusRules = DEFAULT_STATUS_RULES,
  abilityRegistry?: AbilityHandlerRegistry,
): BattleEvent[] {
  const events: BattleEvent[] = [];
  const samples = statusRules.sleep.sampleTurns;
  const index = Math.floor(random() * samples.length);
  const baseDuration = samples[index] ?? samples[0] ?? 1;

  let remainingTurns = baseDuration;
  let shortenedByAbilityId: string | undefined;
  const ability = abilityRegistry?.getForPokemon(target);
  if (ability?.onStatusDurationModify) {
    const result = ability.onStatusDurationModify({
      self: target,
      status: StatusType.Asleep,
      duration: baseDuration,
    });
    if (result.duration < baseDuration) {
      shortenedByAbilityId = ability.id;
    }
    remainingTurns = result.duration;
    events.push(...result.events);
  }

  target.statusEffects.push({
    type: StatusType.Asleep,
    remainingTurns,
    ...(shortenedByAbilityId ? { shortenedByAbilityId } : {}),
  });
  events.push({
    type: BattleEventType.StatusApplied,
    targetId: target.id,
    status: StatusType.Asleep,
  });
  return events;
}
