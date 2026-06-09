import { BattleEventType } from "../../enums/battle-event-type";
import { Category } from "../../enums/category";
import type { EffectKind } from "../../enums/effect-kind";
import { HeldItemId } from "../../enums/held-item-id";
import { PokemonType } from "../../enums/pokemon-type";
import { StatName } from "../../enums/stat-name";
import { StatusType } from "../../enums/status-type";
import { Weather } from "../../enums/weather";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { MoveDefinition } from "../../types/move-definition";
import type { PokemonInstance } from "../../types/pokemon-instance";
import type { RandomFn } from "../../utils/prng";
import {
  computeBrickBreakInteraction,
  computeScreenMultiplier,
  removeAurasOfCaster,
} from "../aura-system";
import { effectConditionHolds } from "../condition-eval";
import { calculateDamageWithCrit, getTypeEffectiveness } from "../damage-calculator";
import { checkDefense } from "../defense-check";
import { resolveDynamicPower } from "../dynamic-power-system";
import type { EffectContext } from "../effect-handler-registry";
import {
  getFieldTerrainBpMultiplier,
  getFieldTerrainDamageMultiplier,
  getFieldTerrainMovePowerMultiplier,
  resolveFieldTerrainPulseMove,
} from "../field-terrain-system";
import { isMajorStatus } from "../stat-modifier";
import { applySubstituteAbsorption, shouldSubstituteBlock } from "../substitute-system";
import {
  effectiveWeather,
  getWeatherBallBp,
  getWeatherBallType,
  getWeatherBpModifier,
  getWeatherDefenseStatBoost,
} from "../weather-system";

function resolveWeatherBallMove(move: MoveDefinition, activeWeather: Weather): MoveDefinition {
  if (!move.weatherBoostedType) {
    return move;
  }
  return {
    ...move,
    type: getWeatherBallType(activeWeather),
    power: getWeatherBallBp(activeWeather, move.power),
  };
}

const MULTI_HIT_PROBABILITIES: number[] = [0.35, 0.35, 0.15, 0.15];

function rollMultiHitCount(min: number, max: number, random: RandomFn): number {
  const roll = random();
  let cumulative = 0;
  for (let i = 0; i < MULTI_HIT_PROBABILITIES.length; i++) {
    cumulative += MULTI_HIT_PROBABILITIES[i] ?? 0;
    if (roll < cumulative) {
      return min + i;
    }
  }
  return max;
}

function getHitCount(
  effect: Extract<Effect, { kind: typeof EffectKind.Damage }>,
  random: RandomFn,
): number {
  if (effect.escalatingHitPower !== undefined) {
    return effect.escalatingHitPower.length;
  }
  if (effect.hits === undefined) {
    return 1;
  }
  if (typeof effect.hits === "number") {
    return effect.hits;
  }
  return rollMultiHitCount(effect.hits.min, effect.hits.max, random);
}

/**
 * Beat Up (B3): one hit per healthy team member, power = 5 + floor(ally base Attack / 10).
 * The user always participates; other allies are skipped if fainted or holding a major status
 * (parity with Showdown's `pokemon.side.pokemon.filter(...)`).
 */
function computeBeatUpPowers(context: EffectContext): number[] {
  const powers: number[] = [];
  for (const mon of context.state.pokemon.values()) {
    if (mon.playerId !== context.attacker.playerId) {
      continue;
    }
    const isSelf = mon.id === context.attacker.id;
    if (!isSelf) {
      if (mon.currentHp <= 0) {
        continue;
      }
      if (mon.statusEffects.some((s) => isMajorStatus(s.type))) {
        continue;
      }
    }
    powers.push(5 + Math.floor(mon.baseStats.attack / 10));
  }
  return powers;
}

