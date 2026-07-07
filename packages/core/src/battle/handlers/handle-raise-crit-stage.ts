import { BattleEventType } from "../../enums/battle-event-type";
import { EffectKind } from "../../enums/effect-kind";
import { EffectTarget } from "../../enums/effect-target";
import { PokemonType } from "../../enums/pokemon-type";
import type { BattleEvent } from "../../types/battle-event";
import type { EffectContext } from "../effect-handler-registry";

/** Crit stages are capped like stat stages: stage 3 already guarantees a crit (1/24 → 1/8 → 1/2 → 1.0). */
const MAX_CRIT_STAGE = 6;

/**
 * Puissance (focus-energy) / Cri Draconique (dragon-cheer): raise the crit stage of the caster
 * (`Self`) or the resolved ally (`Targets`). Cri Draconique grants +1 extra stage when the buffed
 * ally's effective type includes Dragon (`dragonBonus`). Persistent volatile (`critStageBoost`),
 * read in the damage calc and cleared on KO.
 */
export function handleRaiseCritStage(context: EffectContext): BattleEvent[] {
  const { effect } = context;
  if (effect.kind !== EffectKind.RaiseCritStage) {
    return [];
  }
  const target = effect.target === EffectTarget.Self ? context.attacker : context.targets[0];
  if (target === undefined) {
    return [];
  }
  let stages = effect.stages;
  if (effect.dragonBonus === true) {
    const types = context.targetTypesMap.get(target.id) ?? [];
    if (types.includes(PokemonType.Dragon)) {
      stages += 1;
    }
  }
  const before = target.critStageBoost ?? 0;
  const after = Math.min(MAX_CRIT_STAGE, before + stages);
  if (after === before) {
    return [];
  }
  target.critStageBoost = after;
  return [
    {
      type: BattleEventType.CritStageRaised,
      targetId: target.id,
      stages: after - before,
    },
  ];
}
