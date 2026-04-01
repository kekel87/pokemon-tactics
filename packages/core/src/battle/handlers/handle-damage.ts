import { BattleEventType } from "../../enums/battle-event-type";
import { Category } from "../../enums/category";
import type { PokemonType } from "../../enums/pokemon-type";
import type { BattleEvent } from "../../types/battle-event";
import { calculateDamage } from "../damage-calculator";
import { checkDefense } from "../defense-check";
import type { EffectContext, TypeChart } from "../effect-handler-registry";

export function handleDamage(context: EffectContext): BattleEvent[] {
  const events: BattleEvent[] = [];

  if (context.move.category === Category.Status) {
    return events;
  }

  for (const target of context.targets) {
    const defenderTypes = context.targetTypesMap.get(target.id) ?? [];
    const damage = calculateDamage(
      context.attacker,
      target,
      context.move,
      context.typeChart,
      context.attackerTypes,
      defenderTypes,
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
      continue;
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

    const damageEvent: BattleEvent = {
      type: BattleEventType.DamageDealt,
      targetId: target.id,
      amount: actualDamage,
      effectiveness,
    };
    events.push(damageEvent);

    if (target.currentHp <= 0) {
      const koEvent: BattleEvent = {
        type: BattleEventType.PokemonKo,
        pokemonId: target.id,
        countdownStart: 0,
      };
      events.push(koEvent);
    }

    if (defenseResult.reflectDamage > 0 && target.currentHp > 0) {
      const reflectedDamage = Math.min(defenseResult.reflectDamage, context.attacker.currentHp);
      context.attacker.currentHp = Math.max(0, context.attacker.currentHp - reflectedDamage);

      const reflectEvent: BattleEvent = {
        type: BattleEventType.DamageDealt,
        targetId: context.attacker.id,
        amount: reflectedDamage,
        effectiveness: 1,
      };
      events.push(reflectEvent);

      if (context.attacker.currentHp <= 0) {
        const koEvent: BattleEvent = {
          type: BattleEventType.PokemonKo,
          pokemonId: context.attacker.id,
          countdownStart: 0,
        };
        events.push(koEvent);
      }
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