function dealSingleHit(
  context: EffectContext,
  target: PokemonInstance,
  defenderTypes: PokemonType[],
  hitPowerOverride?: number,
): BattleEvent[] {
  const events: BattleEvent[] = [];
  const facingMod = context.facingModifierMap.get(target.id) ?? 1.0;
  const activeWeather = effectiveWeather(context.state, (pokemon) => {
    if (pokemon.currentHp <= 0) {
      return false;
    }
    const handler = context.abilityRegistry?.getForPokemon(pokemon);
    return handler?.suppressesWeatherEffects === true;
  });
  let resolvedMove = resolveDynamicPower(
    resolveFieldTerrainPulseMove(
      context.state,
      context.attacker,
      context.attackerTypes,
      resolveWeatherBallMove(context.move, activeWeather),
    ),
    context.attacker,
    target,
    context.state,
  );
  if (hitPowerOverride !== undefined) {
    resolvedMove = { ...resolvedMove, power: hitPowerOverride };
  }
  // Charge (B3): the user's next Electric move is doubled while the Charged volatile is held.
  if (
    resolvedMove.type === PokemonType.Electric &&
    context.attacker.volatileStatuses.some((v) => v.type === StatusType.Charged)
  ) {
    resolvedMove = { ...resolvedMove, power: resolvedMove.power * 2 };
  }
  let weatherBp = getWeatherBpModifier(resolvedMove.type, activeWeather);
  if (
    resolvedMove.id === "solar-beam" &&
    (activeWeather === Weather.Rain ||
      activeWeather === Weather.Sandstorm ||
      activeWeather === Weather.Snow)
  ) {
    weatherBp *= 0.5;
  }
  const usesPhysicalDefense =
    resolvedMove.category === Category.Physical || resolvedMove.hitsPhysicalDefense === true;
  const defenseStat = usesPhysicalDefense ? StatName.Defense : StatName.SpDefense;
  const defenseWeather = getWeatherDefenseStatBoost(defenderTypes, defenseStat, activeWeather);
  const brickBreakInteraction = computeBrickBreakInteraction(context.state, target, resolvedMove);
  const screenMultiplier = brickBreakInteraction.breakAuraCasterId
    ? 1.0
    : computeScreenMultiplier(context.state, context.attacker, target, resolvedMove);
  const fieldTerrainBp =
    getFieldTerrainBpMultiplier(
      context.state,
      context.attacker,
      context.attackerTypes,
      resolvedMove,
    ) *
    getFieldTerrainMovePowerMultiplier(
      context.state,
      context.attacker,
      context.attackerTypes,
      target,
      defenderTypes,
      resolvedMove,
    );
  const fieldTerrainDamage = getFieldTerrainDamageMultiplier(
    context.state,
    target,
    defenderTypes,
    resolvedMove,
  );
  const { damage, isCrit } = calculateDamageWithCrit(
    context.attacker,
    target,
    resolvedMove,
    context.typeChart,
    context.attackerTypes,
    defenderTypes,
    undefined,
    context.random,
    context.heightModifier,
    context.terrainModifier,
    facingMod,
    context.abilityRegistry,
    context.itemRegistry,
    weatherBp,
    defenseWeather,
    screenMultiplier,
    brickBreakInteraction.multiplier,
    fieldTerrainBp,
    fieldTerrainDamage,
  );

  const defenseResult = checkDefense(
    context.attacker,
    target,
    context.move,
    damage,
    context.targetPosition,
  );
  events.push(...defenseResult.events);

  if (defenseResult.consumeDefense) {
    target.activeDefense = null;
  }

  if (defenseResult.blocked) {
    return events;
  }

  let actualDamage = damage;
  if (defenseResult.endureAtOne) {
    actualDamage = target.currentHp - 1;
  }

  const wasAtMaxHp = target.currentHp === target.maxHp;

  const targetAbility = context.abilityRegistry?.getForPokemon(target);
  let sturdyTriggered = false;
  if (
    targetAbility?.id === "sturdy" &&
    wasAtMaxHp &&
    !defenseResult.endureAtOne &&
    actualDamage >= target.currentHp
  ) {
    actualDamage = target.currentHp - 1;
    sturdyTriggered = true;
  }

  const targetItem = context.itemRegistry?.getForPokemon(target);
  const isSuperEffective =
    getTypeEffectiveness(
      context.move.type,
      defenderTypes,
      context.typeChart,
      context.move.typeEffectivenessOverride,
    ) > 1;
  const isContact = context.move.flags?.contact === true;

  let focusSashTriggered = false;
  if (
    targetItem?.id === HeldItemId.FocusSash &&
    wasAtMaxHp &&
    !defenseResult.endureAtOne &&
    !sturdyTriggered &&
    actualDamage >= target.currentHp
  ) {
    actualDamage = target.currentHp - 1;
    focusSashTriggered = true;
  }

  const effectiveness = getTypeEffectiveness(
    context.move.type,
    defenderTypes,
    context.typeChart,
    context.move.typeEffectivenessOverride,
  );

  if (isCrit) {
    events.push({ type: BattleEventType.CriticalHit, targetId: target.id });
  }

  const subBlocks = shouldSubstituteBlock(context.attacker, target, context.move);
  if (subBlocks) {
    const { absorbed, broken } = applySubstituteAbsorption(target, actualDamage);
    context.shared.lastDamageDealt += absorbed;

    events.push({
      type: BattleEventType.DamageDealt,
      targetId: target.id,
      amount: absorbed,
      effectiveness,
      absorbedBySubstitute: absorbed,
    });

    if (absorbed > 0) {
      events.push({
        type: BattleEventType.SubstituteDamaged,
        pokemonId: target.id,
        damage: absorbed,
        remaining: target.substituteHp ?? 0,
      });
    }

    if (broken) {
      events.push({
        type: BattleEventType.SubstituteBroken,
        pokemonId: target.id,
        breakerId: context.attacker.id,
        breakerMoveId: context.move.id,
      });
    }

    return events;
  }

  target.currentHp = Math.max(0, target.currentHp - actualDamage);
  context.shared.lastDamageDealt += actualDamage;

  if (actualDamage > 0) {
    // Action-clock stamps (B3): record that the target took damage this action so
    // Assurance / Avalanche / Revenge / Rage Fist can read it on later turns.
    const clock = context.state.actionCounter ?? 0;
    target.lastDamagedAtAction = clock;
    target.timesHit = (target.timesHit ?? 0) + 1;
    if (context.attacker.id !== target.id && context.attacker.playerId !== target.playerId) {
      target.lastDamagedByEnemyAtAction = clock;
    }
  }

  events.push({
    type: BattleEventType.DamageDealt,
    targetId: target.id,
    amount: actualDamage,
    effectiveness,
  });

  if (brickBreakInteraction.breakAuraCasterId) {
    const brokenAuras = removeAurasOfCaster(context.state, brickBreakInteraction.breakAuraCasterId);
    for (const brokenAura of brokenAuras) {
      events.push({
        type: BattleEventType.AuraBroken,
        casterId: brickBreakInteraction.breakAuraCasterId,
        kind: brokenAura.kind,
        breakerId: context.attacker.id,
        breakerMoveId: context.move.id,
      });
    }
  }

  if (sturdyTriggered) {
    events.push({
      type: BattleEventType.AbilityActivated,
      pokemonId: target.id,
      abilityId: "sturdy",
      targetIds: [target.id],
    });
  }

  if (focusSashTriggered) {
    events.push({
      type: BattleEventType.HeldItemActivated,
      pokemonId: target.id,
      itemId: HeldItemId.FocusSash,
      targetIds: [target.id],
    });
    events.push({
      type: BattleEventType.HeldItemConsumed,
      pokemonId: target.id,
      itemId: HeldItemId.FocusSash,
    });
    target.heldItemId = undefined;
  }

  if (target.currentHp <= 0) {
    events.push({
      type: BattleEventType.PokemonKo,
      pokemonId: target.id,
      countdownStart: 0,
    });
  }

  if (defenseResult.reflectDamage > 0 && target.currentHp > 0) {
    const reflectedDamage = Math.min(defenseResult.reflectDamage, context.attacker.currentHp);
    context.attacker.currentHp = Math.max(0, context.attacker.currentHp - reflectedDamage);

    events.push({
      type: BattleEventType.DamageDealt,
      targetId: context.attacker.id,
      amount: reflectedDamage,
      effectiveness: 1,
    });

    if (context.attacker.currentHp <= 0) {
      events.push({
        type: BattleEventType.PokemonKo,
        pokemonId: context.attacker.id,
        countdownStart: 0,
      });
    }
  }

  if (actualDamage > 0 && target.currentHp > 0 && targetAbility?.onAfterDamageReceived) {
    const attackerTypes = context.attackerTypes;
    const selfTypes = defenderTypes;
    const abilityEvents = targetAbility.onAfterDamageReceived({
      self: target,
      attacker: context.attacker,
      move: context.move,
      damageDealt: actualDamage,
      wasAtMaxHp,
      state: context.state,
      selfTypes,
      attackerTypes,
      random: context.random,
    });
    events.push(...abilityEvents);
  }

  const attackerAbility = context.abilityRegistry?.getForPokemon(context.attacker);
  if (actualDamage > 0 && target.currentHp > 0 && attackerAbility?.onAfterDamageDealt) {
    const abilityEvents = attackerAbility.onAfterDamageDealt({
      self: context.attacker,
      target,
      move: context.move,
      damageDealt: actualDamage,
      state: context.state,
      selfTypes: context.attackerTypes,
      targetTypes: defenderTypes,
      random: context.random,
    });
    events.push(...abilityEvents);
  }

  if (actualDamage > 0 && target.currentHp > 0 && targetItem?.onAfterDamageReceived) {
    const result = targetItem.onAfterDamageReceived({
      target,
      attacker: context.attacker,
      move: context.move,
      damageDealt: actualDamage,
      wasAtMaxHp,
      isSuperEffective,
      isContact,
    });
    events.push(...result.events);
    if (result.consumeItem) {
      target.heldItemId = undefined;
    }
    if (target.currentHp <= 0) {
      events.push({
        type: BattleEventType.PokemonKo,
        pokemonId: target.id,
        countdownStart: 0,
      });
    }
  }

  if (actualDamage > 0) {
    const attackerItem = context.itemRegistry?.getForPokemon(context.attacker);
    if (attackerItem?.onAfterMoveDamageDealt) {
      const itemEvents = attackerItem.onAfterMoveDamageDealt({
        attacker: context.attacker,
        move: context.move,
        damageDealt: actualDamage,
      });
      events.push(...itemEvents);
    }
  }

  return events;
}

