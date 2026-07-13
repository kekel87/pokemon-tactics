import { BattleEventType } from "../../../enums/battle-event-type";
import { PokemonGender } from "../../../enums/pokemon-gender";
import { StatusType } from "../../../enums/status-type";
import type { BattleEvent } from "../../../types/battle-event";
import { ProtectionReason } from "../../../types/battle-event";
import { resolveDefensiveAbility } from "../../ability-suppression";
import { isProtectedFromStatus } from "../../aura-system";
import type { EffectContext } from "../../effect-handler-registry";
import { effectiveGender } from "../../effective-gender";
import { tryMentalHerbCure } from "../../mental-herb";
import { shouldSubstituteBlock } from "../../substitute-system";
import { effectiveWeather } from "../../weather-system";

/**
 * Attraction (attract, plan 154): infatuate an opposite-gender target (50% skip, position-linked via
 * `processInfatuated`). Mirrors the Charme (cute-charm) volatile: `remainingTurns -1` + `sourceId`.
 * Genderless mons (either side) and same-gender pairs fail silently. Honours Substitute / Safeguard /
 * sleep-blocking-style abilities (Oblivious, Aroma Veil) / Mental Herb, like any status move.
 */
export function handleAttract(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  const target = context.targets[0];
  const fail: BattleEvent[] = [
    { type: BattleEventType.MoveFailed, attackerId: caster.id, moveId: context.move.id },
  ];

  if (target === undefined) {
    return fail;
  }

  const casterGender = effectiveGender(caster);
  const targetGender = effectiveGender(target);
  if (
    casterGender === PokemonGender.Genderless ||
    targetGender === PokemonGender.Genderless ||
    casterGender === targetGender
  ) {
    return fail;
  }

  if (target.volatileStatuses.some((volatile) => volatile.type === StatusType.Infatuated)) {
    return fail;
  }

  const events: BattleEvent[] = [];

  const ability = resolveDefensiveAbility(context.abilityRegistry, target, caster);
  const abilityBlock = ability?.onStatusBlocked?.({
    self: target,
    status: StatusType.Infatuated,
    source: caster,
    weather: effectiveWeather(context.state, (pokemon) => {
      if (pokemon.currentHp <= 0) {
        return false;
      }
      return context.abilityRegistry?.getForPokemon(pokemon)?.suppressesWeatherEffects === true;
    }),
  });
  if (abilityBlock?.blocked) {
    events.push(...abilityBlock.events);
    events.push({
      type: BattleEventType.StatusImmune,
      targetId: target.id,
      status: StatusType.Infatuated,
    });
    return events;
  }

  const safeguard = isProtectedFromStatus(context.state, caster, target, StatusType.Infatuated);
  if (safeguard.protected) {
    return [
      {
        type: BattleEventType.StatusBlocked,
        pokemonId: target.id,
        status: StatusType.Infatuated,
        reason: ProtectionReason.Safeguard,
        protectingCasterId: safeguard.casterId,
      },
    ];
  }

  if (shouldSubstituteBlock(caster, target, context.move)) {
    return [
      {
        type: BattleEventType.StatusBlocked,
        pokemonId: target.id,
        status: StatusType.Infatuated,
        reason: ProtectionReason.Substitute,
      },
    ];
  }

  target.volatileStatuses.push({
    type: StatusType.Infatuated,
    remainingTurns: -1,
    sourceId: caster.id,
  });
  events.push({
    type: BattleEventType.StatusApplied,
    targetId: target.id,
    status: StatusType.Infatuated,
  });
  events.push(...tryMentalHerbCure(target, StatusType.Infatuated, context.itemRegistry));
  return events;
}
