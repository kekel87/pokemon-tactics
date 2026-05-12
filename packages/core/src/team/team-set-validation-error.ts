import type { TeamSetValidationErrorKind } from "./team-set-validation-error-kind";

export interface TeamSetValidationError {
  kind: TeamSetValidationErrorKind;
  slotIndex?: number;
  message: string;
  context?: Record<string, string>;
}
