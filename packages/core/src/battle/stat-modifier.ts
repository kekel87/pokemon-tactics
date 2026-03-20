import { StatusType } from "../enums/status-type";

const MAJOR_STATUSES: ReadonlySet<StatusType> = new Set([
  StatusType.Burned,
  StatusType.Paralyzed,
  StatusType.Poisoned,
  StatusType.BadlyPoisoned,
  StatusType.Frozen,
  StatusType.Asleep,
]);

export function getStatMultiplier(stages: number): number {
  if (stages >= 0) {
    return (2 + stages) / 2;
  }
  return 2 / (2 - stages);
}

export function getEffectiveStat(baseStat: number, stages: number): number {
  return Math.floor(baseStat * getStatMultiplier(stages));
}

export function clampStages(current: number, change: number): number {
  return Math.max(-6, Math.min(6, current + change));
}

export function isMajorStatus(status: StatusType): boolean {
  return MAJOR_STATUSES.has(status);
}
