import { BattleEventType } from "../../enums/battle-event-type";
import type { BattleEvent } from "../../types/battle-event";
import type { EffectContext } from "../effect-handler-registry";

/** Power multiplier applied to the buffed ally's next offensive move (Coup d'Main). */
export const HELPING_HAND_MULTIPLIER = 1.5;

/**
 * Coup d'Main (helping-hand): flags an adjacent ally so its NEXT offensive move is multiplied by
 * `HELPING_HAND_MULTIPLIER` (applied in the damage calculator, which also clears the flag). A
 * status/heal move by the ally wastes the buff. Targeting (`adjacentAlly`) is resolved upstream;
 * here the resolved target is the ally.
 */
export function handleHelpingHand(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  const ally = context.targets[0];
  if (!ally || ally.id === caster.id) {
    return [];
  }
  ally.helpingHand = true;
  return [
    {
      type: BattleEventType.HelpingHandPosted,
      casterId: caster.id,
      targetId: ally.id,
    },
  ];
}
