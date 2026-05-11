import { BattleEventType } from "../../enums/battle-event-type";
import { Category } from "../../enums/category";
import type { EffectKind } from "../../enums/effect-kind";
import { HeldItemId } from "../../enums/held-item-id";
import type { PokemonType } from "../../enums/pokemon-type";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { PokemonInstance } from "../../types/pokemon-instance";
import type { RandomFn } from "../../utils/prng";
import { calculateDamageWithCrit, getTypeEffectiveness } from "../damage-calculator";
import { checkDefense } from "../defense-check";
import type { EffectContext } from "../effect-handler-registry";

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
  if (effect.hits === undefined) {
    return 1;
  }
  if (typeof effect.hits === "number") {
    return effect.hits;
  }
  return rollMultiHitCount(effect.hits.min, effect.hits.max, random);
}

function dealSingleHit(
  context: EffectContext,
  target: PokemonInstance,
  defenderTypes: PokemonType[],
): BattleEvent[] {
  const events: BattleEvent[] = [];
  const facingMod = context.facingModifierMap.get(target.id) ?? 1.0;
  const { damage, isCrit } = calculateDamageWithCrit(
    context.attacker,
    target,
    context.move,
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
    getTypeEffectiveness(context.move.type, defenderTypes, context.typeChart) > 1;
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

  const effectiveness = getTypeEffectiveness(context.move.type, defenderTypes, context.typeChart);

  if (isCrit) {
    events.push({ type: BattleEventType.CriticalHit, targetId: target.id });
  }

  target.currentHp = Math.max(0, target.currentHp - actualDamage);
  context.shared.lastDamageDealt += actualDamage;

  events.push({
    type: BattleEventType.DamageDealt,
    targetId: target.id,
    amount: actualDamage,
    effectiveness,
  });

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
  const hitCount = getHitCount(effect, context.random);
  const isMultiHit = hitCount > 1;

  for (const target of context.targets) {
    const defenderTypes = context.targetTypesMap.get(target.id) ?? [];
    let actualHits = 0;

    for (let hit = 0; hit < hitCount; hit++) {
      if (target.currentHp <= 0) {
        break;
      }

      const hitEvents = dealSingleHit(context, target, defenderTypes);
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
