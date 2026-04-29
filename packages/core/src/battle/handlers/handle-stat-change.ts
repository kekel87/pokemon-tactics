import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import { EffectTarget } from "../../enums/effect-target";
import { StatName } from "../../enums/stat-name";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { EffectContext } from "../effect-handler-registry";
import { clampStages, computeMovement } from "../stat-modifier";

export function handleStatChange(context: EffectContext): BattleEvent[] {
  const events: BattleEvent[] = [];
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.StatChange }>;
  const affectedPokemon =
    effect.target === EffectTarget.Self ? [context.attacker] : context.targets;
  const isEnemyDebuff = effect.target !== EffectTarget.Self && effect.stages < 0;

  for (const pokemon of affectedPokemon) {
    if (isEnemyDebuff) {
      const blockResult = context.abilityRegistry?.getForPokemon(pokemon)?.onStatChangeBlocked?.({
        self: pokemon,
        stat: effect.stat,
        stages: effect.stages,
        source: context.attacker,
      });
      if (blockResult?.blocked) {
        events.push(...blockResult.events);
        continue;
      }
    }

    const currentStage = pokemon.statStages[effect.stat];
    const newStage = clampStages(currentStage, effect.stages);
    const actualChange = newStage - currentStage;

    if (actualChange === 0) {
      continue;
    }

    pokemon.statStages[effect.stat] = newStage;

    if (effect.stat === StatName.Speed) {
      pokemon.derivedStats.movement = computeMovement(pokemon.baseStats.speed, newStage);
    }

    const statEvent: BattleEvent = {
      type: BattleEventType.StatChanged,
      targetId: pokemon.id,
      stat: effect.stat,
      stages: actualChange,
    };
    events.push(statEvent);
  }

  return events;
}
