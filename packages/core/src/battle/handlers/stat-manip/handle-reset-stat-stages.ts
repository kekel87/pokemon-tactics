import { BattleEventType } from "../../../enums/battle-event-type";
import type { EffectKind } from "../../../enums/effect-kind";
import type { BattleEvent } from "../../../types/battle-event";
import type { Effect } from "../../../types/effect";
import type { EffectContext } from "../../effect-handler-registry";
import { statManipBlockedBySubstitute } from "../../substitute-system";
import { TRANSFERABLE_STATS } from "../baton-pass-stats";
import { applyStageWrite } from "./apply-stage-write";

/**
 * Buée Noire (area) / Bain de Smog (single target): reset the stat stages to 0.
 * - `area` set (Buée Noire): every living mon inside the Manhattan diamond centred on the caster is
 *   reset — allies, enemies and the caster itself — ignoring the Substitute (a terrain reset, not a
 *   targeted debuff, decision #596).
 * - `area` absent (Bain de Smog): the resolved target(s) only, blocked by the target's Substitute
 *   (the reset does not traverse a Clone that survived the damage, decision #599).
 */
export function handleResetStatStages(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.ResetStatStages }>;
  const events: BattleEvent[] = [];

  const resetTargets =
    effect.area === undefined
      ? context.targets.filter((target) => !statManipBlockedBySubstitute(context.attacker, target))
      : context.pokemonInRadius(context.attacker.position, effect.area.radius);

  if (resetTargets.length === 0) {
    return events;
  }

  for (const pokemon of resetTargets) {
    for (const stat of TRANSFERABLE_STATS) {
      events.push(...applyStageWrite(pokemon, stat, 0));
    }
  }

  events.unshift({
    type: BattleEventType.StatStagesReset,
    pokemonIds: resetTargets.map((pokemon) => pokemon.id),
  });
  return events;
}
