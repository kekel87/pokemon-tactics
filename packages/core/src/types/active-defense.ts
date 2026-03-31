import type { DefensiveKind } from "../enums/defensive-kind";

export interface ActiveDefense {
  kind: DefensiveKind;
  roundApplied: number;
  turnIndexApplied: number;
}
