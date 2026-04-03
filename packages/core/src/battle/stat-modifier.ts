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

const MOVEMENT_THRESHOLDS: ReadonlyArray<{ readonly maxSpeed: number; readonly movement: number }> = [
  { maxSpeed: 20, movement: 2 },
  { maxSpeed: 45, movement: 3 },
  { maxSpeed: 85, movement: 4 },
  { maxSpeed: 170, movement: 5 },
  { maxSpeed: 340, movement: 6 },
];

const MAX_MOVEMENT = 7;

export function computeMovement(baseSpeed: number, speedStages: number): number {
  const effectiveSpeed = Math.floor(baseSpeed * getStatMultiplier(speedStages));
  for (const threshold of MOVEMENT_THRESHOLDS) {
    if (effectiveSpeed <= threshold.maxSpeed) {
      return threshold.movement;
    }
  }
  return MAX_MOVEMENT;
}
