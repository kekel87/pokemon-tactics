import { TargetingKind } from "../enums/targeting-kind";
import type { TargetingPattern } from "../types/targeting-pattern";

/** Portée maximale (distance Manhattan) qu'un move peut atteindre depuis le lanceur. */
export function getMoveMaxReach(targeting: TargetingPattern): number {
  switch (targeting.kind) {
    case TargetingKind.Single:
      return targeting.range.max;
    case TargetingKind.Cone:
      return targeting.range.max;
    case TargetingKind.Line:
      return targeting.length;
    case TargetingKind.Dash:
      return targeting.maxDistance;
    case TargetingKind.Blast:
      return targeting.range.max + targeting.radius;
    case TargetingKind.Slash:
      return 1;
    case TargetingKind.Cross:
      return Math.floor(targeting.size / 2);
    case TargetingKind.Zone:
      return targeting.radius;
    case TargetingKind.Self:
      return 0;
    case TargetingKind.Teleport:
      return targeting.range.max;
    case TargetingKind.HitAndRun:
      return targeting.hitRange.max;
    case TargetingKind.GroundTarget:
      return targeting.range.max;
  }
}
