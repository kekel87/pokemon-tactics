import type { TargetingKind } from "../enums/targeting-kind";
import type { RangeConfig } from "./range-config";

export type TargetingPattern =
  | { kind: typeof TargetingKind.Single; range: RangeConfig }
  | { kind: typeof TargetingKind.Self }
  | { kind: typeof TargetingKind.Cone; range: RangeConfig }
  | { kind: typeof TargetingKind.Cross; size: number }
  | { kind: typeof TargetingKind.Line; length: number }
  | { kind: typeof TargetingKind.Dash; maxDistance: number }
  | { kind: typeof TargetingKind.Zone; radius: number }
  | { kind: typeof TargetingKind.Slash }
  | { kind: typeof TargetingKind.Blast; range: RangeConfig; radius: number };
