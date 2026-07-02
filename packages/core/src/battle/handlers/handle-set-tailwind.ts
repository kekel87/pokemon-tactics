import { BattleEventType } from "../../enums/battle-event-type";
import type { BattleEvent } from "../../types/battle-event";
import { directionFromTo } from "../../utils/direction";
import type { EffectContext } from "../effect-handler-registry";
import { setTailwind, TAILWIND_DEFAULT_DURATION } from "../tailwind-system";

/**
 * Cast Vent Arrière ("tailwind"): set the single global directional wind. The chosen direction is
 * derived from the targeted cardinal-adjacent tile (GroundTarget range 1); if the target tile is the
 * caster's own (defensive guard), fall back to the caster's current orientation. Emits TailwindSet.
 */
export function handleSetTailwind(context: EffectContext): BattleEvent[] {
  const { attacker, targetPosition } = context;
  const sameTile =
    targetPosition.x === attacker.position.x && targetPosition.y === attacker.position.y;
  const direction = sameTile
    ? attacker.orientation
    : directionFromTo(attacker.position, targetPosition);
  setTailwind(context.state, attacker, direction);
  return [
    {
      type: BattleEventType.TailwindSet,
      casterId: attacker.id,
      direction,
      turns: TAILWIND_DEFAULT_DURATION,
    },
  ];
}
