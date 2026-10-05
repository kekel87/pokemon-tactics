import { BattleEventType } from "../enums/battle-event-type";
import type { StatName } from "../enums/stat-name";
import type { BlockResult } from "../types/ability-definition";
import type { BattleEvent } from "../types/battle-event";
import { ProtectionReason } from "../types/battle-event";
import type { OpponentStatDrop } from "../types/opponent-stat-drop";
import { resolveDefensiveAbility } from "./ability-suppression";
import { applyStatStage } from "./apply-stat-stage";
import { isProtectedFromStatDecrease } from "./aura-system";
import { effectiveHeldItem } from "./effective-held-item";

/**
 * Whether a stat drop inflicted by an opponent is stopped before it lands, in canon order: the
 * target's ability (Corps Sain, Hyper Cutter, Regard Vif… — Brise Moule on the source ignores the
 * breakable ones), then its held item (Talisman Sain), then a Brume aura. Shared by stat-lowering
 * moves and Intimidation (plan 227), which used to bypass all three.
 */
export function resolveOpponentStatDropBlock(drop: OpponentStatDrop): BlockResult {
  const abilityBlock = resolveDefensiveAbility(
    drop.abilityRegistry,
    drop.target,
    drop.source,
  )?.onStatChangeBlocked?.({
    self: drop.target,
    stat: drop.stat,
    stages: drop.stages,
    source: drop.source,
  });
  if (abilityBlock?.blocked) {
    return abilityBlock;
  }

  const itemBlock = effectiveHeldItem(
    drop.state,
    drop.target,
    drop.itemRegistry,
  )?.onStatChangeBlocked?.({
    self: drop.target,
    stat: drop.stat,
    stages: drop.stages,
    source: drop.source,
  });
  if (itemBlock?.blocked) {
    return itemBlock;
  }

  const mistProtection = isProtectedFromStatDecrease(drop.state, drop.source, drop.target);
  if (mistProtection.protected) {
    return {
      blocked: true,
      events: [
        {
          type: BattleEventType.StatChangeBlocked,
          pokemonId: drop.target.id,
          stat: drop.stat,
          reason: ProtectionReason.Mist,
          protectingCasterId: mistProtection.casterId,
        },
      ],
    };
  }

  return { blocked: false, events: [] };
}

/** Acharné / Battant (defiant / competitive): retaliation once an opponent's drop has landed. */
export function notifyOpponentStatLowered(drop: OpponentStatDrop): BattleEvent[] {
  return (
    drop.abilityRegistry?.getForPokemon(drop.target)?.onAfterStatLowered?.({
      self: drop.target,
      stat: drop.stat,
      stages: drop.stages,
      source: drop.source,
    }) ?? []
  );
}

/**
 * The whole opponent stat drop when nothing sits between the block and the write — Intimidation
 * (plan 227): blockers, then `applyStatStage`, then Acharné / Battant. Stat-lowering moves keep
 * their own sequence because Clone checks in the middle; both share the two steps above.
 */
export function applyOpponentStatDrop(drop: OpponentStatDrop): {
  events: BattleEvent[];
  actualChange: number;
  /** The target's own stat boosts woken by the drop (Acharné / Battant), for an aura to undo. */
  retaliation: { stat: StatName; stages: number }[];
} {
  const block = resolveOpponentStatDropBlock(drop);
  if (block.blocked) {
    return { events: block.events, actualChange: 0, retaliation: [] };
  }
  const { events, actualChange } = applyStatStage(drop.target, drop.stat, drop.stages);
  const retaliation: { stat: StatName; stages: number }[] = [];
  if (actualChange < 0) {
    for (const event of notifyOpponentStatLowered({ ...drop, stages: actualChange })) {
      events.push(event);
      if (event.type === BattleEventType.StatChanged && event.targetId === drop.target.id) {
        retaliation.push({ stat: event.stat, stages: event.stages });
      }
    }
  }
  return { events, actualChange, retaliation };
}
