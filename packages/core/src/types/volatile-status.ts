import type { StatusType } from "../enums/status-type";

export interface VolatileStatus {
  type: StatusType;
  remainingTurns: number;
}
