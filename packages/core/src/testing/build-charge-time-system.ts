import { ChargeTimeTurnSystem } from "../battle/ChargeTimeTurnSystem";
import { computeCtGain } from "../battle/ct-costs";

export function buildChargeTimeSystem(
  speeds: Record<string, number>,
  stages: Record<string, number> = {},
): ChargeTimeTurnSystem {
  const ids = Object.keys(speeds);
  return new ChargeTimeTurnSystem(ids, (id) => {
    const base = speeds[id] ?? 50;
    const stage = stages[id] ?? 0;
    return computeCtGain(base, stage);
  });
}
