import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import { manhattanDistance } from "../../utils/manhattan-distance";
import type { EffectContext } from "../effect-handler-registry";
import { isMajorStatus } from "../stat-modifier";

/**
 * Cures the major status of every living ally within `radius` of the caster (aromatherapy).
 * Volatile statuses (confusion, etc.) are untouched — parity with Heal Bell / Aromatherapy.
 */
export function handleCureTeamStatus(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.CureTeamStatus }>;
  const events: BattleEvent[] = [];

  for (const ally of context.state.pokemon.values()) {
    if (
      ally.currentHp <= 0 ||
      ally.playerId !== context.attacker.playerId ||
      manhattanDistance(ally.position, context.attacker.position) > effect.radius
    ) {
      continue;
    }
    const remaining = ally.statusEffects.filter((status) => !isMajorStatus(status.type));
    const curedTypes = ally.statusEffects
      .filter((status) => isMajorStatus(status.type))
      .map((status) => status.type);
    if (curedTypes.length === 0) {
      continue;
    }
    ally.statusEffects = remaining;
    ally.toxicCounter = 0;
    for (const status of curedTypes) {
      events.push({ type: BattleEventType.StatusRemoved, targetId: ally.id, status });
    }
  }
  return events;
}
