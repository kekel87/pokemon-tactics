import { BattleEventType } from "../../../enums/battle-event-type";
import type { EffectKind } from "../../../enums/effect-kind";
import type { BattleEvent } from "../../../types/battle-event";
import type { Effect } from "../../../types/effect";
import { directionFromTo } from "../../../utils/direction";
import type { EffectContext } from "../../effect-handler-registry";
import { isImmuneToPowderMove } from "../../powder-immunity";

/**
 * Par Ici / Poudre Fureur (follow-me / rage-powder, plan 155): every enemy inside the Manhattan
 * diamond of `radius` centred on the caster pivots to face the caster, exposing its back to the
 * caster's allies (back-attack ×1.15). One-shot: an enemy re-orients on its own next action, so this
 * lasts exactly until the enemy acts — the grid equivalent of the canon one-turn redirection.
 *
 * Poudre Fureur is a powder move: powder-immune enemies (Grass / Envelocape / Lunettes Filtre) do
 * not turn. Par Ici (not a powder move) affects every enemy in range.
 */
export function handleDrawAttention(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.DrawAttention }>;
  const caster = context.attacker;

  const affectedIds: string[] = [];
  for (const mon of context.pokemonInRadius(caster.position, effect.radius)) {
    if (mon.playerId === caster.playerId) {
      continue;
    }
    const monTypes = context.targetTypesMap.get(mon.id) ?? [];
    if (
      isImmuneToPowderMove(
        mon,
        context.move,
        monTypes,
        caster,
        context.abilityRegistry,
        context.itemRegistry,
      )
    ) {
      continue;
    }
    mon.orientation = directionFromTo(mon.position, caster.position);
    affectedIds.push(mon.id);
  }

  if (affectedIds.length === 0) {
    return [];
  }
  return [{ type: BattleEventType.DrewAttention, casterId: caster.id, affectedIds }];
}
