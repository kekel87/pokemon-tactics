import type { StatName } from "../enums/stat-name";
import type { StatusType } from "../enums/status-type";

export interface VolatileStatus {
  type: StatusType;
  remainingTurns: number;
  sourceId?: string;
  damagePerTurn?: number;
  statChangeApplied?: boolean;
  /**
   * Intimidated only (plan 227): the Acharné / Battant boost this drop woke, given back with the
   * aura's -1 when it lifts — otherwise each walk-in / walk-out cycle would stack another +2.
   */
  retaliation?: { stat: StatName; stages: number }[];
  moveId?: string;
}
