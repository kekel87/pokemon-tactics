import type { StatusType } from "../enums/status-type";

export interface StatusEffect {
  type: StatusType;
  remainingTurns: number | null;
  turnsApplied?: number;
  shortenedByAbilityId?: string;
}
