import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import { EffectTarget } from "../../enums/effect-target";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { EffectContext } from "../effect-handler-registry";
import { clampStages } from "../stat-modifier";

export function handleStatChange(context: EffectContext): BattleEvent[] {
  const events: BattleEvent[] = [];
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.StatChange }>;
  const affectedPokemon =
    effect.target === EffectTarget.Self ? [context.attacker] : context.targets;

  for (const pokemon of affectedPokemon) {
    const currentStage = pokemon.statStages[effect.stat];
    const newStage = clampStages(currentStage, effect.stages);
    const actualChange = newStage - currentStage;

    if (actualChange === 0) {
      continue;
    }

    pokemon.statStages[effect.stat] = newStage;

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
