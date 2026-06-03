import type { DynamicPowerKind } from "../enums/dynamic-power-kind";

/**
 * Describes how a move's base power is recomputed at hit time from battle state.
 *
 * Extensible: future formulas needing parameters (custom thresholds, multipliers)
 * can add optional fields alongside `kind`.
 */
export interface DynamicPowerSpec {
  kind: DynamicPowerKind;
}
