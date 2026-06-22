import { BattleEventType } from "../../enums/battle-event-type";
import { StatusType } from "../../enums/status-type";
import type { BattleEvent } from "../../types/battle-event";
import { ProtectionReason } from "../../types/battle-event";
import type { EffectContext } from "../effect-handler-registry";
import { tryMentalHerbCure } from "../mental-herb";
import { hasSubstitute } from "../substitute-system";

const ENCORE_TURNS = 3;

export function handleEncore(context: EffectContext): BattleEvent[] {
  const events: BattleEvent[] = [];
  const attacker = context.attacker;

  for (const target of context.targets) {
    if (hasSubstitute(target) && attacker.id !== target.id) {
      events.push({
        type: BattleEventType.StatusBlocked,
        pokemonId: target.id,
        status: StatusType.Encored,
        reason: ProtectionReason.Substitute,
      });
      continue;
    }

    const moveId = target.lastUsedMoveId;
    const knowsMove = moveId !== undefined && target.moveIds.includes(moveId);
    const alreadyEncored = target.volatileStatuses.some((v) => v.type === StatusType.Encored);

    if (moveId === undefined || !knowsMove || moveId === "encore" || alreadyEncored) {
      events.push({ type: BattleEventType.EncoreFailed, pokemonId: target.id });
      continue;
    }

    target.volatileStatuses.push({
      type: StatusType.Encored,
      remainingTurns: ENCORE_TURNS,
      moveId,
      sourceId: attacker.id,
    });
    events.push({
      type: BattleEventType.MoveEncored,
      pokemonId: target.id,
      moveId,
      turns: ENCORE_TURNS,
    });
    // Herbe Mentale (mental-herb): cures Encore the instant it lands.
    events.push(...tryMentalHerbCure(target, StatusType.Encored, context.itemRegistry));
  }

  return events;
}
