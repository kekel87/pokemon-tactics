import type { DefensiveKind } from "../enums/defensive-kind";

export interface ActiveDefense {
  kind: DefensiveKind;
  /** `actionCounter` when this defense was applied. Clears on the owner's next turn. */
  appliedAtAction: number;
}
