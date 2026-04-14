import { BattleEventType } from "../../enums/battle-event-type";
import { Category } from "../../enums/category";
import type { EffectKind } from "../../enums/effect-kind";
import type { PokemonType } from "../../enums/pokemon-type";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { PokemonInstance } from "../../types/pokemon-instance";
import type { RandomFn } from "../../utils/prng";
import { calculateDamage } from "../damage-calculator";
import { checkDefense } from "../defense-check";
import type { EffectContext, TypeChart } from "../effect-handler-registry";

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
  const damage = calculateDamage(
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

  const effectiveness = getEffectivenessForEvent(
    context.move.type,
    defenderTypes,
    context.typeChart,
  );

  target.currentHp = Math.max(0, target.currentHp - actualDamage);

  events.push({
    type: BattleEventType.DamageDealt,
    targetId: target.id,
    amount: actualDamage,
    effectiveness,
  });

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

function getEffectivenessForEvent(
  moveType: PokemonType,
  defenderTypes: PokemonType[],
  typeChart: TypeChart,
): number {
  let multiplier = 1;
  const attackerRow = typeChart[moveType];
  if (!attackerRow) {
    return 1;
  }
  for (const defType of defenderTypes) {
    const value = attackerRow[defType];
    if (value !== undefined) {
      multiplier *= value;
    }
  }
  return multiplier;
}
