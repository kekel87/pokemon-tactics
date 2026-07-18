import { BattleEventType } from "../../../enums/battle-event-type";
import { StatName } from "../../../enums/stat-name";
import type { BattleEvent } from "../../../types/battle-event";
import { applyStatStage } from "../../apply-stat-stage";
import type { EffectContext } from "../../effect-handler-registry";

/** Canon cap: Stockage can be used up to three times. */
const MAX_STOCKPILE_LAYERS = 3;

/**
 * Stockage (stockpile, plan 162): add one stockpile layer (cap 3) and raise the caster's Defense and
 * Sp. Def by one stage each. Fails once the caster already holds 3 layers. The layers (and the stat
 * boosts) are later spent by Relâche (spit-up) / Avale (swallow) via `ConsumeStockpile`.
 */
export function handleStockpile(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  const current = caster.stockpileCount ?? 0;
  if (current >= MAX_STOCKPILE_LAYERS) {
    return [{ type: BattleEventType.MoveFailed, attackerId: caster.id, moveId: context.move.id }];
  }

  caster.stockpileCount = current + 1;
  const defense = applyStatStage(caster, StatName.Defense, 1);
  const spDefense = applyStatStage(caster, StatName.SpDefense, 1);
  // Track the ACTUAL boost (may be 0 if a stage was already +6) so the spend undoes exactly this.
  caster.stockpileDefBoost = (caster.stockpileDefBoost ?? 0) + defense.actualChange;
  caster.stockpileSpDefBoost = (caster.stockpileSpDefBoost ?? 0) + spDefense.actualChange;

  return [
    { type: BattleEventType.Stockpiled, pokemonId: caster.id, count: caster.stockpileCount },
    ...defense.events,
    ...spDefense.events,
  ];
}
