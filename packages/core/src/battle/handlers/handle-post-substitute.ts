import { BattleEventType } from "../../enums/battle-event-type";
import type { BattleEvent } from "../../types/battle-event";
import { SubstituteFailedReason } from "../../types/battle-event";
import type { EffectContext } from "../effect-handler-registry";
import { computeSubstituteHp, hasSubstitute } from "../substitute-system";

export function handlePostSubstitute(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;

  if (hasSubstitute(caster)) {
    return [
      {
        type: BattleEventType.SubstituteFailed,
        pokemonId: caster.id,
        reason: SubstituteFailedReason.AlreadyActive,
      },
    ];
  }

  const cost = computeSubstituteHp(caster.maxHp);

  if (caster.currentHp <= cost) {
    return [
      {
        type: BattleEventType.SubstituteFailed,
        pokemonId: caster.id,
        reason: SubstituteFailedReason.InsufficientHp,
      },
    ];
  }

  caster.currentHp -= cost;
  caster.substituteHp = cost;

  return [
    {
      type: BattleEventType.SubstitutePosted,
      pokemonId: caster.id,
      hp: cost,
    },
  ];
}
