import type { TeamSetValidationError } from "./team-set-validation-error";

export interface TeamSetValidationResult {
  valid: boolean;
  errors: TeamSetValidationError[];
}
