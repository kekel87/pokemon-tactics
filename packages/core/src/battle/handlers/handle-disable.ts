import { BattleEventType } from "../../enums/battle-event-type";
import { StatusType } from "../../enums/status-type";
import type { BattleEvent } from "../../types/battle-event";
import { ProtectionReason } from "../../types/battle-event";
import type { EffectContext } from "../effect-handler-registry";
import { tryMentalHerbCure } from "../mental-herb";
import { hasSubstitute } from "../substitute-system";

const DISABLE_TURNS = 4;

export function handleDisable(context: EffectContext): BattleEvent[] {
  const events: BattleEvent[] = [];
  const attacker = context.attacker;

  for (const target of context.targets) {
    if (hasSubstitute(target) && attacker.id !== target.id) {
      events.push({
        type: BattleEventType.StatusBlocked,
        pokemonId: target.id,
        status: StatusType.Disabled,
        reason: ProtectionReason.Substitute,
      });
      continue;
    }

    const moveId = target.lastUsedMoveId;
    const knowsMove = moveId !== undefined && target.moveIds.includes(moveId);
    const alreadyDisabled = target.volatileStatuses.some((v) => v.type === StatusType.Disabled);

    if (moveId === undefined || !knowsMove || alreadyDisabled) {
      events.push({ type: BattleEventType.DisableFailed, pokemonId: target.id });
      continue;
    }

    target.volatileStatuses.push({
      type: StatusType.Disabled,
      remainingTurns: DISABLE_TURNS,
      moveId,
      sourceId: attacker.id,
    });
    events.push({
      type: BattleEventType.MoveDisabled,
      pokemonId: target.id,
      moveId,
      turns: DISABLE_TURNS,
    });
    // Herbe Mentale (mental-herb): cures Disable the instant it lands.
    events.push(...tryMentalHerbCure(target, StatusType.Disabled, context.itemRegistry));
  }

  return events;
}
