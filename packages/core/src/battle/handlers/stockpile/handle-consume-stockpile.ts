import { BattleEventType } from "../../../enums/battle-event-type";
import { StatName } from "../../../enums/stat-name";
import type { BattleEvent } from "../../../types/battle-event";
import { applyStatStage } from "../../apply-stat-stage";
import type { EffectContext } from "../../effect-handler-registry";

/**
 * Spend the caster's stockpile after Relâche (spit-up) / Avale (swallow): reset the layer count to 0
 * and lower Defense + Sp. Def by the number of layers just spent — undoing the Stockage boosts
 * (canon). Runs as the last effect of both moves, after damage/heal has read the layer count.
 */
export function handleConsumeStockpile(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  const layers = caster.stockpileCount ?? 0;
  if (layers <= 0) {
    return [];
  }

  const defBoost = caster.stockpileDefBoost ?? 0;
  const spDefBoost = caster.stockpileSpDefBoost ?? 0;
  caster.stockpileCount = 0;
  caster.stockpileDefBoost = undefined;
  caster.stockpileSpDefBoost = undefined;
  const defense = applyStatStage(caster, StatName.Defense, -defBoost);
  const spDefense = applyStatStage(caster, StatName.SpDefense, -spDefBoost);

  return [
    { type: BattleEventType.StockpileReleased, pokemonId: caster.id },
    ...defense.events,
    ...spDefense.events,
  ];
}
