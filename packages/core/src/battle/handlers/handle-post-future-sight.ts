import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { EffectContext } from "../effect-handler-registry";
import { freezeOffense, hasStrikeOnTile } from "../future-sight-system";

/**
 * Prescience (future-sight): schedules a tile-bound delayed strike on the aimed ground tile. The
 * caster's offense is frozen now; the strike lands after `delayTurns` of the caster's own turns and
 * hits everyone within `radius` of the locked tile (friendly fire included). Fails if a Prescience
 * strike is already locked on that tile.
 */
export function handlePostFutureSight(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.PostFutureSight }>;
  const tile = context.targetPosition;
  if (hasStrikeOnTile(context.state, tile)) {
    return [{ type: BattleEventType.FutureSightFailed, attackerId: context.attacker.id }];
  }
  context.state.pendingStrikes.push({
    centerPosition: { x: tile.x, y: tile.y },
    radius: effect.radius,
    frozenOffense: freezeOffense({
      attacker: context.attacker,
      attackerTypes: context.attackerTypes,
      moveType: context.move.type,
      power: effect.power,
    }),
    casterId: context.attacker.id,
    casterPlayerId: context.attacker.playerId,
    turnsRemaining: effect.delayTurns,
  });
  return [
    {
      type: BattleEventType.FutureSightPosted,
      casterId: context.attacker.id,
      tile: { x: tile.x, y: tile.y },
    },
  ];
}