export function handleDamage(context: EffectContext): BattleEvent[] {
  const events: BattleEvent[] = [];

  if (context.move.category === Category.Status) {
    return events;
  }

  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.Damage }>;
  const beatUpPowers = effect.teamBeatUp === true ? computeBeatUpPowers(context) : undefined;
  const hitCount = beatUpPowers?.length ?? getHitCount(effect, context.random);
  const isMultiHit = hitCount > 1;

  for (const target of context.targets) {
    // Conditional damage branch (pollen-puff): only damage when the predicate holds (e.g. the
    // target is an enemy). On an ally, the move's HealTarget branch applies instead.
    if (
      effect.appliesIf !== undefined &&
      !effectConditionHolds(effect.appliesIf, context.attacker, target)
    ) {
      continue;
    }

    const defenderTypes = context.targetTypesMap.get(target.id) ?? [];
    let actualHits = 0;

    for (let hit = 0; hit < hitCount; hit++) {
      if (target.currentHp <= 0) {
        break;
      }

      if (hit > 0 && context.move.perHitAccuracy === true) {
        if (context.random() * 100 >= context.move.accuracy) {
          break;
        }
      }

      const hitPower = beatUpPowers?.[hit] ?? effect.escalatingHitPower?.[hit];
      const hitEvents = dealSingleHit(context, target, defenderTypes, hitPower);
      events.push(...hitEvents);
      actualHits++;

      if (target.currentHp <= 0) {
        break;
      }
    }

    if (isMultiHit && actualHits > 0) {
      events.push({
        type: BattleEventType.MultiHitComplete,
        attackerId: context.attacker.id,
        targetId: target.id,
        totalHits: actualHits,
      });
    }
  }

  return events;
}
